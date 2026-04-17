import { db } from "@/lib/db";
import { appointments, patients, studios, users, treatmentTypes, whatsappMessages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  sendWhatsAppMessage,
  buildAppointmentConfirmedMessage,
  buildAppointmentCancelledMessage,
} from "@/lib/whatsapp";

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

async function send(
  ctx: AppointmentContext,
  body: string,
  messageType: "appointment_confirm" | "appointment_cancel"
): Promise<void> {
  if (!ctx.patientPhone || !ctx.studioWhatsappId) return;
  try {
    const waMessageId = await sendWhatsAppMessage(ctx.patientPhone, body, ctx.studioWhatsappId);
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
    console.error(`[whatsapp-notifications] ${messageType} failed:`, err);
    await db.insert(whatsappMessages).values({
      studioId: ctx.studioId,
      patientId: ctx.patientId,
      direction: "outbound",
      messageType,
      body,
      status: "failed",
    });
  }
}

export async function notifyAppointmentConfirmed(appointmentId: string): Promise<void> {
  const ctx = await loadAppointmentContext(appointmentId);
  if (!ctx) return;
  const body = buildAppointmentConfirmedMessage(
    ctx.patientName,
    ctx.studioName,
    ctx.startTime,
    ctx.treatmentName,
    ctx.dentistName
  );
  await send(ctx, body, "appointment_confirm");
}

export async function notifyAppointmentCancelled(
  appointmentId: string,
  reason?: string | null
): Promise<void> {
  const ctx = await loadAppointmentContext(appointmentId);
  if (!ctx) return;
  const body = buildAppointmentCancelledMessage(
    ctx.patientName,
    ctx.studioName,
    ctx.startTime,
    reason
  );
  await send(ctx, body, "appointment_cancel");
}
