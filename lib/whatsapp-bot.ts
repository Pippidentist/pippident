import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { db } from "@/lib/db";
import { studios, patients, whatsappMessages, whatsappSessions } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { buildSystemPrompt } from "@/lib/pippibot/system-prompt";
import { buildTools } from "@/lib/pippibot/tools";
import type { CoreMessage } from "ai";

/** Strips all non-digit chars from a phone number for loose comparison */
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Convert AI markdown to WhatsApp formatting */
function toWhatsAppFormat(text: string): string {
  return text
    // **bold** → *bold*
    .replace(/\*\*(.+?)\*\*/g, "*$1*")
    // Remove ### headings markup, keep text
    .replace(/^#{1,3}\s+/gm, "")
    // Remove ``` code blocks, keep content
    .replace(/```[\s\S]*?```/g, (match) =>
      match.replace(/```\w*\n?/g, "").trim()
    );
}

/** Max conversation history messages to load (keeps token usage reasonable) */
const MAX_HISTORY_MESSAGES = 30;

/**
 * Handles all incoming WhatsApp messages (Meta Cloud API).
 *
 * Routing:
 *  - Unknown patient  → registration link
 *  - Known patient    → AI agent (Pippibot) responds directly
 */
export async function handleIncomingMessage(params: {
  fromPhone: string;     // normalized: "+393331234567"
  phoneNumberId: string; // Meta phone number ID of the studio's number
  body: string;
  waMessageId: string;
}): Promise<string> {
  const { fromPhone, phoneNumberId, body, waMessageId } = params;

  // 1. Identify studio by its Meta phone number ID
  const [studio] = await db
    .select()
    .from(studios)
    .where(eq(studios.whatsappPhoneNumberId, phoneNumberId))
    .limit(1);

  if (!studio) {
    console.error("[whatsapp-bot] No studio found for phoneNumberId:", phoneNumberId);
    return "Servizio non disponibile al momento.";
  }

  // 2. Look up patient by phone (digits-only comparison)
  const fromDigits = digitsOnly(fromPhone);

  const allPatients = await db
    .select()
    .from(patients)
    .where(
      and(
        eq(patients.studioId, studio.id),
        eq(patients.isArchived, false)
      )
    );

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

  // 4. Unknown patient → conversational registration via WhatsApp
  if (!patient) {
    return handleRegistration(studio, fromPhone, body);
  }

  // 5. Known patient → Run AI agent
  try {
    const replyText = await runPippibotAgent(studio, patient, body);

    // Log outbound AI response
    await db.insert(whatsappMessages).values({
      studioId: studio.id,
      patientId: patient.id,
      direction: "outbound",
      messageType: "generic",
      body: replyText,
      status: "sent",
    });

    return replyText;
  } catch (err) {
    console.error("[whatsapp-bot] AI agent error:", err);
    return "Si è verificato un errore. Riprova tra qualche minuto.";
  }
}

/** Session expiry: 1 hour */
const SESSION_TTL_MS = 60 * 60 * 1000;

/**
 * Handles conversational registration for unknown phone numbers.
 * Flow: ask_name → ask_surname → ask_consent → create patient.
 */
async function handleRegistration(
  studio: typeof studios.$inferSelect,
  phone: string,
  body: string
): Promise<string> {
  // Load or create session
  const [existing] = await db
    .select()
    .from(whatsappSessions)
    .where(
      and(
        eq(whatsappSessions.studioId, studio.id),
        eq(whatsappSessions.phone, phone)
      )
    )
    .limit(1);

  // If session expired, delete it and start fresh
  if (existing && existing.expiresAt < new Date()) {
    await db.delete(whatsappSessions).where(eq(whatsappSessions.id, existing.id));
  }

  const session = existing && existing.expiresAt >= new Date() ? existing : null;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  // No active session → first contact, ask for name
  if (!session) {
    await db
      .insert(whatsappSessions)
      .values({
        studioId: studio.id,
        phone,
        state: "reg_ask_name",
        data: {},
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [whatsappSessions.studioId, whatsappSessions.phone],
        set: { state: "reg_ask_name", data: {}, expiresAt, updatedAt: new Date() },
      });

    return (
      `Benvenuto/a su *${studio.name}*! 👋\n\n` +
      `Per poterti assistere al meglio, ho bisogno di registrarti.\n\n` +
      `Qual è il tuo *nome*?`
    );
  }

  const data = (session.data ?? {}) as Record<string, string>;

  // Step 1: got name, ask surname
  if (session.state === "reg_ask_name") {
    const firstName = body.trim();
    if (!firstName) {
      return "Per favore, scrivi il tuo *nome*.";
    }

    await db
      .update(whatsappSessions)
      .set({
        state: "reg_ask_surname",
        data: { ...data, firstName },
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(whatsappSessions.id, session.id));

    return `Grazie *${firstName}*! Qual è il tuo *cognome*?`;
  }

  // Step 2: got surname, ask consent
  if (session.state === "reg_ask_surname") {
    const lastName = body.trim();
    if (!lastName) {
      return "Per favore, scrivi il tuo *cognome*.";
    }

    await db
      .update(whatsappSessions)
      .set({
        state: "reg_ask_consent",
        data: { ...data, lastName },
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(whatsappSessions.id, session.id));

    return (
      `Perfetto, *${data.firstName} ${lastName}*!\n\n` +
      `Per completare la registrazione, devo chiederti di accettare il trattamento ` +
      `dei tuoi dati personali (nome, cognome, numero di telefono) ai sensi del GDPR, ` +
      `per permetterci di gestire i tuoi appuntamenti e inviarti comunicazioni via WhatsApp.\n\n` +
      `Scrivi *accetto* per confermare.`
    );
  }

  // Step 3: waiting for consent
  if (session.state === "reg_ask_consent") {
    const answer = body.trim().toLowerCase();

    if (answer !== "accetto") {
      return `Per completare la registrazione, scrivi *accetto*.\n\nSe non vuoi procedere, ignora questo messaggio.`;
    }

    // Create patient
    const firstName = data.firstName ?? "";
    const lastName = data.lastName ?? "";

    const [newPatient] = await db
      .insert(patients)
      .values({
        studioId: studio.id,
        firstName,
        lastName,
        phone,
        gdprConsent: true,
        gdprConsentDate: new Date(),
      })
      .returning({ id: patients.id });

    // Delete session
    await db.delete(whatsappSessions).where(eq(whatsappSessions.id, session.id));

    // Log registration outbound message
    await db.insert(whatsappMessages).values({
      studioId: studio.id,
      patientId: newPatient.id,
      direction: "outbound",
      messageType: "generic",
      body: `Registrazione completata per ${firstName} ${lastName}`,
      status: "sent",
    });

    return (
      `Registrazione completata! ✅\n\n` +
      `Benvenuto/a *${firstName} ${lastName}* nello studio *${studio.name}*.\n\n` +
      `Da ora puoi scrivermi per prenotare appuntamenti e ricevere informazioni. Come posso aiutarti?`
    );
  }

  // Unknown state → reset session
  await db.delete(whatsappSessions).where(eq(whatsappSessions.id, session.id));
  return (
    `Benvenuto/a su *${studio.name}*! 👋\n\n` +
    `Per poterti assistere al meglio, ho bisogno di registrarti.\n\n` +
    `Qual è il tuo *nome*?`
  );
}

/**
 * Runs the Pippibot AI agent for a known patient.
 * Loads conversation history from DB, runs generateText with tools,
 * and returns the text response formatted for WhatsApp.
 */
async function runPippibotAgent(
  studio: typeof studios.$inferSelect,
  patient: typeof patients.$inferSelect,
  currentMessage: string
): Promise<string> {
  // Load recent conversation history from DB
  const history = await db
    .select({
      direction: whatsappMessages.direction,
      body: whatsappMessages.body,
    })
    .from(whatsappMessages)
    .where(
      and(
        eq(whatsappMessages.studioId, studio.id),
        eq(whatsappMessages.patientId, patient.id)
      )
    )
    .orderBy(desc(whatsappMessages.sentAt))
    .limit(MAX_HISTORY_MESSAGES);

  // Reverse to chronological order (oldest first), skip the message we just inserted
  const chronological = history.reverse().slice(0, -1);

  // Convert DB messages to CoreMessage format
  const messages: CoreMessage[] = chronological
    .filter((m) => m.body) // skip empty bodies
    .map((m) => ({
      role: m.direction === "inbound" ? "user" as const : "assistant" as const,
      content: m.body!,
    }));

  // Add current message
  messages.push({ role: "user", content: currentMessage });

  // Build system prompt and tools
  const systemPrompt = buildSystemPrompt(studio, patient);
  const tools = buildTools(studio, patient);

  // Run AI
  const result = await generateText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 5,
  });

  const rawText = result.text || "Non sono riuscito a elaborare la risposta. Riprova.";

  return toWhatsAppFormat(rawText);
}
