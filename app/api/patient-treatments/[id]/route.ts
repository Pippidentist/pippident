import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { patientTreatments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const updateSchema = z.object({
  status: z.enum(["planned", "performed", "suspended"]).optional(),
  clinicalNotes: z.string().optional(),
  teeth: z.array(z.string()).optional(),
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
    .update(patientTreatments)
    .set(parsed.data)
    .where(
      and(
        eq(patientTreatments.id, id),
        eq(patientTreatments.studioId, studioId)
      )
    )
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Cura non trovata" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
