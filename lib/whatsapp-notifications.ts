import { db } from "@/lib/db";
import { appointments, patients, studios, users, treatmentTypes, whatsappMessages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  sendAppointmentConfirmedTemplate,
  sendAppointmentCancelledTemplate,
} from "@/lib/whatsapp-templates";

type AppointmentContext = {
  studioId: string;
  studioName: string;
  studioWhatsappId: string | null;
  patientId: string;
  patientPhone: string | null;
  patientName: string;
  startTime: Date;
  treatmentName: string | null;
  dentistName: string | null;
};

async function loadAppointmentContext(appointmentId: string): Promise<AppointmentContext | null> {
  const [row] = await db
    .select({
      studioId: appointments.studioId,
      patientId: appointments.patientId,
      startTime: appointments.startTime,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      patientPhone: patients.phone,
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
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!row) return null;

  return {
    studioId: row.studioId,
    studioName: row.studioName ?? "",
    studioWhatsappId: row.studioWhatsappId,
    patientId: row.patientId,
    patientPhone: row.patientPhone,
    patientName: `${row.patientFirstName ?? ""} ${row.patientLastName ?? ""}`.trim(),
    startTime: row.startTime,
    treatmentName: row.treatmentName,
    dentistName: row.dentistName,
  };
}

type SendableType = "appointment_confirm" | "appointment_cancel";

async function logAndRun(
  ctx: AppointmentContext,
  messageType: SendableType,
  action: () => Promise<{ body: string; waMessageId: string }>
): Promise<void> {
  console.log(
    `[wa-notify] ${messageType} — patient=${ctx.patientName} phone=${ctx.patientPhone ?? "MISSING"} studioWaId=${ctx.studioWhatsappId ?? "MISSING"}`
  );
  if (!ctx.patientPhone) {
    console.warn(`[wa-notify] skip: patient has no phone (${ctx.patientName})`);
    return;
  }
  const phoneNumberId = ctx.studioWhatsappId ?? process.env.META_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    console.warn(`[wa-notify] skip: studio.whatsappPhoneNumberId not set and META_PHONE_NUMBER_ID env var missing`);
    return;
  }
  try {
    const { body, waMessageId } = await action();
    console.log(`[wa-notify] sent ${messageType} — waId=${waMessageId}`);
    await db.insert(whatsappMessages).values({
      studioId: ctx.studioId,
      patientId: ctx.patientId,
      direction: "outbound",
      messageType,
      body,
      status: "sent",
      waMessageId,
    });
  } catch (err) {
    console.error(`[wa-notify] ${messageType} failed:`, err);
    await db.insert(whatsappMessages).values({
      studioId: ctx.studioId,
      patientId: ctx.patientId,
      direction: "outbound",
      messageType,
      body: `[template ${messageType} failed] ${err instanceof Error ? err.message : String(err)}`,
      status: "failed",
    });
  }
}

export async function notifyAppointmentConfirmed(appointmentId: string): Promise<void> {
  console.log(`[wa-notify] ENTER notifyAppointmentConfirmed id=${appointmentId}`);
  const ctx = await loadAppointmentContext(appointmentId);
  if (!ctx) {
    console.warn(`[wa-notify] skip: loadAppointmentContext returned null for id=${appointmentId}`);
    return;
  }
  console.log(`[wa-notify] ctx loaded — phone=${ctx.patientPhone} studioWaId=${ctx.studioWhatsappId} envPid=${process.env.META_PHONE_NUMBER_ID ? "set" : "MISSING"} envToken=${process.env.META_WHATSAPP_TOKEN ? `set(len=${process.env.META_WHATSAPP_TOKEN.length})` : "MISSING"}`);
  await logAndRun(ctx, "appointment_confirm", async () => {
    const r = await sendAppointmentConfirmedTemplate({
      to: ctx.patientPhone!,
      patientName: ctx.patientName,
      studioName: ctx.studioName,
      startTime: ctx.startTime,
      treatmentName: ctx.treatmentName,
      phoneNumberId: ctx.studioWhatsappId,
    });
    return { body: r.body, waMessageId: r.waMessageId };
  });
}

export async function notifyAppointmentCancelled(
  appointmentId: string,
  _reason?: string | null
): Promise<void> {
  console.log(`[wa-notify] ENTER notifyAppointmentCancelled id=${appointmentId}`);
  const ctx = await loadAppointmentContext(appointmentId);
  if (!ctx) {
    console.warn(`[wa-notify] skip: loadAppointmentContext returned null for id=${appointmentId}`);
    return;
  }
  console.log(`[wa-notify] ctx loaded — phone=${ctx.patientPhone} studioWaId=${ctx.studioWhatsappId} envPid=${process.env.META_PHONE_NUMBER_ID ? "set" : "MISSING"} envToken=${process.env.META_WHATSAPP_TOKEN ? `set(len=${process.env.META_WHATSAPP_TOKEN.length})` : "MISSING"}`);
  await logAndRun(ctx, "appointment_cancel", async () => {
    const r = await sendAppointmentCancelledTemplate({
      to: ctx.patientPhone!,
      patientName: ctx.patientName,
      studioName: ctx.studioName,
      startTime: ctx.startTime,
      phoneNumberId: ctx.studioWhatsappId,
    });
    return { body: r.body, waMessageId: r.waMessageId };
  });
}
