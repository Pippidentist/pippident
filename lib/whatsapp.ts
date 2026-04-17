import { sendMetaWhatsAppMessage } from "@/lib/meta-whatsapp";
import { format } from "date-fns";
import { it } from "date-fns/locale";

/**
 * Sends a WhatsApp message via Meta Cloud API.
 * @param to - recipient phone number (any format: "+393...", "393...", etc.)
 * @param body - message text
 * @param phoneNumberId - Meta phone number ID (defaults to META_PHONE_NUMBER_ID env var)
 */
export async function sendWhatsAppMessage(
  to: string,
  body: string,
  phoneNumberId?: string
): Promise<string> {
  const pid = phoneNumberId ?? process.env.META_PHONE_NUMBER_ID ?? "";
  const token = process.env.META_WHATSAPP_TOKEN ?? "";

  if (!pid || !token) {
    throw new Error("META_PHONE_NUMBER_ID e META_WHATSAPP_TOKEN sono richiesti");
  }

  return sendMetaWhatsAppMessage(to, body, pid, token);
}

// ── Message builders ──────────────────────────────────────────────────────────

export function buildRecallMessage(patientName: string, recallType: string, dueDate: string): string {
  return (
    `Gentile ${patientName}, è giunto il momento di programmare la sua visita di ${recallType}.\n\n` +
    `Data consigliata: ${dueDate}\n\n` +
    `La invitiamo a contattarci per fissare un appuntamento. A presto!`
  );
}

export function buildRecallReminderMessage(
  patientName: string,
  recallType: string,
  dueDate: Date,
  studioName: string,
  daysBefore: 30 | 14
): string {
  const dateStr = format(dueDate, "EEEE d MMMM", { locale: it });
  if (daysBefore === 30) {
    return (
      `Gentile ${patientName}, tra circa *un mese* (${dateStr}) è prevista la sua visita di *${recallType}* presso ${studioName}.\n\n` +
      `Per prenotare l'appuntamento risponda a questo messaggio. A presto! 🦷`
    );
  }
  return (
    `Gentile ${patientName}, le ricordiamo che tra *due settimane* (${dateStr}) è prevista la sua visita di *${recallType}* presso ${studioName}.\n\n` +
    `Se non ha ancora prenotato, risponda a questo messaggio per fissare un orario.`
  );
}

export function buildAppointmentConfirmedMessage(
  patientName: string,
  studioName: string,
  startTime: Date,
  treatmentName: string | null,
  dentistName: string | null
): string {
  const dateStr = format(startTime, "EEEE d MMMM 'alle' HH:mm", { locale: it });
  const treatment = treatmentName ?? "Visita";
  const dentist = dentistName ? `\n👨‍⚕️ ${dentistName}` : "";
  return (
    `Gentile ${patientName}, il suo appuntamento presso ${studioName} è stato *confermato* ✅\n\n` +
    `🗓 ${dateStr}\n` +
    `🦷 ${treatment}${dentist}\n\n` +
    `La aspettiamo! Per cancellare o modificare risponda a questo messaggio.`
  );
}

export function buildAppointmentCancelledMessage(
  patientName: string,
  studioName: string,
  startTime: Date,
  reason?: string | null
): string {
  const dateStr = format(startTime, "EEEE d MMMM 'alle' HH:mm", { locale: it });
  const reasonLine = reason ? `\n\n_Motivo: ${reason}_` : "";
  return (
    `Gentile ${patientName}, l'appuntamento presso ${studioName} del *${dateStr}* è stato *cancellato*.${reasonLine}\n\n` +
    `Per prenotare una nuova visita risponda a questo messaggio.`
  );
}

export function buildWelcomeMessage(patientName: string, studioName: string): string {
  return (
    `Benvenuto/a da ${studioName}! 🦷\n\n` +
    `Ciao ${patientName}, il suo profilo è stato registrato nel nostro sistema.\n\n` +
    `Da qui può prenotare e gestire i suoi appuntamenti direttamente su WhatsApp.`
  );
}

export interface AppointmentEntry {
  id: string;
  startTime: Date;
  treatmentName: string | null;
  dentistName: string | null;
}

export function buildReminderMessage(
  patientName: string,
  studioName: string,
  startTime: Date,
  treatmentName: string | null,
  dentistName: string | null,
  hoursAhead: 24 | 2
): string {
  const dateStr = format(startTime, "EEEE d MMMM 'alle' HH:mm", { locale: it });
  const treatment = treatmentName ?? "Visita";
  const dentist = dentistName ? `\nDentista: ${dentistName}` : "";

  if (hoursAhead === 24) {
    return (
      `Gentile ${patientName}, le ricordiamo che *domani* ha un appuntamento presso ${studioName}.\n\n` +
      `🗓 ${dateStr}\n` +
      `🦷 ${treatment}${dentist}\n\n` +
      `Per cancellare risponda alla chat.`
    );
  }
  return (
    `Gentile ${patientName}, il suo appuntamento di oggi è tra circa *2 ore*.\n\n` +
    `🗓 ${dateStr}\n` +
    `🦷 ${treatment}${dentist}\n\n` +
    `A presto da ${studioName}!`
  );
}

