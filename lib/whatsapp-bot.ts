import { db } from "@/lib/db";
import { studios, patients, whatsappMessages } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

/** Strips all non-digit chars from a phone number for loose comparison */
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/**
 * Handles all incoming WhatsApp messages (Meta Cloud API).
 *
 * Routing logic:
 *  - Unknown patient  → link to registration page
 *  - Known patient    → link to Pippibot chat
 */
export async function handleIncomingMessage(params: {
  fromPhone: string;    // normalized: "+393331234567"
  phoneNumberId: string; // Meta phone number ID of the studio's number
  body: string;
  waMessageId: string;
}): Promise<string> {
  const { fromPhone, phoneNumberId, body, waMessageId } = params;

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://pippident.vercel.app";

  // 1. Identify studio by its Meta phone number ID
  const [studio] = await db
    .select({ id: studios.id, name: studios.name })
    .from(studios)
    .where(eq(studios.whatsappPhoneNumberId, phoneNumberId))
    .limit(1);

  if (!studio) {
    console.error("[whatsapp-bot] No studio found for phoneNumberId:", phoneNumberId);
    return "Servizio non disponibile al momento.";
  }

  // 2. Look up patient by phone — normalize both sides to digits only
  // Handles: "+393483774452" == "3483774452" == "+39 348 377 4452" etc.
  const fromDigits = digitsOnly(fromPhone);

  const allPatients = await db
    .select({ id: patients.id, firstName: patients.firstName, phone: patients.phone })
    .from(patients)
    .where(
      and(
        eq(patients.studioId, studio.id),
        eq(patients.isArchived, false)
      )
    );

  // Match by comparing trailing digits (handles +39 prefix differences)
  const patient = allPatients.find((p) => {
    const pDigits = digitsOnly(p.phone);
    return (
      pDigits === fromDigits ||
      pDigits === fromDigits.replace(/^39/, "") ||
      fromDigits === pDigits.replace(/^39/, "")
    );
  });

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
