import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { studios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const timeRegex = /^\d{2}:\d{2}$/;

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  vatNumber: z.string().optional(),
  twilioPhoneFrom: z.string().optional().nullable(),
  whatsappPhoneNumberId: z.string().optional().nullable(),
  whatsappToken: z.string().optional().nullable(),
  openingHours: z
    .record(z.string(), z.object({ open: z.string(), close: z.string() }))
    .optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  if (!["admin", "super_admin"].includes(session.user.role)) {
    return NextResponse.json({ error: "Permesso negato" }, { status: 403 });
  }

  const studioId = session.user.studioId;
  const body = await request.json();

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dati non validi" }, { status: 400 });
  }

  const { openingHours, ...studioFields } = parsed.data;

  // Normalize twilioPhoneFrom: always store with "whatsapp:" prefix
  if (studioFields.twilioPhoneFrom && !studioFields.twilioPhoneFrom.startsWith("whatsapp:")) {
    studioFields.twilioPhoneFrom = `whatsapp:${studioFields.twilioPhoneFrom}`;
  }

  // Strip accidental spaces from Meta IDs/tokens
  if (studioFields.whatsappPhoneNumberId) {
    studioFields.whatsappPhoneNumberId = studioFields.whatsappPhoneNumberId.trim();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = { ...studioFields };

  if (openingHours !== undefined) {
    const [current] = await db
      .select({ settings: studios.settings })
      .from(studios)
      .where(eq(studios.id, studioId))
      .limit(1);
    updateData.settings = { ...(current?.settings ?? {}), openingHours };
  }

  const [updated] = await db
    .update(studios)
    .set(updateData)
    .where(eq(studios.id, studioId))
    .returning();

  return NextResponse.json(updated);
}
