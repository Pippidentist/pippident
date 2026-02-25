import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { payments, patients } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";

const createPaymentSchema = z.object({
  patientId: z.string().uuid(),
  quoteId: z.string().uuid().optional().nullable(),
  appointmentId: z.string().uuid().optional().nullable(),
  paymentDate: z.string().min(1, "Data obbligatoria"),
  amount: z.number().positive("Importo obbligatorio"),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "financing"]),
  notes: z.string().optional(),
});

async function getNextReceiptNumber(studioId: string): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(payments)
    .where(
      and(
        eq(payments.studioId, studioId),
        sql`EXTRACT(YEAR FROM ${payments.createdAt}) = ${year}`
      )
    );
  const count = Number(result[0]?.count ?? 0) + 1;
  return `RIC-${year}-${String(count).padStart(4, "0")}`;
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const studioId = session.user.studioId;
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get("patientId");

  const conditions = [
    eq(payments.studioId, studioId),
    ...(patientId ? [eq(payments.patientId, patientId)] : []),
  ];

  const data = await db
    .select({
      id: payments.id,
      receiptNumber: payments.receiptNumber,
      paymentDate: payments.paymentDate,
      amount: payments.amount,
      paymentMethod: payments.paymentMethod,
      notes: payments.notes,
      patientId: payments.patientId,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      quoteId: payments.quoteId,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .leftJoin(patients, eq(payments.patientId, patients.id))
    .where(and(...(conditions as Parameters<typeof and>)))
    .orderBy(desc(payments.createdAt));

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const studioId = session.user.studioId;
  const body = await request.json();

  const parsed = createPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const receiptNumber = await getNextReceiptNumber(studioId);

  const [payment] = await db
    .insert(payments)
    .values({
      studioId,
      patientId: parsed.data.patientId,
      quoteId: parsed.data.quoteId ?? null,
      appointmentId: parsed.data.appointmentId ?? null,
      receiptNumber,
      paymentDate: parsed.data.paymentDate,
      amount: String(parsed.data.amount.toFixed(2)),
      paymentMethod: parsed.data.paymentMethod,
      notes: parsed.data.notes ?? null,
      createdBy: session.user.id,
    })
    .returning();

  return NextResponse.json(payment, { status: 201 });
}
