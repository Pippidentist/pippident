import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { appointments, studios } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  notifyAppointmentConfirmed,
  notifyAppointmentCancelled,
} from "@/lib/whatsapp-notifications";

const updateSchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  status: z
    .enum(["confirmed", "pending", "completed", "cancelled", "no_show"])
    .optional(),
  notes: z.string().optional(),
  cancellationReason: z.string().optional(),
  treatmentTypeId: z.string().uuid().optional().nullable(),
  dentistId: z.string().uuid().optional(),
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

  // Validate against opening hours if startTime or endTime is being changed
  if (parsed.data.startTime || parsed.data.endTime) {
    const [studioData] = await db
      .select({ settings: studios.settings })
      .from(studios)
      .where(eq(studios.id, studioId))
      .limit(1);

    const openingHours = studioData?.settings?.openingHours;
    if (openingHours && Object.keys(openingHours).length > 0) {
      // Need both start and end to validate; if only one is provided, fetch the existing appointment
      let startTime = parsed.data.startTime;
      let endTime = parsed.data.endTime;

      if (!startTime || !endTime) {
        const [existing] = await db
          .select({ startTime: appointments.startTime, endTime: appointments.endTime })
          .from(appointments)
          .where(and(eq(appointments.id, id), eq(appointments.studioId, studioId)))
          .limit(1);
        if (existing) {
          startTime = startTime ?? existing.startTime.toISOString();
          endTime = endTime ?? existing.endTime.toISOString();
        }
      }

      if (startTime && endTime) {
        const startDate = new Date(startTime);
        const endDate = new Date(endTime);

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
    }
  }

  // Load previous state to detect status transitions for WhatsApp notifications
  const [previous] = await db
    .select({ status: appointments.status })
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.studioId, studioId)))
    .limit(1);

  // Cancellation = hard delete
  if (parsed.data.status === "cancelled") {
    if (previous) {
      await notifyAppointmentCancelled(id, parsed.data.cancellationReason ?? null);
    }

    const [deleted] = await db
      .delete(appointments)
      .where(and(eq(appointments.id, id), eq(appointments.studioId, studioId)))
      .returning({ id: appointments.id });

    if (!deleted) {
      return NextResponse.json({ error: "Appuntamento non trovato" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  }

  const setData: Partial<typeof appointments.$inferInsert> = {
    updatedAt: new Date(),
  };
  if (parsed.data.status) setData.status = parsed.data.status;
  if (parsed.data.notes !== undefined) setData.notes = parsed.data.notes;
  if (parsed.data.cancellationReason !== undefined) setData.cancellationReason = parsed.data.cancellationReason;
  if (parsed.data.treatmentTypeId !== undefined) setData.treatmentTypeId = parsed.data.treatmentTypeId;
  if (parsed.data.dentistId) setData.dentistId = parsed.data.dentistId;
  if (parsed.data.startTime) setData.startTime = new Date(parsed.data.startTime);
  if (parsed.data.endTime) setData.endTime = new Date(parsed.data.endTime);

  const [updated] = await db
    .update(appointments)
    .set(setData)
    .where(and(eq(appointments.id, id), eq(appointments.studioId, studioId)))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Appuntamento non trovato" }, { status: 404 });
  }

  // Notify on pending → confirmed transition
  if (
    parsed.data.status === "confirmed" &&
    previous?.status !== "confirmed"
  ) {
    await notifyAppointmentConfirmed(id);
  }

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const studioId = session.user.studioId;
  const { id } = await params;

  const [existing] = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.studioId, studioId)))
    .limit(1);

  if (existing) {
    await notifyAppointmentCancelled(id);
  }

  await db
    .delete(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.studioId, studioId)));

  return NextResponse.json({ success: true });
}
