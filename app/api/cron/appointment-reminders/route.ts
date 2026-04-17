import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  appointments,
  patients,
  studios,
  users,
  treatmentTypes,
  whatsappMessages,
  recalls,
} from "@/lib/db/schema";
import { eq, and, gte, lte, isNotNull } from "drizzle-orm";
import { addHours, addDays, format, differenceInCalendarDays } from "date-fns";
import {
  sendWhatsAppMessage,
  buildReminderMessage,
  buildRecallReminderMessage,
} from "@/lib/whatsapp";

export const runtime = "nodejs";

async function handle(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const now = new Date();
  const result = {
    appointments: { sent24h: 0, sent2h: 0, failed: 0 },
    recalls: { sent30d: 0, sent14d: 0, failed: 0 },
  };

  // ── Appointment reminders ──────────────────────────────────────────────────
  // Windows are intentionally wider than the target (24h / 2h) so that a missed
  // cron run (e.g. hourly schedule with a gap) still catches the appointment.
  // `reminderSent` / `secondReminderSent` prevent duplicates.
  const win24Start = addHours(now, 20);
  const win24End = addHours(now, 28);
  const win2Start = addHours(now, 1);
  const win2End = addHours(now, 3);

  const apptRows = await db
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
        isNotNull(patients.phone),
        gte(appointments.startTime, win2Start),
        lte(appointments.startTime, win24End)
      )
    );

  for (const appt of apptRows) {
    if (!appt.patientPhone || !appt.studioWhatsappId) continue;
    const patientName = `${appt.patientFirstName ?? ""} ${appt.patientLastName ?? ""}`.trim();

    const is24Window =
      !appt.reminderSent && appt.startTime >= win24Start && appt.startTime <= win24End;
    const is2Window =
      !appt.secondReminderSent && appt.startTime >= win2Start && appt.startTime <= win2End;

    const hoursAhead: 24 | 2 | null = is2Window ? 2 : is24Window ? 24 : null;
    if (!hoursAhead) continue;

    const body = buildReminderMessage(
      patientName,
      appt.studioName ?? "",
      appt.startTime,
      appt.treatmentName,
      appt.dentistName,
      hoursAhead
    );

    try {
      const waMessageId = await sendWhatsAppMessage(
        appt.patientPhone,
        body,
        appt.studioWhatsappId ?? undefined
      );
      if (hoursAhead === 24) {
        await db
          .update(appointments)
          .set({ reminderSent: true, reminderSentAt: new Date() })
          .where(eq(appointments.id, appt.id));
        result.appointments.sent24h++;
      } else {
        await db
          .update(appointments)
          .set({ secondReminderSent: true, secondReminderSentAt: new Date() })
          .where(eq(appointments.id, appt.id));
        result.appointments.sent2h++;
      }
      await db.insert(whatsappMessages).values({
        studioId: appt.studioId,
        patientId: appt.patientId ?? undefined,
        direction: "outbound",
        messageType: "reminder",
        body,
        status: "sent",
        waMessageId,
      });
    } catch (err) {
      console.error(`[cron] appt reminder failed for ${appt.id}:`, err);
      result.appointments.failed++;
    }
  }

  // ── Recall reminders (30 days and 2 weeks before dueDate) ──────────────────
  // Windows are wide on the early side (28–30d / 13–15d) so a skipped day still
  // catches the recall. `reminderSentAt` / `secondReminderSentAt` prevent dupes.
  const in30 = format(addDays(now, 30), "yyyy-MM-dd");
  const in28 = format(addDays(now, 28), "yyyy-MM-dd");
  const in15 = format(addDays(now, 15), "yyyy-MM-dd");
  const in13 = format(addDays(now, 13), "yyyy-MM-dd");
  const earliest = in13 < in28 ? in13 : in28;
  const latest = in30 > in15 ? in30 : in15;

  const recallRows = await db
    .select({
      id: recalls.id,
      studioId: recalls.studioId,
      patientId: recalls.patientId,
      recallType: recalls.recallType,
      dueDate: recalls.dueDate,
      status: recalls.status,
      reminderSentAt: recalls.reminderSentAt,
      secondReminderSentAt: recalls.secondReminderSentAt,
      patientPhone: patients.phone,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      studioName: studios.name,
      studioWhatsappId: studios.whatsappPhoneNumberId,
    })
    .from(recalls)
    .leftJoin(patients, eq(recalls.patientId, patients.id))
    .leftJoin(studios, eq(recalls.studioId, studios.id))
    .where(
      and(
        isNotNull(studios.whatsappPhoneNumberId),
        isNotNull(patients.phone),
        gte(recalls.dueDate, earliest),
        lte(recalls.dueDate, latest)
      )
    );

  for (const recall of recallRows) {
    if (!recall.patientPhone || !recall.studioWhatsappId) continue;
    if (recall.status === "completed" || recall.status === "ignored") continue;

    const dueDate = new Date(recall.dueDate);
    const daysUntil = differenceInCalendarDays(dueDate, now);
    const patientName = `${recall.patientFirstName ?? ""} ${recall.patientLastName ?? ""}`.trim();

    const is30Window = !recall.reminderSentAt && daysUntil >= 28 && daysUntil <= 30;
    const is14Window = !recall.secondReminderSentAt && daysUntil >= 13 && daysUntil <= 15;

    const daysBefore: 30 | 14 | null = is14Window ? 14 : is30Window ? 30 : null;
    if (!daysBefore) continue;

    const body = buildRecallReminderMessage(
      patientName,
      recall.recallType,
      dueDate,
      recall.studioName ?? "",
      daysBefore
    );

    try {
      const waMessageId = await sendWhatsAppMessage(
        recall.patientPhone,
        body,
        recall.studioWhatsappId ?? undefined
      );
      if (daysBefore === 30) {
        await db
          .update(recalls)
          .set({ reminderSentAt: new Date(), status: "sent" })
          .where(eq(recalls.id, recall.id));
        result.recalls.sent30d++;
      } else {
        await db
          .update(recalls)
          .set({ secondReminderSentAt: new Date() })
          .where(eq(recalls.id, recall.id));
        result.recalls.sent14d++;
      }
      await db.insert(whatsappMessages).values({
        studioId: recall.studioId,
        patientId: recall.patientId ?? undefined,
        direction: "outbound",
        messageType: "recall",
        body,
        status: "sent",
        waMessageId,
      });
    } catch (err) {
      console.error(`[cron] recall reminder failed for ${recall.id}:`, err);
      result.recalls.failed++;
    }
  }

  return NextResponse.json({ ok: true, ...result });
}

// Vercel cron sends GET by default; also accept POST for manual triggers.
export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
