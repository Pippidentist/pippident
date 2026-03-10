import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { patients, studios } from "@/lib/db/schema";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { sendWhatsAppMessage, buildWelcomeMessage } from "@/lib/whatsapp";

const createPatientSchema = z.object({
  firstName: z.string().min(1, "Nome obbligatorio"),
  lastName: z.string().min(1, "Cognome obbligatorio"),
  phone: z.string().min(6, "Telefono obbligatorio"),
  email: z.string().email().optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  fiscalCode: z.string().length(16).optional().or(z.literal("")),
  gender: z.enum(["M", "F", "Other"]).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  province: z.string().max(5).optional(),
  notes: z.string().optional(),
  gdprConsent: z.boolean().default(false),
  firstVisitDate: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const studioId = session.user.studioId;
  const { searchParams } = new URL(request.url);

  const search = searchParams.get("search") ?? "";
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = parseInt(searchParams.get("pageSize") ?? "20");
  const includeArchived = searchParams.get("includeArchived") === "true";

  const offset = (page - 1) * pageSize;

  const whereConditions = [
    eq(patients.studioId, studioId),
    ...(includeArchived ? [] : [eq(patients.isArchived, false)]),
    ...(search
      ? [
          or(
            ilike(patients.firstName, `%${search}%`),
            ilike(patients.lastName, `%${search}%`),
            ilike(patients.fiscalCode, `%${search}%`),
            ilike(patients.phone, `%${search}%`)
          ),
        ]
      : []),
  ].filter(Boolean);

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(patients)
      .where(and(...(whereConditions as Parameters<typeof and>)))
      .orderBy(patients.lastName, patients.firstName)
      .limit(pageSize)
      .offset(offset),

    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(patients)
      .where(and(...(whereConditions as Parameters<typeof and>))),
  ]);

  return NextResponse.json({
    data,
    total: Number(countResult[0]?.count ?? 0),
    page,
    pageSize,
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const studioId = session.user.studioId;
  const body = await request.json();

  const parsed = createPatientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const [patient] = await db
    .insert(patients)
    .values({
      studioId,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      email: data.email || null,
      dateOfBirth: data.dateOfBirth || null,
      fiscalCode: data.fiscalCode || null,
      gender: data.gender,
      address: data.address || null,
      city: data.city || null,
      postalCode: data.postalCode || null,
      province: data.province || null,
      notes: data.notes || null,
      gdprConsent: data.gdprConsent,
      gdprConsentDate: data.gdprConsent ? new Date() : null,
      firstVisitDate: data.firstVisitDate || null,
    })
    .returning();

  // Send WhatsApp welcome message if studio has a Twilio number configured
  const [studio] = await db
    .select({ name: studios.name, twilioPhoneFrom: studios.twilioPhoneFrom })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);

  if (studio?.twilioPhoneFrom) {
    sendWhatsAppMessage(
      data.phone,
      buildWelcomeMessage(`${data.firstName} ${data.lastName}`, studio.name),
      studio.twilioPhoneFrom
    ).catch((err) => console.error("[WhatsApp welcome]", err));
  }

  return NextResponse.json(patient, { status: 201 });
}
