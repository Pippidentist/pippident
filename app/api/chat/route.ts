import { NextRequest, NextResponse } from "next/server";
import { streamText, convertToCoreMessages } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { db } from "@/lib/db";
import { studios, patients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { buildSystemPrompt } from "@/lib/pippibot/system-prompt";
import { buildTools } from "@/lib/pippibot/tools";
import type { Message } from "@ai-sdk/react";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, phone, studioId } = body as {
      messages: Message[];
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
      console.error("[Pippibot] Studio non trovato:", studioId);
      return NextResponse.json({ error: "Studio non trovato" }, { status: 404 });
    }

    // Normalize phone: strip spaces, ensure leading +
    const normalizedPhone = phone.trim().startsWith("+")
      ? phone.trim()
      : `+${phone.trim()}`;

    // Find patient — try exact match first, then strip country prefix fallback
    let patient = (
      await db
        .select()
        .from(patients)
        .where(
          and(
            eq(patients.studioId, studioId),
            eq(patients.phone, normalizedPhone),
            eq(patients.isArchived, false)
          )
        )
        .limit(1)
    )[0];

    // Fallback: sometimes phones are stored without +39 prefix
    if (!patient) {
      const phoneWithout39 = normalizedPhone.replace(/^\+39/, "");
      patient = (
        await db
          .select()
          .from(patients)
          .where(
            and(
              eq(patients.studioId, studioId),
              eq(patients.phone, phoneWithout39),
              eq(patients.isArchived, false)
            )
          )
          .limit(1)
      )[0];
    }

    if (!patient) {
      console.error("[Pippibot] Paziente non trovato per phone:", normalizedPhone, "studioId:", studioId);
      return NextResponse.json(
        { error: "Paziente non trovato. Registrati prima tramite il link dello studio." },
        { status: 403 }
      );
    }

    const systemPrompt = buildSystemPrompt(studio, patient);
    const tools = buildTools(studio, patient);

    // Convert UI messages (from useChat) to Core messages (for streamText)
    const coreMessages = convertToCoreMessages(messages ?? []);

    const result = streamText({
      model: anthropic("claude-sonnet-4-6"),
      system: systemPrompt,
      messages: coreMessages,
      tools,
      maxSteps: 5,
      onError: ({ error }) => {
        console.error("[Pippibot] streamText error:", String(error), (error as Error)?.message, (error as Error)?.cause);
      },
    });

    return result.toDataStreamResponse();
  } catch (err) {
    console.error("[Pippibot] Unhandled error:", err);
    return NextResponse.json(
      { error: "Errore interno del server" },
      { status: 500 }
    );
  }
}
