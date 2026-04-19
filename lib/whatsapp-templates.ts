import { sendMetaWhatsAppTemplate } from "@/lib/meta-whatsapp";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const LANG = "it";

function formatDateTime(date: Date): string {
  return format(date, "EEEE d MMMM 'alle' HH:mm", { locale: it });
}

function formatDate(date: Date): string {
  return format(date, "EEEE d MMMM", { locale: it });
}

function resolveCreds(phoneNumberIdOverride?: string | null): { pid: string; token: string } {
  const pid = phoneNumberIdOverride ?? process.env.META_PHONE_NUMBER_ID ?? "";
  const token = process.env.META_WHATSAPP_TOKEN ?? "";
  if (!pid || !token) {
    throw new Error("META_PHONE_NUMBER_ID e META_WHATSAPP_TOKEN sono richiesti");
  }
  return { pid, token };
}

export type TemplateName =
  | "appointment_confirmed"
  | "appointment_cancelled"
  | "appointment_reminder_24h"
  | "appointment_reminder_2h"
  | "recall_reminder_30d"
  | "recall_reminder_14d";

export type TemplateSendResult = {
  templateName: TemplateName;
  params: string[];
  body: string;
  waMessageId: string;
};

async function sendTemplate(
  to: string,
  templateName: TemplateName,
  params: string[],
  phoneNumberId: string | null | undefined
): Promise<string> {
  const { pid, token } = resolveCreds(phoneNumberId);
  return sendMetaWhatsAppTemplate(to, templateName, LANG, params, pid, token);
}

// ── appointment_confirmed ────────────────────────────────────────────────────
// {{1}}=patient, {{2}}=studio, {{3}}=data, {{4}}=trattamento
export async function sendAppointmentConfirmedTemplate(args: {
  to: string;
  patientName: string;
  studioName: string;
  startTime: Date;
  treatmentName: string | null;
  phoneNumberId?: string | null;
}): Promise<TemplateSendResult> {
  const dateStr = formatDateTime(args.startTime);
  const treatment = args.treatmentName ?? "Visita";
  const params = [args.patientName, args.studioName, dateStr, treatment];
  const waMessageId = await sendTemplate(args.to, "appointment_confirmed", params, args.phoneNumberId);
  return {
    templateName: "appointment_confirmed",
    params,
    body: `Ciao ${args.patientName}, il tuo appuntamento presso ${args.studioName} è stato confermato. ${dateStr} — ${treatment}`,
    waMessageId,
  };
}

// ── appointment_cancelled ────────────────────────────────────────────────────
// {{1}}=patient, {{2}}=studio, {{3}}=data
export async function sendAppointmentCancelledTemplate(args: {
  to: string;
  patientName: string;
  studioName: string;
  startTime: Date;
  phoneNumberId?: string | null;
}): Promise<TemplateSendResult> {
  const dateStr = formatDateTime(args.startTime);
  const params = [args.patientName, args.studioName, dateStr];
  const waMessageId = await sendTemplate(args.to, "appointment_cancelled", params, args.phoneNumberId);
  return {
    templateName: "appointment_cancelled",
    params,
    body: `Ciao ${args.patientName}, il tuo appuntamento presso ${args.studioName} del ${dateStr} è stato cancellato.`,
    waMessageId,
  };
}

// ── appointment_reminder_24h ─────────────────────────────────────────────────
// {{1}}=patient, {{2}}=studio, {{3}}=data, {{4}}=trattamento
export async function sendAppointmentReminder24hTemplate(args: {
  to: string;
  patientName: string;
  studioName: string;
  startTime: Date;
  treatmentName: string | null;
  phoneNumberId?: string | null;
}): Promise<TemplateSendResult> {
  const dateStr = formatDateTime(args.startTime);
  const treatment = args.treatmentName ?? "Visita";
  const params = [args.patientName, args.studioName, dateStr, treatment];
  const waMessageId = await sendTemplate(args.to, "appointment_reminder_24h", params, args.phoneNumberId);
  return {
    templateName: "appointment_reminder_24h",
    params,
    body: `Ciao ${args.patientName}, domani hai un appuntamento presso ${args.studioName}. ${dateStr} — ${treatment}`,
    waMessageId,
  };
}

// ── appointment_reminder_2h ──────────────────────────────────────────────────
// {{1}}=patient, {{2}}=data, {{3}}=trattamento, {{4}}=studio
export async function sendAppointmentReminder2hTemplate(args: {
  to: string;
  patientName: string;
  studioName: string;
  startTime: Date;
  treatmentName: string | null;
  phoneNumberId?: string | null;
}): Promise<TemplateSendResult> {
  const dateStr = formatDateTime(args.startTime);
  const treatment = args.treatmentName ?? "Visita";
  const params = [args.patientName, dateStr, treatment, args.studioName];
  const waMessageId = await sendTemplate(args.to, "appointment_reminder_2h", params, args.phoneNumberId);
  return {
    templateName: "appointment_reminder_2h",
    params,
    body: `Ciao ${args.patientName}, il tuo appuntamento di oggi è tra circa 2 ore. ${dateStr} — ${treatment}. ${args.studioName}`,
    waMessageId,
  };
}

// ── recall_reminder_30d ──────────────────────────────────────────────────────
// {{1}}=patient, {{2}}=data, {{3}}=tipo, {{4}}=studio
export async function sendRecallReminder30dTemplate(args: {
  to: string;
  patientName: string;
  recallType: string;
  dueDate: Date;
  studioName: string;
  phoneNumberId?: string | null;
}): Promise<TemplateSendResult> {
  const dateStr = formatDate(args.dueDate);
  const params = [args.patientName, dateStr, args.recallType, args.studioName];
  const waMessageId = await sendTemplate(args.to, "recall_reminder_30d", params, args.phoneNumberId);
  return {
    templateName: "recall_reminder_30d",
    params,
    body: `Ciao ${args.patientName}, tra circa un mese (${dateStr}) è prevista la tua visita di ${args.recallType} presso ${args.studioName}.`,
    waMessageId,
  };
}

// ── recall_reminder_14d ──────────────────────────────────────────────────────
// {{1}}=patient, {{2}}=data, {{3}}=tipo, {{4}}=studio
export async function sendRecallReminder14dTemplate(args: {
  to: string;
  patientName: string;
  recallType: string;
  dueDate: Date;
  studioName: string;
  phoneNumberId?: string | null;
}): Promise<TemplateSendResult> {
  const dateStr = formatDate(args.dueDate);
  const params = [args.patientName, dateStr, args.recallType, args.studioName];
  const waMessageId = await sendTemplate(args.to, "recall_reminder_14d", params, args.phoneNumberId);
  return {
    templateName: "recall_reminder_14d",
    params,
    body: `Ciao ${args.patientName}, tra due settimane (${dateStr}) è prevista la tua visita di ${args.recallType} presso ${args.studioName}.`,
    waMessageId,
  };
}
