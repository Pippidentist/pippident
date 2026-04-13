import { streamText, tool, stepCountIs, convertToModelMessages } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  studios,
  patients,
  appointments,
  users,
  treatmentTypes,
} from "@/lib/db/schema";
import { eq, and, gte, lte, or, sql, asc } from "drizzle-orm";
import { readFileSync } from "fs";
import { join } from "path";
import { addDays, addMinutes, format, setHours, setMinutes, startOfDay, isAfter, isBefore } from "date-fns";
import { it } from "date-fns/locale";

export const maxDuration = 60;

function loadKB(filename: string): string {
  try {
    return readFileSync(join(process.cwd(), "knowledge-base", filename), "utf-8");
  } catch {
    return "";
  }
}

interface SlotResult {
  date: string;
  startTime: string;
  endTime: string;
  dentistId: string;
  dentistName: string;
}

async function findAvailableSlots(
  studioId: string,
  dateFrom: Date,
  dateTo: Date,
  durationMinutes: number
): Promise<SlotResult[]> {
  const dentists = await db
    .select({ id: users.id, fullName: users.fullName })
    .from(users)
    .where(and(eq(users.studioId, studioId), eq(users.isActive, true), eq(users.role, "dentist")));

  if (dentists.length === 0) return [];

  const existingAppts = await db
    .select({
      dentistId: appointments.dentistId,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
    })
    .from(appointments)
    .where(
      and(
        eq(appointments.studioId, studioId),
        gte(appointments.startTime, dateFrom),
        lte(appointments.startTime, dateTo),
        sql`${appointments.status} NOT IN ('cancelled', 'no_show')`
      )
    );

  const [studioRow] = await db
    .select({ settings: studios.settings })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);

  const openingHours = studioRow?.settings?.openingHours;
  const defaultOpen = { open: "09:00", close: "18:00" };
  const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  const slots: SlotResult[] = [];
  let current = startOfDay(dateFrom);
  const end = dateTo;
  const now = new Date();

  while (!isAfter(current, end) && slots.length < 20) {
    const dayName = dayNames[current.getDay()];
    const hours = openingHours?.[dayName] ?? (current.getDay() >= 1 && current.getDay() <= 5 ? defaultOpen : null);

    if (hours) {
      const [openH, openM] = hours.open.split(":").map(Number);
      const [closeH, closeM] = hours.close.split(":").map(Number);
      const dayStart = setMinutes(setHours(current, openH), openM);
      const dayEnd = setMinutes(setHours(current, closeH), closeM);

      for (const dentist of dentists) {
        let slotStart = dayStart;
        while (isBefore(addMinutes(slotStart, durationMinutes), dayEnd) || addMinutes(slotStart, durationMinutes).getTime() === dayEnd.getTime()) {
          if (isAfter(slotStart, now)) {
            const slotEnd = addMinutes(slotStart, durationMinutes);
            const hasConflict = existingAppts.some(
              (a) =>
                a.dentistId === dentist.id &&
                isBefore(a.startTime, slotEnd) &&
                isAfter(a.endTime, slotStart)
            );
            if (!hasConflict) {
              slots.push({
                date: format(slotStart, "EEEE d MMMM yyyy", { locale: it }),
                startTime: format(slotStart, "HH:mm"),
                endTime: format(slotEnd, "HH:mm"),
                dentistId: dentist.id,
                dentistName: dentist.fullName,
              });
              if (slots.length >= 20) break;
            }
          }
          slotStart = addMinutes(slotStart, 30);
        }
        if (slots.length >= 20) break;
      }
    }
    current = addDays(current, 1);
  }

  return slots;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ studioId: string }> }
) {
  const { studioId } = await params;

  const body = await req.json();
  const { messages, phone } = body;

  if (!messages || !phone) {
    return new Response(JSON.stringify({ error: "Missing messages or phone" }), { status: 400 });
  }

  const [studio] = await db
    .select({ id: studios.id, name: studios.name, phone: studios.phone, email: studios.email, address: studios.address, settings: studios.settings })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);

  if (!studio) {
    return new Response(JSON.stringify({ error: "Studio not found" }), { status: 404 });
  }

  const [patient] = await db
    .select({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName, phone: patients.phone })
    .from(patients)
    .where(and(eq(patients.studioId, studioId), eq(patients.phone, phone)))
    .limit(1);

  const systemPrompt = loadKB("01_Secretary_Agent_Prompt.md");
  const kb = loadKB("02_Secretary_KB.md");

  const patientContext = patient
    ? `\n\n## PAZIENTE IDENTIFICATO\nNome: ${patient.firstName} ${patient.lastName}\nTelefono: ${patient.phone}\nID interno (non mostrare mai): ${patient.id}`
    : `\n\n## PAZIENTE NON TROVATO\nIl numero ${phone} non è registrato in questo studio. Invita il paziente a registrarsi.`;

  const studioContext = `\n\n## STUDIO\nNome: ${studio.name}\nTelefono: ${studio.phone ?? "N/A"}\nEmail: ${studio.email}\nIndirizzo: ${studio.address ?? "N/A"}`;

  const fullSystemPrompt = systemPrompt
    .replace(/\{STUDIO_NAME\}/g, studio.name)
    .replace(/\{PATIENT_NAME\}/g, patient ? `${patient.firstName} ${patient.lastName}` : "")
    .replace(/\{STUDIO_PHONE\}/g, studio.phone ?? "lo studio")
    + studioContext + patientContext + "\n\n---\n\n" + kb;

  let modelMessages;
  try {
    modelMessages = await convertToModelMessages(messages.slice(-20));
  } catch (e) {
    console.error("[chat] convertToModelMessages error:", e);
    return new Response(JSON.stringify({ error: "Message conversion failed" }), { status: 500 });
  }

  const result = streamText({
    model: createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY })("gemini-1.5-flash"),
    system: fullSystemPrompt,
    messages: modelMessages,
    onError: (e) => console.error("[chat] streamText error:", e),
    stopWhen: stepCountIs(5),
    tools: {
      getStudioInfo: tool({
        description: "Restituisce informazioni sullo studio dentistico: nome, telefono, email, indirizzo, orari di apertura.",
        inputSchema: z.object({}),
        execute: async () => {
          const openingHours = studio.settings?.openingHours;
          const defaultHours = "Lun-Ven 09:00-18:00";
          let hoursStr = defaultHours;
          if (openingHours) {
            const days: Record<string, string> = { monday: "Lunedì", tuesday: "Martedì", wednesday: "Mercoledì", thursday: "Giovedì", friday: "Venerdì", saturday: "Sabato", sunday: "Domenica" };
            hoursStr = Object.entries(days)
              .map(([key, label]) => {
                const h = openingHours[key];
                return h ? `${label}: ${h.open}-${h.close}` : `${label}: Chiuso`;
              })
              .join("\n");
          }
          return { name: studio.name, phone: studio.phone, email: studio.email, address: studio.address, openingHours: hoursStr };
        },
      }),

      getTreatmentTypes: tool({
        description: "Restituisce la lista dei trattamenti disponibili nello studio con nome, descrizione, durata in minuti e categoria.",
        inputSchema: z.object({}),
        execute: async () => {
          const rows = await db
            .select({ id: treatmentTypes.id, name: treatmentTypes.name, description: treatmentTypes.description, durationMinutes: treatmentTypes.defaultDurationMinutes, category: treatmentTypes.category })
            .from(treatmentTypes)
            .where(and(eq(treatmentTypes.studioId, studioId), eq(treatmentTypes.isActive, true)))
            .orderBy(treatmentTypes.name);
          return { treatments: rows };
        },
      }),

      getAvailableSlots: tool({
        description: "Cerca slot disponibili per un appuntamento in un intervallo di date. Restituisce fino a 20 slot liberi con data, ora e dentista.",
        inputSchema: z.object({
          dateFrom: z.string().describe("Data inizio ricerca formato YYYY-MM-DD"),
          dateTo: z.string().describe("Data fine ricerca formato YYYY-MM-DD"),
          durationMinutes: z.number().describe("Durata dell'appuntamento in minuti"),
        }),
        execute: async ({ dateFrom, dateTo, durationMinutes }) => {
          const from = new Date(dateFrom + "T00:00:00");
          const to = new Date(dateTo + "T23:59:59");
          const slots = await findAvailableSlots(studioId, from, to, durationMinutes);
          if (slots.length === 0) {
            return { slots: [], message: "Nessuno slot disponibile nel periodo richiesto." };
          }
          return { slots };
        },
      }),

      bookAppointment: tool({
        description: "Crea un appuntamento con stato 'In Attesa' (pending). Usare SOLO dopo che il paziente ha confermato esplicitamente data, ora e trattamento.",
        inputSchema: z.object({
          startTime: z.string().describe("Data e ora inizio formato ISO 8601 (es: 2026-04-14T10:00:00)"),
          endTime: z.string().describe("Data e ora fine formato ISO 8601"),
          dentistId: z.string().describe("ID del dentista (da getAvailableSlots)"),
          treatmentTypeId: z.string().describe("ID del trattamento (da getTreatmentTypes)"),
          notes: z.string().describe("Riassunto della richiesta del paziente. Iniziare con [Chatbot AI]"),
        }),
        execute: async ({ startTime, endTime, dentistId, treatmentTypeId, notes }) => {
          if (!patient) {
            return { success: false, error: "Paziente non registrato. Impossibile prenotare." };
          }
          try {
            const [appt] = await db
              .insert(appointments)
              .values({
                studioId,
                patientId: patient.id,
                dentistId,
                treatmentTypeId,
                startTime: new Date(startTime),
                endTime: new Date(endTime),
                status: "pending",
                notes,
              })
              .returning({ id: appointments.id, startTime: appointments.startTime, endTime: appointments.endTime });

            const dentist = await db.select({ fullName: users.fullName }).from(users).where(eq(users.id, dentistId)).limit(1);
            const treatment = await db.select({ name: treatmentTypes.name }).from(treatmentTypes).where(eq(treatmentTypes.id, treatmentTypeId)).limit(1);

            return {
              success: true,
              appointment: {
                date: format(appt.startTime, "EEEE d MMMM yyyy", { locale: it }),
                startTime: format(appt.startTime, "HH:mm"),
                endTime: format(appt.endTime, "HH:mm"),
                dentist: dentist[0]?.fullName ?? "N/A",
                treatment: treatment[0]?.name ?? "N/A",
                status: "In Attesa",
              },
            };
          } catch (e) {
            console.error("bookAppointment error:", e);
            return { success: false, error: "Errore nella creazione dell'appuntamento." };
          }
        },
      }),

      listUpcomingAppointments: tool({
        description: "Restituisce la lista degli appuntamenti futuri del paziente (prossimi 60 giorni).",
        inputSchema: z.object({}),
        execute: async () => {
          if (!patient) {
            return { appointments: [], message: "Paziente non registrato." };
          }
          const now = new Date();
          const limit = addDays(now, 60);
          const rows = await db
            .select({
              id: appointments.id,
              startTime: appointments.startTime,
              endTime: appointments.endTime,
              status: appointments.status,
              treatmentName: treatmentTypes.name,
              dentistName: users.fullName,
              notes: appointments.notes,
            })
            .from(appointments)
            .leftJoin(treatmentTypes, eq(appointments.treatmentTypeId, treatmentTypes.id))
            .leftJoin(users, eq(appointments.dentistId, users.id))
            .where(
              and(
                eq(appointments.studioId, studioId),
                eq(appointments.patientId, patient.id),
                gte(appointments.startTime, now),
                lte(appointments.startTime, limit),
                sql`${appointments.status} NOT IN ('cancelled', 'no_show')`
              )
            )
            .orderBy(asc(appointments.startTime))
            .limit(10);

          const statusLabels: Record<string, string> = {
            confirmed: "Confermato",
            pending: "In Attesa",
            completed: "Completato",
          };

          return {
            appointments: rows.map((r) => ({
              id: r.id,
              date: format(r.startTime, "EEEE d MMMM yyyy", { locale: it }),
              startTime: format(r.startTime, "HH:mm"),
              endTime: format(r.endTime, "HH:mm"),
              treatment: r.treatmentName ?? "N/A",
              dentist: r.dentistName ?? "N/A",
              status: statusLabels[r.status] ?? r.status,
            })),
          };
        },
      }),

      cancelAppointment: tool({
        description: "Cancella un appuntamento del paziente. Usare SOLO dopo conferma esplicita del paziente.",
        inputSchema: z.object({
          appointmentId: z.string().describe("ID dell'appuntamento da cancellare"),
        }),
        execute: async ({ appointmentId }) => {
          if (!patient) {
            return { success: false, error: "Paziente non registrato." };
          }
          const [appt] = await db
            .select({ id: appointments.id, patientId: appointments.patientId })
            .from(appointments)
            .where(and(eq(appointments.id, appointmentId), eq(appointments.studioId, studioId)))
            .limit(1);

          if (!appt || appt.patientId !== patient.id) {
            return { success: false, error: "Appuntamento non trovato." };
          }

          await db
            .update(appointments)
            .set({ status: "cancelled", cancellationReason: "Cancellato dal paziente via chatbot AI" })
            .where(eq(appointments.id, appointmentId));

          return { success: true, message: "Appuntamento cancellato con successo." };
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
