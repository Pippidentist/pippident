import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(["admin", "dentist", "secretary"]).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!["admin", "super_admin"].includes(session.user.role)) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const studioId = session.user.studioId;
  const { id } = await params;
  const body = await request.json();

  // Non puoi modificare te stesso
  if (id === session.user.id) {
    return NextResponse.json({ error: "Non puoi modificare il tuo account" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const [updated] = await db
    .update(users)
    .set(parsed.data)
    .where(and(eq(users.id, id), eq(users.studioId, studioId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Utente non trovato" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
