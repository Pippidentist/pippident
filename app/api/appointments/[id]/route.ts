import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { appointments } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

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
  const body = await request.json().catch(() => ({}));

  await db
    .update(appointments)
    .set({
      status: "cancelled",
      cancellationReason: body.reason ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(appointments.id, id), eq(appointments.studioId, studioId)));

  return NextResponse.json({ success: true });
}
