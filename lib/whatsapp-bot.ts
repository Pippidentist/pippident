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
 * Capitalizes first letter of each word and collapses extra spaces.
 * "  marco   rossi  " → "Marco Rossi"
 */
function capitalize(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Handles conversational registration for unknown phone numbers.
 * Flow: ask_fullname → ask_email → ask_confirm → ask_consent → create patient.
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

  // No active session → first contact, ask for full name
  if (!session) {
    await db
      .insert(whatsappSessions)
      .values({
        studioId: studio.id,
        phone,
        state: "reg_ask_fullname",
        data: {},
        expiresAt,
      })
      .onConflictDoUpdate({
        target: [whatsappSessions.studioId, whatsappSessions.phone],
        set: { state: "reg_ask_fullname", data: {}, expiresAt, updatedAt: new Date() },
      });

    return (
      `Benvenuto/a su *${studio.name}*! 👋\n\n` +
      `Per poterti assistere al meglio, ho bisogno di registrarti.\n\n` +
      `Come ti chiami? Scrivi *nome e cognome*.`
    );
  }

  const data = (session.data ?? {}) as Record<string, string>;

  // Step 1: got full name → split into firstName + lastName, ask email
  if (session.state === "reg_ask_fullname") {
    const parts = body.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
    if (parts.length < 2) {
      return `Per favore scrivi sia il *nome* che il *cognome* (es. Marco Rossi).`;
    }

    // First word = firstName, rest = lastName (handles compound surnames)
    const firstName = capitalize(parts[0]);
    const lastName = capitalize(parts.slice(1).join(" "));

    await db
      .update(whatsappSessions)
      .set({
        state: "reg_ask_email",
        data: { ...data, firstName, lastName },
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(whatsappSessions.id, session.id));

    return (
      `Grazie *${firstName} ${lastName}*!\n\n` +
      `Qual è il tuo indirizzo *email*?\n` +
      `Se preferisci non fornirlo, scrivi *procedi*.`
    );
  }

  // Step 2: got email (or skip), show summary for confirmation
  if (session.state === "reg_ask_email") {
    const input = body.trim();
    let email: string | undefined;

    if (input.toLowerCase() !== "procedi") {
      // Basic email validation
      if (!input.includes("@") || !input.includes(".")) {
        return `Questo non sembra un indirizzo email valido. Riprova oppure scrivi *procedi* per saltare.`;
      }
      email = input.toLowerCase();
    }

    const firstName = data.firstName ?? "";
    const lastName = data.lastName ?? "";
    const emailLine = email ? `\n📧 Email: ${email}` : "";

    const emailData = email ?? "";

    await db
      .update(whatsappSessions)
      .set({
        state: "reg_ask_consent",
        data: { ...data, email: emailData },
        expiresAt,
        updatedAt: new Date(),
      })
      .where(eq(whatsappSessions.id, session.id));

    const dataList = `nome, cognome, numero di telefono${emailData ? ", email" : ""}`;

    return (
      `📋 *RIEPILOGO DATI*\n\n` +
      `👤 Nome: *${firstName}*\n` +
      `👤 Cognome: *${lastName}*${emailLine}\n` +
      `📱 Telefono: ${phone}\n\n` +
      `─────────────────────\n\n` +
      `📌 *CONSENSO AL TRATTAMENTO DEI DATI PERSONALI*\n\n` +
      `Ai sensi del *Regolamento UE 2016/679 (GDPR)*, i tuoi dati (${dataList}) saranno trattati da *${studio.name}* ESCLUSIVAMENTE per:\n` +
      `• gestire i tuoi appuntamenti\n` +
      `• inviarti comunicazioni e promemoria via WhatsApp\n\n` +
      `I dati non saranno ceduti a terzi.\n\n` +
      `─────────────────────\n\n` +
      `Se i dati sono corretti e accetti il trattamento, scrivi *ACCETTO*.\n` +
      `Se vuoi correggere i dati, scrivi *NO*.`
    );
  }

  // Step 4: consent + confirmation combined
  if (session.state === "reg_ask_consent") {
    const answer = body.trim().toLowerCase();

    if (answer === "no") {
      await db
        .update(whatsappSessions)
        .set({
          state: "reg_ask_fullname",
          data: {},
          expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(whatsappSessions.id, session.id));

      return `Nessun problema, ricominciamo!\n\nCome ti chiami? Scrivi *nome e cognome*.`;
    }

    if (answer !== "accetto") {
      return `Scrivi *ACCETTO* per confermare i dati e il consenso, oppure *NO* per ricominciare.`;
    }

    // Create patient
    const firstName = data.firstName ?? "";
    const lastName = data.lastName ?? "";
    const email = data.email || undefined;

    const [newPatient] = await db
      .insert(patients)
      .values({
        studioId: studio.id,
        firstName,
        lastName,
        phone,
        email: email || null,
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
    `Come ti chiami? Scrivi *nome e cognome*.`
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
    model: anthropic("claude-sonnet-4-6"),
    system: systemPrompt,
    messages,
    tools,
    maxSteps: 10,
  });

  // Log all tool calls for debugging
  for (const step of result.steps) {
    for (const tc of step.toolCalls) {
      console.log(`[pippibot] tool=${tc.toolName} args=${JSON.stringify(tc.args)}`);
    }
    for (const tr of step.toolResults) {
      console.log(`[pippibot] result=${tr.toolName}:`, JSON.stringify(tr.result).substring(0, 200));
    }
  }

  // Safety: if AI claims a booking exists but createBooking was never called,
  // override with an honest response. Cover any wording that implies a booking
  // was saved (confirmed, pending, awaiting staff review, etc.).
  const bookingToolCalled = result.steps.some((step) =>
    step.toolResults.some(
      (tr) => tr.toolName === "createBooking" && (tr.result as Record<string, unknown>)?.success === true
    )
  );
  const textClaimsBooking =
    /prenotazione\s+(creata|confermata|registrata|salvata|effettuata|prenotata|ricevuta|in attesa)/i.test(result.text) ||
    /appuntamento\s+(confermato|creato|registrato|salvato|prenotato|in attesa)/i.test(result.text) ||
    /prenotato con successo/i.test(result.text) ||
    /attesa di conferma/i.test(result.text) ||
    /ID\s+Appuntamento/i.test(result.text);

  if (textClaimsBooking && !bookingToolCalled) {
    console.warn("[pippibot] AI hallucinated booking success — overriding response");
    return toWhatsAppFormat(
      "Mi scuso, c'è stato un problema tecnico nella creazione dell'appuntamento. " +
      "Puoi ripetere la richiesta? Dimmi giorno e orario e riprovo subito."
    );
  }

  const rawText = result.text || "Non sono riuscito a elaborare la risposta. Riprova.";

  return toWhatsAppFormat(rawText);
}
