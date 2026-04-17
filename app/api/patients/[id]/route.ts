import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  patients,
  appointments,
  patientTreatments,
  recalls,
  payments,
  quotes,
  quoteItems,
  whatsappMessages,
  whatsappSessions,
  users,
  treatmentTypes,
} from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

const updatePatientSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().min(6).optional(),
  email: z.string().email().optional().or(z.literal("")),
  dateOfBirth: z.string().optional(),
  fiscalCode: z.string().length(16).optional().or(z.literal("")),
  gender: z.enum(["M", "F", "Other"]).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  postalCode: z.string().optional(),
  province: z.string().max(5).optional(),
  notes: z.string().optional(),
  gdprConsent: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const studioId = session.user.studioId;
  const { id } = await params;

  const [patient] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.studioId, studioId)))
    .limit(1);

  if (!patient) {
    return NextResponse.json({ error: "Paziente non trovato" }, { status: 404 });
  }

  // Fetch related data
  const [patientAppointments, patientTreatmentsList, patientRecalls, patientPayments] =
    await Promise.all([
      db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          notes: appointments.notes,
          dentistName: users.fullName,
          treatmentName: treatmentTypes.name,
        })
        .from(appointments)
        .leftJoin(users, eq(appointments.dentistId, users.id))
        .leftJoin(treatmentTypes, eq(appointments.treatmentTypeId, treatmentTypes.id))
        .where(eq(appointments.patientId, id))
        .orderBy(desc(appointments.startTime))
        .limit(20),

      db
        .select({
          id: patientTreatments.id,
          performedAt: patientTreatments.performedAt,
          status: patientTreatments.status,
          teeth: patientTreatments.teeth,
          clinicalNotes: patientTreatments.clinicalNotes,
          dentistName: users.fullName,
          treatmentName: treatmentTypes.name,
        })
        .from(patientTreatments)
        .leftJoin(users, eq(patientTreatments.dentistId, users.id))
        .leftJoin(treatmentTypes, eq(patientTreatments.treatmentTypeId, treatmentTypes.id))
        .where(eq(patientTreatments.patientId, id))
        .orderBy(desc(patientTreatments.performedAt))
        .limit(20),

      db
        .select()
        .from(recalls)
        .where(eq(recalls.patientId, id))
        .orderBy(desc(recalls.dueDate))
        .limit(10),

      db
        .select()
        .from(payments)
        .where(eq(payments.patientId, id))
        .orderBy(desc(payments.paymentDate))
        .limit(20),
    ]);

  return NextResponse.json({
    patient,
    appointments: patientAppointments,
    treatments: patientTreatmentsList,
    recalls: patientRecalls,
    payments: patientPayments,
  });
}

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

  const parsed = updatePatientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const [existing] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.studioId, studioId)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Paziente non trovato" }, { status: 404 });
  }

  const updateData = parsed.data;
  const [updated] = await db
    .update(patients)
    .set({
      ...updateData,
      email: updateData.email || null,
      fiscalCode: updateData.fiscalCode || null,
      ...(updateData.gdprConsent === true
        ? { gdprConsentDate: new Date() }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(patients.id, id))
    .returning();

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

  const [existing] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.studioId, studioId)))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Paziente non trovato" }, { status: 404 });
  }

  // Hard delete: remove all related data then the patient
  // 1. Quote items (via quote IDs)
  const patientQuotes = await db
    .select({ id: quotes.id })
    .from(quotes)
    .where(eq(quotes.patientId, id));

  if (patientQuotes.length > 0) {
    const quoteIds = patientQuotes.map((q) => q.id);
    await db.delete(quoteItems).where(inArray(quoteItems.quoteId, quoteIds));
    await db.delete(quotes).where(inArray(quotes.id, quoteIds));
  }

  // 2. Delete related records (order doesn't matter, all reference patient)
  await Promise.all([
    db.delete(payments).where(eq(payments.patientId, id)),
    db.delete(recalls).where(eq(recalls.patientId, id)),
    db.delete(patientTreatments).where(eq(patientTreatments.patientId, id)),
    db.delete(appointments).where(eq(appointments.patientId, id)),
    db.delete(whatsappMessages).where(eq(whatsappMessages.patientId, id)),
  ]);

  // 3. Delete patient
  await db.delete(patients).where(eq(patients.id, id));

  return NextResponse.json({ success: true });
}
