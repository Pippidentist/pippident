import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { treatmentTypes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  defaultDurationMinutes: z.number().int().min(15).optional(),
  listPrice: z.string().optional(),
  autoRecallDays: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().optional(),
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
    .update(treatmentTypes)
    .set({
      ...parsed.data,
      listPrice: parsed.data.listPrice || null,
    })
    .where(and(eq(treatmentTypes.id, id), eq(treatmentTypes.studioId, studioId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Cura non trovata" }, { status: 404 });
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const studioId = session.user.studioId;
  const { id } = await params;

  // Soft delete (disattiva)
  await db
    .update(treatmentTypes)
    .set({ isActive: false })
    .where(and(eq(treatmentTypes.id, id), eq(treatmentTypes.studioId, studioId)));

  return NextResponse.json({ success: true });
}
