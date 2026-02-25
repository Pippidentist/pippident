import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { quotes, quoteItems } from "@/lib/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { format } from "date-fns";

const quoteItemSchema = z.object({
  treatmentTypeId: z.string().uuid().optional().nullable(),
  description: z.string().min(1),
  quantity: z.number().int().min(1).default(1),
  unitPrice: z.number().min(0),
  discountPct: z.number().min(0).max(100).default(0),
});

const createQuoteSchema = z.object({
  patientId: z.string().uuid(),
  issueDate: z.string().min(1),
  expiryDate: z.string().optional(),
  status: z.enum(["draft", "sent", "accepted", "rejected", "expired"]).default("draft"),
  items: z.array(quoteItemSchema).min(1, "Almeno una voce richiesta"),
  discountAmount: z.number().min(0).default(0),
  notes: z.string().optional(),
});

async function getNextQuoteNumber(studioId: string): Promise<string> {
  const year = new Date().getFullYear();
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(quotes)
    .where(
      and(
        eq(quotes.studioId, studioId),
        sql`EXTRACT(YEAR FROM ${quotes.createdAt}) = ${year}`
      )
    );
  const count = Number(result[0]?.count ?? 0) + 1;
  return `PREV-${year}-${String(count).padStart(4, "0")}`;
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
    eq(quotes.studioId, studioId),
    ...(patientId ? [eq(quotes.patientId, patientId)] : []),
  ];

  const data = await db
    .select()
    .from(quotes)
    .where(and(...(conditions as Parameters<typeof and>)))
    .orderBy(desc(quotes.createdAt));

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const studioId = session.user.studioId;
  const body = await request.json();

  const parsed = createQuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const quoteNumber = await getNextQuoteNumber(studioId);

  // Calcola subtotal
  const subtotal = data.items.reduce((sum, item) => {
    const lineTotal = item.quantity * item.unitPrice * (1 - item.discountPct / 100);
    return sum + lineTotal;
  }, 0);

  const total = subtotal - data.discountAmount;

  const [quote] = await db
    .insert(quotes)
    .values({
      studioId,
      patientId: data.patientId,
      quoteNumber,
      issueDate: data.issueDate,
      expiryDate: data.expiryDate ?? null,
      status: data.status,
      subtotal: String(subtotal.toFixed(2)),
      discountAmount: String(data.discountAmount.toFixed(2)),
      total: String(total.toFixed(2)),
      notes: data.notes ?? null,
      createdBy: session.user.id,
    })
    .returning();

  // Insert items
  for (const item of data.items) {
    const lineTotal = item.quantity * item.unitPrice * (1 - item.discountPct / 100);
    await db.insert(quoteItems).values({
      quoteId: quote.id,
      treatmentTypeId: item.treatmentTypeId ?? null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: String(item.unitPrice.toFixed(2)),
      discountPct: String(item.discountPct.toFixed(2)),
      lineTotal: String(lineTotal.toFixed(2)),
    });
  }

  return NextResponse.json(quote, { status: 201 });
}
