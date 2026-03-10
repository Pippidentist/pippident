import twilio from "twilio";
import { format } from "date-fns";
import { it } from "date-fns/locale";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const defaultFrom = process.env.TWILIO_WHATSAPP_FROM ?? "whatsapp:+14155238886";

function getClient() {
  if (!accountSid || !authToken) {
    throw new Error("TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN sono richiesti");
  }
  return twilio(accountSid, authToken);
}

export function getTwilioAuthToken(): string {
  return authToken ?? "";
}

export async function sendWhatsAppMessage(to: string, body: string, from?: string): Promise<string> {
  const client = getClient();
  const normalizedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const sender = from ?? defaultFrom;
  const message = await client.messages.create({ from: sender, to: normalizedTo, body });
  return message.sid;
}

// ── Message builders ──────────────────────────────────────────────────────────

export function buildRecallMessage(patientName: string, recallType: string, dueDate: string): string {
  return (
    `Gentile ${patientName}, è giunto il momento di programmare la sua visita di ${recallType}.\n\n` +
    `Data consigliata: ${dueDate}\n\n` +
    `La invitiamo a contattarci per fissare un appuntamento. A presto!`
  );
}

export function buildWelcomeMessage(patientName: string, studioName: string): string {
  return (
    `Benvenuto/a da ${studioName}! 🦷\n\n` +
    `Ciao ${patientName}, il suo profilo è stato registrato nel nostro sistema.\n\n` +
    `Da qui può:\n` +
    `📅 *APPUNTAMENTI* – vedere i prossimi appuntamenti\n` +
    `❌ *ANNULLA* – cancellare un appuntamento\n` +
    `ℹ️ *AIUTO* – mostrare questo menu`
  );
}

export function buildHelpMenu(patientName: string): string {
  return (
    `Ciao ${patientName}! Come posso aiutarti?\n\n` +
    `📅 *APPUNTAMENTI* – vedere i prossimi appuntamenti\n` +
    `❌ *ANNULLA* – cancellare un appuntamento\n` +
    `ℹ️ *AIUTO* – mostrare questo menu`
  );
}

export interface AppointmentEntry {
  id: string;
  startTime: Date;
  treatmentName: string | null;
  dentistName: string | null;
}

export function buildAppointmentListMessage(appointments: AppointmentEntry[]): string {
  if (appointments.length === 0) {
    return "Non ha nessun appuntamento programmato nei prossimi 60 giorni.";
  }
  const lines = appointments.map((a, i) => {
    const dateStr = format(a.startTime, "EEEE d MMMM 'alle' HH:mm", { locale: it });
    const treatment = a.treatmentName ?? "Visita";
    const dentist = a.dentistName ? ` con ${a.dentistName}` : "";
    return `${i + 1}. ${dateStr} – ${treatment}${dentist}`;
  });
  return (
    `📅 *I suoi prossimi appuntamenti:*\n\n` +
    lines.join("\n") +
    `\n\nPer cancellare, risponda *ANNULLA*.`
  );
}

export function buildCancellationListMessage(appointments: AppointmentEntry[]): string {
  if (appointments.length === 0) {
    return "Non ha nessun appuntamento futuro da cancellare.";
  }
  const lines = appointments.map((a, i) => {
    const dateStr = format(a.startTime, "EEEE d MMMM 'alle' HH:mm", { locale: it });
    const treatment = a.treatmentName ?? "Visita";
    return `${i + 1}. ${dateStr} – ${treatment}`;
  });
  return (
    `Quale appuntamento vuole cancellare?\n\n` +
    lines.join("\n") +
    `\n\nRisponda con il numero (es. *1*) oppure *MENU* per annullare.`
  );
}

export function buildCancellationConfirmMessage(startTime: Date): string {
  const dateStr = format(startTime, "EEEE d MMMM 'alle' HH:mm", { locale: it });
  return `✅ Appuntamento di ${dateStr} cancellato con successo.`;
}

export function buildReminderMessage(
  patientName: string,
  studioName: string,
  startTime: Date,
  treatmentName: string | null,
  dentistName: string | null,
  hoursAhead: 48 | 2
): string {
  const dateStr = format(startTime, "EEEE d MMMM 'alle' HH:mm", { locale: it });
  const treatment = treatmentName ?? "Visita";
  const dentist = dentistName ? `\nDentista: ${dentistName}` : "";

  if (hoursAhead === 48) {
    return (
      `Gentile ${patientName}, le ricordiamo che *domani* ha un appuntamento presso ${studioName}.\n\n` +
      `🗓 ${dateStr}\n` +
      `🦷 ${treatment}${dentist}\n\n` +
      `Per cancellare risponda *ANNULLA*.`
    );
  }
  return (
    `Gentile ${patientName}, il suo appuntamento di oggi è tra circa *2 ore*.\n\n` +
    `🗓 ${dateStr}\n` +
    `🦷 ${treatment}${dentist}\n\n` +
    `A presto da ${studioName}!`
  );
}

export function buildRegistrationPromptName(studioName: string): string {
  return (
    `Benvenuto/a da ${studioName}! 🦷\n\n` +
    `Non ho trovato il suo profilo. Vuole registrarsi?\n\n` +
    `Per iniziare, mi scriva il suo *nome e cognome* (es: Mario Rossi).`
  );
}

export function buildRegistrationConfirmMessage(firstName: string, lastName: string): string {
  return (
    `Ho capito: *${firstName} ${lastName}*. È corretto?\n\n` +
    `Risponda *SI* per confermare o *NO* per ricominciare.`
  );
}
