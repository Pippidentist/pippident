import { db } from "@/lib/db";
import { studios, patients, whatsappMessages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/**
 * Handles all incoming WhatsApp messages.
 *
 * Routing logic:
 *  - Unknown patient  → link to registration page
 *  - Known patient    → link to Pippibot chat
 *
 * All other conversation happens inside Pippibot (/chat).
 */
export async function handleIncomingMessage(params: {
  fromPhone: string; // normalized: "+393331234567"
  toPhone: string;   // studio's Twilio number: "whatsapp:+14155238886"
  body: string;
  waMessageId: string;
}): Promise<string> {
  const { fromPhone, toPhone, body, waMessageId } = params;

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://pippident.vercel.app";

  // 1. Identify studio by its Twilio number
  const [studio] = await db
    .select({ id: studios.id, name: studios.name })
    .from(studios)
    .where(eq(studios.twilioPhoneFrom, toPhone))
    .limit(1);

  if (!studio) {
    return "Servizio non disponibile al momento.";
  }

  // 2. Look up patient by phone
  const [patient] = await db
    .select({ id: patients.id, firstName: patients.firstName })
    .from(patients)
    .where(
      and(
        eq(patients.studioId, studio.id),
        eq(patients.phone, fromPhone),
        eq(patients.isArchived, false)
      )
    )
    .limit(1);

  // 3. Log inbound message
  await db.insert(whatsappMessages).values({
    studioId: studio.id,
    patientId: patient?.id ?? undefined,
    direction: "inbound",
    messageType: "generic",
    body,
    status: "sent",
    waMessageId,
  });

  // 4. Route
  if (!patient) {
    // New patient → registration link
    const registrationUrl = `${baseUrl}/register/${studio.id}`;
    return (
      `Benvenuto/a su *${studio.name}*! 👋\n\n` +
      `Per accedere ai nostri servizi online è necessario registrarsi.\n\n` +
      `📋 Compila il modulo di registrazione:\n${registrationUrl}\n\n` +
      `Una volta registrato potrai prenotare e gestire i tuoi appuntamenti direttamente da qui.`
    );
  }

  // Known patient → Pippibot chat link
  const chatUrl = `${baseUrl}/chat?studioId=${studio.id}&phone=${encodeURIComponent(fromPhone)}`;
  return (
    `Ciao ${patient.firstName}! 👋\n\n` +
    `Accedi alla chat con il nostro assistente virtuale per prenotare o gestire i tuoi appuntamenti:\n\n` +
    `💬 ${chatUrl}`
  );
}
