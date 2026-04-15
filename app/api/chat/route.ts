import { NextRequest, NextResponse } from "next/server";
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { db } from "@/lib/db";
import { studios, patients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { buildSystemPrompt } from "@/lib/pippibot/system-prompt";
import { buildTools } from "@/lib/pippibot/tools";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { messages, phone, studioId } = body as {
    messages: unknown[];
    phone: string;
    studioId: string;
  };

  if (!phone || !studioId) {
    return NextResponse.json(
      { error: "Parametri mancanti: phone e studioId sono obbligatori" },
      { status: 400 }
    );
  }

  // Validate studio exists and is active
  const [studio] = await db
    .select()
    .from(studios)
    .where(and(eq(studios.id, studioId), eq(studios.isActive, true)))
    .limit(1);

  if (!studio) {
    return NextResponse.json({ error: "Studio non trovato" }, { status: 404 });
  }

  // Validate patient belongs to this studio (security check)
  const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;
  const [patient] = await db
    .select()
    .from(patients)
    .where(
      and(
        eq(patients.studioId, studioId),
        eq(patients.phone, normalizedPhone),
        eq(patients.isArchived, false)
      )
    )
    .limit(1);

  if (!patient) {
    return NextResponse.json(
      {
        error:
          "Paziente non trovato. Per accedere al servizio è necessario registrarsi prima.",
      },
      { status: 403 }
    );
  }

  const systemPrompt = buildSystemPrompt(studio, patient);
  const tools = buildTools(studio, patient);

  const result = streamText({
    model: anthropic("claude-haiku-4-5-20251001"),
    system: systemPrompt,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: messages as any,
    tools,
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
