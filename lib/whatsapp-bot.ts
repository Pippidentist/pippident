import { db } from "@/lib/db";
import {
  studios,
  patients,
  appointments,
  whatsappSessions,
  whatsappMessages,
  users,
  treatmentTypes,
} from "@/lib/db/schema";
import { eq, and, gt, gte, lte, asc } from "drizzle-orm";
import { addDays, addMinutes } from "date-fns";
import {
  buildHelpMenu,
  buildAppointmentListMessage,
  buildCancellationListMessage,
  buildCancellationConfirmMessage,
  type AppointmentEntry,
} from "@/lib/whatsapp";

// ── Session helpers ────────────────────────────────────────────────────────────

async function getOrCreateSession(studioId: string, phone: string) {
  const now = new Date();
  const [existing] = await db
    .select()
    .from(whatsappSessions)
    .where(
      and(
        eq(whatsappSessions.studioId, studioId),
        eq(whatsappSessions.phone, phone),
        gt(whatsappSessions.expiresAt, now)
      )
    )
    .limit(1);
  return existing ?? null;
}

async function upsertSession(
  studioId: string,
  phone: string,
  state: string,
  data: Record<string, unknown>
) {
  const expiresAt = addMinutes(new Date(), 30);
  await db
    .insert(whatsappSessions)
    .values({ studioId, phone, state, data, expiresAt, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [whatsappSessions.studioId, whatsappSessions.phone],
      set: { state, data, expiresAt, updatedAt: new Date() },
    });
}

// ── Appointment helpers ───────────────────────────────────────────────────────

async function getUpcomingAppointments(studioId: string, patientId: string): Promise<AppointmentEntry[]> {
  const now = new Date();
  const limit = addDays(now, 60);
  const rows = await db
    .select({
      id: appointments.id,
      startTime: appointments.startTime,
      treatmentName: treatmentTypes.name,
      dentistName: users.fullName,
    })
    .from(appointments)
    .leftJoin(treatmentTypes, eq(appointments.treatmentTypeId, treatmentTypes.id))
    .leftJoin(users, eq(appointments.dentistId, users.id))
    .where(
      and(
        eq(appointments.studioId, studioId),
        eq(appointments.patientId, patientId),
        gte(appointments.startTime, now),
        lte(appointments.startTime, limit),
        eq(appointments.status, "confirmed")
      )
    )
    .orderBy(asc(appointments.startTime))
    .limit(5);
  return rows;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function handleIncomingMessage(params: {
  fromPhone: string;  // normalized: "+393331234567"
  toPhone: string;    // "whatsapp:+14155238886" (the studio's number)
  body: string;
  waMessageId: string;
}): Promise<string> {
  const { fromPhone, toPhone, body, waMessageId } = params;
  const text = body.trim().toUpperCase();

  // 1. Find studio by its Twilio number
  const [studio] = await db
    .select({ id: studios.id, name: studios.name, twilioPhoneFrom: studios.twilioPhoneFrom })
    .from(studios)
    .where(eq(studios.twilioPhoneFrom, toPhone))
    .limit(1);

  if (!studio) {
    return "Servizio non disponibile.";
  }

  // 2. Log inbound message (patientId will be null if unknown)
  const [existingPatient] = await db
    .select({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName })
    .from(patients)
    .where(and(eq(patients.studioId, studio.id), eq(patients.phone, fromPhone)))
    .limit(1);

  await db.insert(whatsappMessages).values({
    studioId: studio.id,
    patientId: existingPatient?.id ?? undefined,
    direction: "inbound",
    messageType: "generic",
    body,
    status: "sent",
    waMessageId,
  });

  // 3. Load conversation session
  const session = await getOrCreateSession(studio.id, fromPhone);

  // 4. Global commands (work from any state)
  if (["AIUTO", "HELP", "MENU"].includes(text)) {
    const name = existingPatient
      ? `${existingPatient.firstName} ${existingPatient.lastName}`
      : "Cliente";
    await upsertSession(studio.id, fromPhone, "menu", {});
    return buildHelpMenu(name);
  }

  // 5. Unknown patient → send registration link
  if (!existingPatient) {
    const baseUrl = process.env.NEXTAUTH_URL ?? "https://pippident.vercel.app";
    const registrationUrl = `${baseUrl}/register/${studio.id}`;
    return (
      `Benvenuto/a su *${studio.name}*! 👋\n\n` +
      `Per poter accedere ai servizi del bot (appuntamenti, promemoria, ecc.) è necessario registrarsi.\n\n` +
      `📋 Compila il modulo di registrazione al seguente link:\n${registrationUrl}\n\n` +
      `Una volta completata la registrazione potrai scrivere qui per gestire i tuoi appuntamenti.`
    );
  }

  // 6. Known patient flows
  const patientName = `${existingPatient.firstName} ${existingPatient.lastName}`;

  if (text === "APPUNTAMENTI" || text === "APP") {
    const appts = await getUpcomingAppointments(studio.id, existingPatient.id);
    await upsertSession(studio.id, fromPhone, "menu", {});
    return buildAppointmentListMessage(appts);
  }

  if (text === "ANNULLA") {
    const appts = await getUpcomingAppointments(studio.id, existingPatient.id);
    if (appts.length === 0) {
      await upsertSession(studio.id, fromPhone, "menu", {});
      return "Non ha nessun appuntamento futuro da cancellare.";
    }
    await upsertSession(studio.id, fromPhone, "cancelling", {
      appointments: appts.map((a) => ({
        id: a.id,
        startTime: a.startTime.toISOString(),
        treatmentName: a.treatmentName,
        dentistName: a.dentistName,
      })),
    });
    return buildCancellationListMessage(appts);
  }

  if (session?.state === "cancelling") {
    const num = parseInt(text, 10);
    const stored = (session.data as { appointments: { id: string; startTime: string; treatmentName: string | null; dentistName: string | null }[] }).appointments;
    if (!isNaN(num) && num >= 1 && num <= stored.length) {
      const selected = stored[num - 1];
      await db
        .update(appointments)
        .set({ status: "cancelled", cancellationReason: "Cancellato dal paziente via WhatsApp" })
        .where(and(eq(appointments.id, selected.id), eq(appointments.studioId, studio.id)));
      await db.insert(whatsappMessages).values({
        studioId: studio.id,
        patientId: existingPatient.id,
        direction: "outbound",
        messageType: "appointment_cancel",
        body: "",
        status: "sent",
      });
      await upsertSession(studio.id, fromPhone, "menu", {});
      return buildCancellationConfirmMessage(new Date(selected.startTime));
    }
    if (text === "MENU" || text === "AIUTO") {
      await upsertSession(studio.id, fromPhone, "menu", {});
      return buildHelpMenu(patientName);
    }
    return `Risponda con un numero tra 1 e ${stored.length} oppure *MENU* per annullare.`;
  }

  // Default: show help menu
  await upsertSession(studio.id, fromPhone, "menu", {});
  return buildHelpMenu(patientName);
}
