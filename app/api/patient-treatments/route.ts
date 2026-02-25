import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { patientTreatments, treatmentTypes, recalls } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { addDays, format } from "date-fns";

const createTreatmentSchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional().nullable(),
  treatmentTypeId: z.string().uuid(),
  dentistId: z.string().uuid().optional().nullable(),
  teeth: z.array(z.string()).optional(),
  clinicalNotes: z.string().optional(),
  performedAt: z.string().datetime(),
  status: z.enum(["planned", "performed", "suspended"]).default("performed"),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const studioId = session.user.studioId;
  const body = await request.json();

  const parsed = createTreatmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const [treatment] = await db
    .insert(patientTreatments)
    .values({
      studioId,
      patientId: data.patientId,
      appointmentId: data.appointmentId ?? null,
      treatmentTypeId: data.treatmentTypeId,
      dentistId: data.dentistId ?? null,
      teeth: data.teeth ?? null,
      clinicalNotes: data.clinicalNotes ?? null,
      performedAt: new Date(data.performedAt),
      status: data.status,
    })
    .returning();

  // Auto-recall: se la cura è "performed" e il trattamento ha autoRecallDays
  if (data.status === "performed") {
    const [treatmentType] = await db
      .select({ autoRecallDays: treatmentTypes.autoRecallDays, name: treatmentTypes.name })
      .from(treatmentTypes)
      .where(eq(treatmentTypes.id, data.treatmentTypeId))
      .limit(1);

    if (treatmentType?.autoRecallDays && treatmentType.autoRecallDays > 0) {
      const dueDate = addDays(new Date(data.performedAt), treatmentType.autoRecallDays);
      await db.insert(recalls).values({
        studioId,
        patientId: data.patientId,
        treatmentTypeId: data.treatmentTypeId,
        recallType: treatmentType.name,
        dueDate: format(dueDate, "yyyy-MM-dd"),
        status: "active",
        createdAutomatically: true,
      });
    }
  }

  return NextResponse.json(treatment, { status: 201 });
}
