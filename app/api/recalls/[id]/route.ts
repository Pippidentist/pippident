import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { recalls } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["active", "sent", "completed", "ignored"]).optional(),
  notes: z.string().optional(),
  dueDate: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const studioId = session.user.studioId;
  const { id } = await params;
  const body = await request.json();

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const [updated] = await db
    .update(recalls)
    .set({
      ...parsed.data,
      ...(parsed.data.status === "sent" ? { reminderSentAt: new Date() } : {}),
    })
    .where(and(eq(recalls.id, id), eq(recalls.studioId, studioId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Richiamo non trovato" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
