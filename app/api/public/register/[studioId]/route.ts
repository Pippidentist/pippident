import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { studios, patients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const registrationSchema = z.object({
  firstName: z.string().min(1, "Nome obbligatorio"),
  lastName: z.string().min(1, "Cognome obbligatorio"),
  gender: z.enum(["M", "F", "Other"]),
  dateOfBirth: z.string().optional(),
  fiscalCode: z
    .string()
    .regex(/^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/, "Codice fiscale non valido")
    .optional()
    .or(z.literal("")),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  province: z.string().max(5).optional(),
  phone: z.string().min(6, "Telefono obbligatorio"),
  email: z.union([z.literal(""), z.string().email("Email non valida")]).optional(),
  notes: z.string().optional(),
  gdprConsent: z.literal(true, { errorMap: () => ({ message: "Il consenso è obbligatorio" }) }),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studioId: string }> }
) {
  const { studioId } = await params;

  const [studio] = await db
    .select({ id: studios.id })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);

  if (!studio) {
    return NextResponse.json({ error: "Studio non trovato" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const data = parsed.data;

  // Check for duplicate phone in this studio
  const [existing] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.studioId, studioId), eq(patients.phone, data.phone)))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "Questo numero di telefono è già registrato presso lo studio." },
      { status: 409 }
    );
  }

  await db.insert(patients).values({
    studioId,
    firstName: data.firstName,
    lastName: data.lastName,
    gender: data.gender,
    dateOfBirth: data.dateOfBirth || undefined,
    fiscalCode: data.fiscalCode || undefined,
    address: data.address || undefined,
    city: data.city || undefined,
    postalCode: data.postalCode || undefined,
    province: data.province || undefined,
    phone: data.phone,
    email: data.email || undefined,
    notes: data.notes || undefined,
    gdprConsent: true,
    gdprConsentDate: new Date(),
  });

  return NextResponse.json({ ok: true });
}
