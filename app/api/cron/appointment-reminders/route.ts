import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { appointments, patients, studios, users, treatmentTypes, whatsappMessages } from "@/lib/db/schema";
import { eq, and, gte, lte, isNotNull } from "drizzle-orm";
import { addHours } from "date-fns";
import { sendWhatsAppMessage, buildReminderMessage } from "@/lib/whatsapp";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const now = new Date();

  // Cron runs once/day at 07:00 (Vercel Hobby limit).
  // "Tomorrow" reminder: appointments 20–32h from now (covers all of tomorrow).
  // "Today" reminder:    appointments 1–12h from now (covers today's remaining slots).
  const winTomorrowStart = addHours(now, 20);
  const winTomorrowEnd   = addHours(now, 32);
  const winTodayStart    = addHours(now, 1);
  const winTodayEnd      = addHours(now, 12);

  const rows = await db
    .select({
      id: appointments.id,
      studioId: appointments.studioId,
      startTime: appointments.startTime,
      reminderSent: appointments.reminderSent,
      secondReminderSent: appointments.secondReminderSent,
      patientPhone: patients.phone,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      patientId: patients.id,
      studioName: studios.name,
      studioWhatsappId: studios.whatsappPhoneNumberId,
      dentistName: users.fullName,
      treatmentName: treatmentTypes.name,
    })
    .from(appointments)
    .leftJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(studios, eq(appointments.studioId, studios.id))
    .leftJoin(users, eq(appointments.dentistId, users.id))
    .leftJoin(treatmentTypes, eq(appointments.treatmentTypeId, treatmentTypes.id))
    .where(
      and(
        eq(appointments.status, "confirmed"),
        isNotNull(studios.whatsappPhoneNumberId),
        isNotNull(patients.phone)
      )
    );

  const reminder48 = rows.filter(
    (r) => !r.reminderSent && r.startTime >= winTomorrowStart && r.startTime <= winTomorrowEnd
  );
  const reminder2 = rows.filter(
    (r) => !r.secondReminderSent && r.startTime >= winTodayStart && r.startTime <= winTodayEnd
  );

  let sent = 0;
  let failed = 0;

  async function sendReminder(
    appt: typeof rows[0],
    hoursAhead: 48 | 2
  ) {
    if (!appt.patientPhone || !appt.studioWhatsappId) return;
    const patientName = `${appt.patientFirstName} ${appt.patientLastName}`;
    const body = buildReminderMessage(
      patientName,
      appt.studioName ?? "",
      appt.startTime,
      appt.treatmentName,
      appt.dentistName,
      hoursAhead
    );
    try {
      const sid = await sendWhatsAppMessage(appt.patientPhone, body, appt.studioWhatsappId ?? undefined);
      if (hoursAhead === 48) {
        await db
          .update(appointments)
          .set({ reminderSent: true, reminderSentAt: new Date() })
          .where(eq(appointments.id, appt.id));
      } else {
        await db
          .update(appointments)
          .set({ secondReminderSent: true, secondReminderSentAt: new Date() })
          .where(eq(appointments.id, appt.id));
      }
      await db.insert(whatsappMessages).values({
        studioId: appt.studioId,
        patientId: appt.patientId ?? undefined,
        direction: "outbound",
        messageType: "reminder",
        body,
        status: "sent",
        waMessageId: sid,
      });
      sent++;
    } catch (err) {
      console.error(`[cron] Failed reminder for appointment ${appt.id}:`, err);
      failed++;
    }
  }

  for (const appt of reminder48) {
    await sendReminder(appt, 48);
  }
  for (const appt of reminder2) {
    await sendReminder(appt, 2);
  }

  return NextResponse.json({ ok: true, sent, failed });
}
