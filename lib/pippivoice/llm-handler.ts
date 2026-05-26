import { NextRequest } from "next/server";
import { anthropic } from "@ai-sdk/anthropic";
import { streamText, type CoreMessage } from "ai";
import { db } from "@/lib/db";
import { studios, patients } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildVoiceSystemPrompt } from "./system-prompt";
import { buildVoiceTools } from "./tools";

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
  // Read IDs from (in order): X-* headers, URL query, body
  const studioId =
    req.headers.get("x-studio-id") ??
    url.searchParams.get("studio_id") ??
    body.studio_id ??
    null;
  const patientId =
    req.headers.get("x-patient-id") ??
    url.searchParams.get("patient_id") ??
    body.patient_id ??
    null;

  // Capture a curated list of headers (ignore internal ones) for debug
  const headerSummary: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    if (key.startsWith("x-") || key === "user-agent" || key === "content-type") {
      headerSummary[key] = value.length > 80 ? value.slice(0, 80) + "…" : value;
    }
  });

  console.log("[pippivoice.llm] Request received:", {
    path: url.pathname,
    queryParams: Object.fromEntries(url.searchParams.entries()),
    headers: headerSummary,
    bodyKeys: Object.keys(body),
    studioId,
    patientId,
    messageCount: Array.isArray(body.messages) ? body.messages.length : 0,
    firstMessageRole: body.messages?.[0]?.role,
    bodyPreview: JSON.stringify(body).slice(0, 400),
  });

  if (!studioId || !patientId) {
    console.error("[pippivoice.llm] Missing IDs. Full body:", JSON.stringify(body).slice(0, 1000));
    return jsonError(
      400,
      "Missing studio_id or patient_id (pass as query param or body field)"
    );
  }

  if (studioId.includes("{{") || patientId.includes("{{")) {
    console.error("[pippivoice.llm] Template not substituted:", { studioId, patientId });
    return jsonError(
      400,
      `IDs look like unsubstituted templates (studio_id=${studioId}). ` +
        `Check ElevenLabs Extra Body Params + dynamic variables config.`
    );
  }

  const [studio] = await db
    .select()
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);
  if (!studio) return jsonError(404, `Studio ${studioId} not found`);

  const [patient] = await db
    .select()
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);
  if (!patient) return jsonError(404, `Patient ${patientId} not found`);

  if (patient.studioId !== studio.id) {
    return jsonError(403, "Patient does not belong to this studio");
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

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: systemPrompt,
    messages: coreMessages,
    tools,
    maxSteps: 10,
    temperature: 0.4,
  });

  const responseStream = openaiSseStream(result.textStream, body.model ?? "claude-sonnet-4-6");

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
