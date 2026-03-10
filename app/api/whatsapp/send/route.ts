import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, recalls, patients, whatsappMessages } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { sendWhatsAppMessage, buildRecallMessage } from "@/lib/whatsapp";
import { format } from "date-fns";
import { it } from "date-fns/locale";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.studioId) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }
  const studioId = session.user.studioId;

  const { recallId } = await req.json();
  if (!recallId) {
    return NextResponse.json({ error: "recallId richiesto" }, { status: 400 });
  }

  // Load recall with patient
  const [recall] = await db
    .select({
      id: recalls.id,
      recallType: recalls.recallType,
      dueDate: recalls.dueDate,
      status: recalls.status,
      patientId: recalls.patientId,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      patientPhone: patients.phone,
    })
    .from(recalls)
    .leftJoin(patients, eq(recalls.patientId, patients.id))
    .where(and(eq(recalls.id, recallId), eq(recalls.studioId, studioId)))
    .limit(1);

  if (!recall) {
    return NextResponse.json({ error: "Richiamo non trovato" }, { status: 404 });
  }
  if (!recall.patientPhone) {
    return NextResponse.json({ error: "Il paziente non ha un numero di telefono" }, { status: 422 });
  }

  const patientName = `${recall.patientFirstName ?? ""} ${recall.patientLastName ?? ""}`.trim();
  const dueDateFormatted = format(new Date(recall.dueDate), "d MMMM yyyy", { locale: it });
  const body = buildRecallMessage(patientName, recall.recallType, dueDateFormatted);

  try {
    const waMessageId = await sendWhatsAppMessage(recall.patientPhone, body);

    // Log message
    await db.insert(whatsappMessages).values({
      studioId,
      patientId: recall.patientId ?? undefined,
      direction: "outbound",
      messageType: "recall",
      body,
      status: "sent",
      waMessageId,
    });

    // Update recall status and reminderSentAt
    await db
      .update(recalls)
      .set({ status: "sent", reminderSentAt: new Date() })
      .where(eq(recalls.id, recallId));

    return NextResponse.json({ ok: true, waMessageId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Errore nell'invio WhatsApp";
    // Log failed attempt
    await db.insert(whatsappMessages).values({
      studioId,
      patientId: recall.patientId ?? undefined,
      direction: "outbound",
      messageType: "recall",
      body,
      status: "failed",
    });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
