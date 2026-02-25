import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { treatmentTypes } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const treatmentTypeSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, "Nome obbligatorio"),
  description: z.string().optional(),
  category: z.string().optional(),
  defaultDurationMinutes: z.number().int().min(15).default(30),
  listPrice: z.string().optional(),
  autoRecallDays: z.number().int().min(0).optional().nullable(),
  isActive: z.boolean().default(true),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const studioId = session.user.studioId;
  const { searchParams } = new URL(request.url);
  const onlyActive = searchParams.get("active") !== "false";

  const conditions = [
    eq(treatmentTypes.studioId, studioId),
    ...(onlyActive ? [eq(treatmentTypes.isActive, true)] : []),
  ];

  const data = await db
    .select()
    .from(treatmentTypes)
    .where(and(...(conditions as Parameters<typeof and>)))
    .orderBy(treatmentTypes.category, treatmentTypes.name);

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const studioId = session.user.studioId;
  const body = await request.json();

  const parsed = treatmentTypeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const [treatment] = await db
    .insert(treatmentTypes)
    .values({
      studioId,
      ...parsed.data,
      listPrice: parsed.data.listPrice || null,
      autoRecallDays: parsed.data.autoRecallDays ?? null,
    })
    .returning();

  return NextResponse.json(treatment, { status: 201 });
}
