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
  sendWhatsAppMessage,
  buildWelcomeMessage,
  buildHelpMenu,
  buildAppointmentListMessage,
  buildCancellationListMessage,
  buildCancellationConfirmMessage,
  buildRegistrationPromptName,
  buildRegistrationConfirmMessage,
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

  // 5. No session or new patient → registration flow
  if (!existingPatient) {
    if (!session || session.state === "menu") {
      await upsertSession(studio.id, fromPhone, "reg_name", {});
      return buildRegistrationPromptName(studio.name);
    }

    if (session.state === "reg_name") {
      const parts = body.trim().split(/\s+/);
      if (parts.length < 2) {
        return "Per favore, inserisca nome e cognome (es: Mario Rossi).";
      }
      const firstName = parts[0];
      const lastName = parts.slice(1).join(" ");
      await upsertSession(studio.id, fromPhone, "reg_confirm", { firstName, lastName });
      return buildRegistrationConfirmMessage(firstName, lastName);
    }

    if (session.state === "reg_confirm") {
      if (text === "SI" || text === "SÌ") {
        const { firstName, lastName } = session.data as { firstName: string; lastName: string };
        const [newPatient] = await db
          .insert(patients)
          .values({
            studioId: studio.id,
            firstName,
            lastName,
            phone: fromPhone,
            gdprConsent: true,
            gdprConsentDate: new Date(),
          })
          .returning({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName });
        await upsertSession(studio.id, fromPhone, "menu", {});
        return buildWelcomeMessage(`${newPatient.firstName} ${newPatient.lastName}`, studio.name);
      }
      if (text === "NO") {
        await upsertSession(studio.id, fromPhone, "reg_name", {});
        return buildRegistrationPromptName(studio.name);
      }
      return "Risponda *SI* per confermare o *NO* per ricominciare.";
    }

    return buildRegistrationPromptName(studio.name);
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
