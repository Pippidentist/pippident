import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { appointments, patients, users, treatmentTypes, studios } from "@/lib/db/schema";
import { eq, and, gte, lte, or, sql } from "drizzle-orm";
import { z } from "zod";

const createAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  dentistId: z.string().uuid(),
  treatmentTypeId: z.string().uuid().optional().nullable(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  status: z
    .enum(["confirmed", "pending", "completed", "cancelled", "no_show"])
    .default("confirmed"),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const studioId = session.user.studioId;
  const { searchParams } = new URL(request.url);

  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const dentistId = searchParams.get("dentistId");

  const conditions = [
    eq(appointments.studioId, studioId),
    ...(dateFrom ? [gte(appointments.startTime, new Date(dateFrom))] : []),
    ...(dateTo ? [lte(appointments.startTime, new Date(dateTo))] : []),
    ...(dentistId ? [eq(appointments.dentistId, dentistId)] : []),
  ].filter(Boolean);

  const data = await db
    .select({
      id: appointments.id,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      status: appointments.status,
      notes: appointments.notes,
      patientId: appointments.patientId,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      patientPhone: patients.phone,
      dentistId: appointments.dentistId,
      dentistName: users.fullName,
      treatmentTypeId: appointments.treatmentTypeId,
      treatmentName: treatmentTypes.name,
      treatmentDuration: treatmentTypes.defaultDurationMinutes,
    })
    .from(appointments)
    .leftJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(users, eq(appointments.dentistId, users.id))
    .leftJoin(treatmentTypes, eq(appointments.treatmentTypeId, treatmentTypes.id))
    .where(and(...(conditions as Parameters<typeof and>)))
    .orderBy(appointments.startTime);

  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const studioId = session.user.studioId;
  const body = await request.json();

  const parsed = createAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dati non validi", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // Check for conflicts: stessa dentista, stesso orario
  const conflicting = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(
      and(
        eq(appointments.studioId, studioId),
        eq(appointments.dentistId, data.dentistId),
        sql`${appointments.status} NOT IN ('cancelled', 'no_show')`,
        or(
          and(
            gte(appointments.startTime, new Date(data.startTime)),
            lte(appointments.startTime, new Date(data.endTime))
          ),
          and(
            gte(appointments.endTime, new Date(data.startTime)),
            lte(appointments.endTime, new Date(data.endTime))
          ),
          and(
            lte(appointments.startTime, new Date(data.startTime)),
            gte(appointments.endTime, new Date(data.endTime))
          )
        )
      )
    )
    .limit(1);

  if (conflicting.length > 0) {
    return NextResponse.json(
      { error: "Il dentista ha già un appuntamento in questo orario" },
      { status: 409 }
    );
  }

  // Validate against studio opening hours
  const [studioData] = await db
    .select({ settings: studios.settings })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);

  const openingHours = studioData?.settings?.openingHours;
  if (openingHours && Object.keys(openingHours).length > 0) {
    const startDate = new Date(data.startTime);
    const endDate = new Date(data.endTime);

    const dayName = new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      timeZone: "Europe/Rome",
    }).format(startDate);

    const daySchedule = openingHours[dayName];
    if (!daySchedule) {
      return NextResponse.json(
        { error: "Lo studio è chiuso in questo giorno" },
        { status: 422 }
      );
    }

    const toMinutes = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number);
      return h * 60 + m;
    };

    const getRomeHHMM = (date: Date) =>
      new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/Rome",
      }).format(date);

    if (
      toMinutes(getRomeHHMM(startDate)) < toMinutes(daySchedule.open) ||
      toMinutes(getRomeHHMM(endDate)) > toMinutes(daySchedule.close)
    ) {
      return NextResponse.json(
        { error: `Lo studio è aperto dalle ${daySchedule.open} alle ${daySchedule.close}` },
        { status: 422 }
      );
    }
  }

  const [appointment] = await db
    .insert(appointments)
    .values({
      studioId,
      patientId: data.patientId,
      dentistId: data.dentistId,
      treatmentTypeId: data.treatmentTypeId ?? null,
      startTime: new Date(data.startTime),
      endTime: new Date(data.endTime),
      status: data.status,
      notes: data.notes ?? null,
      createdBy: session.user.id,
    })
    .returning();

  return NextResponse.json(appointment, { status: 201 });
}
