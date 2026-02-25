import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { recalls, patients } from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { addDays, format } from "date-fns";

const createRecallSchema = z.object({
  patientId: z.string().uuid(),
  treatmentTypeId: z.string().uuid().optional().nullable(),
  recallType: z.string().min(1, "Tipo richiamo obbligatorio"),
  dueDate: z.string().min(1, "Data obbligatoria"),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const studioId = session.user.studioId;
  const { searchParams } = new URL(request.url);

  const daysWindow = parseInt(searchParams.get("days") ?? "30");
  const status = searchParams.get("status") ?? "active";
  const patientId = searchParams.get("patientId");

  const today = new Date();
  const futureDate = addDays(today, daysWindow);

  const conditions = [
    eq(recalls.studioId, studioId),
    ...(status !== "all" ? [eq(recalls.status, status as "active" | "sent" | "completed" | "ignored")] : []),
    ...(patientId ? [eq(recalls.patientId, patientId)] : []),
    gte(recalls.dueDate, format(today, "yyyy-MM-dd")),
    lte(recalls.dueDate, format(futureDate, "yyyy-MM-dd")),
  ].filter(Boolean);

  const data = await db
    .select({
      id: recalls.id,
      recallType: recalls.recallType,
      dueDate: recalls.dueDate,
      status: recalls.status,
      notes: recalls.notes,
      createdAutomatically: recalls.createdAutomatically,
      createdAt: recalls.createdAt,
      patientId: recalls.patientId,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      patientPhone: patients.phone,
    })
    .from(recalls)
    .leftJoin(patients, eq(recalls.patientId, patients.id))
    .where(and(...(conditions as Parameters<typeof and>)))
    .orderBy(recalls.dueDate);

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const studioId = session.user.studioId;
  const body = await request.json();

  const parsed = createRecallSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const [recall] = await db
    .insert(recalls)
    .values({
      studioId,
      patientId: parsed.data.patientId,
      treatmentTypeId: parsed.data.treatmentTypeId ?? null,
      recallType: parsed.data.recallType,
      dueDate: parsed.data.dueDate,
      status: "active",
      notes: parsed.data.notes ?? null,
      createdAutomatically: false,
    })
    .returning();

  return NextResponse.json(recall, { status: 201 });
}
