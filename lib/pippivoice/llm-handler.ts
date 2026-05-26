import { NextRequest } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { streamText, type CoreMessage } from "ai";
import { db } from "@/lib/db";
import { studios, patients, type Studio, type Patient } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { buildVoiceSystemPrompt } from "./system-prompt";
import { buildVoiceTools } from "./tools";

/** Strips non-digit chars for loose phone comparison */
function digitsOnly(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Loose phone match — handles +39 prefix variations and formatting */
function phonesMatch(a: string, b: string): boolean {
  const da = digitsOnly(a);
  const db_ = digitsOnly(b);
  if (!da || !db_) return false;
  return da === db_ || da === db_.replace(/^39/, "") || db_ === da.replace(/^39/, "");
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  name?: string;
  tool_call_id?: string;
}

interface ChatCompletionRequest {
  model?: string;
  messages: OpenAIMessage[];
  stream?: boolean;
  studio_id?: string;
  patient_id?: string;
}

export async function handleChatCompletions(req: NextRequest): Promise<Response> {
  let body: ChatCompletionRequest;
  let rawBody = "";
  try {
    rawBody = await req.text();
    body = JSON.parse(rawBody);
  } catch {
    console.error("[pippivoice.llm] Invalid JSON. Raw body:", rawBody.slice(0, 500));
    return jsonError(400, "Invalid JSON body");
  }

  const url = new URL(req.url);
  const firstNonEmpty = (...vals: Array<string | null | undefined>) =>
    vals.find((v) => typeof v === "string" && v.trim().length > 0 && !v.includes("{{")) ?? null;

  // ── Identification inputs, in precedence order ─────────────────────────────
  // Browser test (widget passes dynamic variables) sets X-Studio-Id/X-Patient-Id.
  // Phone calls (Twilio via ElevenLabs) set X-Called-Number/X-Caller-Id.
  // Env vars are last-resort fallback for dev.
  const explicitStudioId = firstNonEmpty(
    req.headers.get("x-studio-id"),
    url.searchParams.get("studio_id"),
    body.studio_id
  );
  const explicitPatientId = firstNonEmpty(
    req.headers.get("x-patient-id"),
    url.searchParams.get("patient_id"),
    body.patient_id
  );
  const calledNumber = firstNonEmpty(req.headers.get("x-called-number"));
  const callerId = firstNonEmpty(req.headers.get("x-caller-id"));

  const headerSummary: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (key.startsWith("x-") || key === "user-agent" || key === "content-type") {
      headerSummary[key] = value.length > 80 ? value.slice(0, 80) + "…" : value;
    }
  });

  // ── Resolve studio ─────────────────────────────────────────────────────────
  let studio: Studio | null = null;
  let studioResolution = "none";
  if (explicitStudioId) {
    const [row] = await db.select().from(studios).where(eq(studios.id, explicitStudioId)).limit(1);
    if (row) {
      studio = row;
      studioResolution = "explicit-id";
    }
  }
  if (!studio && calledNumber) {
    const [row] = await db
      .select()
      .from(studios)
      .where(eq(studios.voicePhoneNumber, calledNumber))
      .limit(1);
    if (row) {
      studio = row;
      studioResolution = "called-number";
    }
  }
  if (!studio && process.env.PIPPIVOICE_DEFAULT_STUDIO_ID) {
    const [row] = await db
      .select()
      .from(studios)
      .where(eq(studios.id, process.env.PIPPIVOICE_DEFAULT_STUDIO_ID))
      .limit(1);
    if (row) {
      studio = row;
      studioResolution = "env-default";
    }
  }

  // ── Resolve patient (within studio) ────────────────────────────────────────
  let patient: Patient | null = null;
  let patientResolution = "none";
  if (studio && explicitPatientId) {
    const [row] = await db
      .select()
      .from(patients)
      .where(and(eq(patients.id, explicitPatientId), eq(patients.studioId, studio.id)))
      .limit(1);
    if (row) {
      patient = row;
      patientResolution = "explicit-id";
    }
  }
  if (!patient && studio && callerId) {
    const candidates = await db
      .select()
      .from(patients)
      .where(and(eq(patients.studioId, studio.id), eq(patients.isArchived, false)));
    const match = candidates.find((p) => phonesMatch(p.phone, callerId));
    if (match) {
      patient = match;
      patientResolution = "caller-id";
    }
  }
  if (!patient && studio && process.env.PIPPIVOICE_DEFAULT_PATIENT_ID) {
    const [row] = await db
      .select()
      .from(patients)
      .where(and(eq(patients.id, process.env.PIPPIVOICE_DEFAULT_PATIENT_ID), eq(patients.studioId, studio.id)))
      .limit(1);
    if (row) {
      patient = row;
      patientResolution = "env-default";
    }
  }

  console.log("[pippivoice.llm] Request received:", {
    path: url.pathname,
    headers: headerSummary,
    bodyKeys: Object.keys(body),
    explicitStudioId,
    explicitPatientId,
    calledNumber,
    callerId,
    studioResolution,
    patientResolution,
    studio: studio ? { id: studio.id, name: studio.name } : null,
    patient: patient ? { id: patient.id, name: `${patient.firstName} ${patient.lastName}`, phone: patient.phone } : null,
    messageCount: Array.isArray(body.messages) ? body.messages.length : 0,
  });

  if (!studio) {
    return jsonError(
      404,
      `Studio not identified. Tried X-Studio-Id, X-Called-Number (${calledNumber ?? "absent"}), env default. ` +
        `For phone calls, set voicePhoneNumber in studio settings.`
    );
  }
  if (!patient) {
    return jsonError(
      404,
      `Patient not identified for studio ${studio.id}. Tried X-Patient-Id, X-Caller-Id (${callerId ?? "absent"}), env default. ` +
        `For phone calls, register the caller's phone in the patients table.`
    );
  }

  const inboundMessages = Array.isArray(body.messages) ? body.messages : [];
  const coreMessages: CoreMessage[] = inboundMessages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .filter((m) => typeof m.content === "string" && m.content.length > 0)
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content as string,
    }));

  const systemPrompt = buildVoiceSystemPrompt(studio, patient);
  const tools = buildVoiceTools(studio, patient);

  // Default to Haiku 4.5 for voice: ~2-3x faster than Sonnet, plenty smart
  // for the receptionist workflow. Override via PIPPIVOICE_MODEL env var
  // (e.g. "claude-sonnet-4-6") for A/B testing without redeploy.
  const modelId = process.env.PIPPIVOICE_MODEL || "claude-haiku-4-5-20251001";

  // Prompt caching: pin the system message (KB + studio + patient + dates) so
  // it's reused across turns of the same call. After the first turn, Anthropic
  // reads from cache (~10% of normal input cost, ~50-70% less TTFT). System
  // prompt is ~6000 tokens — the dominant cost without caching.
  const messagesWithCachedSystem: CoreMessage[] = [
    {
      role: "system",
      content: systemPrompt,
      providerOptions: {
        anthropic: { cacheControl: { type: "ephemeral" } },
      },
    },
    ...coreMessages,
  ];

  const result = streamText({
    model: anthropic(modelId),
    messages: messagesWithCachedSystem,
    tools,
    maxSteps: 6,        // safe cap; worst case flow is 3 tool calls
    maxTokens: 300,     // voice replies are 1-2 short sentences; cap prevents runaway prose
    temperature: 0.4,
  });

  const responseStream = openaiSseStream(result.textStream, body.model ?? modelId);

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function openaiSseStream(
  textStream: AsyncIterable<string>,
  model: string
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const id = `chatcmpl-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);

  const chunk = (delta: object, finishReason: string | null = null) =>
    `data: ${JSON.stringify({
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [{ index: 0, delta, finish_reason: finishReason }],
    })}\n\n`;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(chunk({ role: "assistant", content: "" })));

        for await (const text of textStream) {
          if (!text) continue;
          controller.enqueue(encoder.encode(chunk({ content: text })));
        }

        controller.enqueue(encoder.encode(chunk({}, "stop")));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        console.error("[pippivoice.llm] stream error:", err);
        controller.enqueue(
          encoder.encode(
            chunk(
              {
                content:
                  " Mi scusi, ho avuto un problema tecnico. Può ripetere per favore?",
              },
              "stop"
            )
          )
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function healthResponse(): Response {
  return new Response(
    JSON.stringify({
      ok: true,
      service: "pippivoice-llm",
      message:
        "POST OpenAI-compatible chat completions to /api/pippivoice/llm/chat/completions with studio_id and patient_id",
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
