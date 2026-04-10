import { db } from "@/lib/db";
import {
  studios,
  patients,
  whatsappMessages,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// ── Main handler ──────────────────────────────────────────────────────────────

export async function handleIncomingMessage(params: {
  fromPhone: string;  // normalized: "+393331234567"
  toPhone: string;    // "whatsapp:+14155238886" (the studio's number)
  body: string;
  waMessageId: string;
}): Promise<string> {
  const { fromPhone, toPhone, body, waMessageId } = params;

  // 1. Find studio by its Twilio number
  const [studio] = await db
    .select({ id: studios.id, name: studios.name, twilioPhoneFrom: studios.twilioPhoneFrom })
    .from(studios)
    .where(eq(studios.twilioPhoneFrom, toPhone))
    .limit(1);

  if (!studio) {
    return "Servizio non disponibile.";
  }

  // 2. Log inbound message (patientId will be null if unknown)
  const [existingPatient] = await db
    .select({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName })
    .from(patients)
    .where(and(eq(patients.studioId, studio.id), eq(patients.phone, fromPhone)))
    .limit(1);

  await db.insert(whatsappMessages).values({
    studioId: studio.id,
    patientId: existingPatient?.id ?? undefined,
    direction: "inbound",
    messageType: "generic",
    body,
    status: "sent",
    waMessageId,
  });

  // 3. Unknown patient → send registration link
  if (!existingPatient) {
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://pippident.vercel.app";
    const registrationUrl = `${baseUrl}/register/${studio.id}`;
    return (
      `Benvenuto/a su *${studio.name}*! 👋\n\n` +
      `Per poter accedere ai servizi del bot (appuntamenti, promemoria, ecc.) è necessario registrarsi.\n\n` +
      `📋 Compila il modulo di registrazione al seguente link:\n${registrationUrl}\n\n` +
      `Una volta completata la registrazione potrai scrivere qui per gestire i tuoi appuntamenti.`
    );
  }

  // 4. Known patient → send AI chatbot link
  const patientName = `${existingPatient.firstName} ${existingPatient.lastName}`;
  const baseUrl = process.env.NEXTAUTH_URL ?? "https://pippident.vercel.app";
  const chatUrl = `${baseUrl}/chat/${studio.id}?phone=${encodeURIComponent(fromPhone)}`;

  return (
    `Ciao ${patientName}! 👋\n\n` +
    `Per gestire i suoi appuntamenti, parlare con il nostro assistente virtuale o avere informazioni sullo studio, usi il seguente link:\n\n` +
    `🤖 ${chatUrl}\n\n` +
    `L'assistente è disponibile 24/7 e potrà aiutarla a prenotare, consultare o cancellare appuntamenti.`
  );
}
