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

  // Windows: 48h ± 1h and 2h ± 1h
  const win48Start = addHours(now, 47);
  const win48End = addHours(now, 49);
  const win2Start = addHours(now, 1);
  const win2End = addHours(now, 3);

  // Fetch appointments for both windows in one query
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
      studioTwilioPhone: studios.twilioPhoneFrom,
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
        isNotNull(studios.twilioPhoneFrom),
        isNotNull(patients.phone)
      )
    );

  const reminder48 = rows.filter(
    (r) => !r.reminderSent && r.startTime >= win48Start && r.startTime <= win48End
  );
  const reminder2 = rows.filter(
    (r) => !r.secondReminderSent && r.startTime >= win2Start && r.startTime <= win2End
  );

  let sent = 0;
  let failed = 0;

  async function sendReminder(
    appt: typeof rows[0],
    hoursAhead: 48 | 2
  ) {
    if (!appt.patientPhone || !appt.studioTwilioPhone) return;
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
      const sid = await sendWhatsAppMessage(appt.patientPhone, body, appt.studioTwilioPhone);
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
