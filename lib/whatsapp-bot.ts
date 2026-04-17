import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { db } from "@/lib/db";
import { studios, patients, whatsappMessages } from "@/lib/db/schema";
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

  const baseUrl = process.env.NEXTAUTH_URL ?? "https://pippident.vercel.app";

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

  // 4. Unknown patient → registration link (no AI)
  if (!patient) {
    const registrationUrl = `${baseUrl}/register/${studio.id}`;
    return (
      `Benvenuto/a su *${studio.name}*! 👋\n\n` +
      `Per accedere ai nostri servizi online è necessario registrarsi.\n\n` +
      `📋 Compila il modulo di registrazione:\n${registrationUrl}\n\n` +
      `Una volta registrato potrai prenotare e gestire i tuoi appuntamenti direttamente da qui.`
    );
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
