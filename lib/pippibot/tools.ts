import { tool, jsonSchema } from "ai";
import { db } from "@/lib/db";
import {
  appointments,
  patients,
  treatmentTypes,
  users,
  studios,
} from "@/lib/db/schema";
import { eq, and, gte, lte, or, sql } from "drizzle-orm";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { Studio, Patient } from "@/lib/db/schema";

// ── Timezone helpers ─────────────────────────────────────────────────────────

/** Returns YYYY-MM-DD for a given UTC Date in Europe/Rome timezone */
function getRomeDateStr(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Returns the English weekday name (e.g. "Monday") in Europe/Rome timezone */
function getRomeDayName(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Europe/Rome",
  }).format(date);
}

/**
 * Converts a Rome-timezone date+time pair to a UTC Date.
 * dateStr: "YYYY-MM-DD" in Rome time
 * timeStr: "HH:MM" in Rome time
 */
function romeTimeToUTC(dateStr: string, timeStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, min] = timeStr.split(":").map(Number);

  // Start with a UTC date at the requested clock time
  const ref = new Date(Date.UTC(y, m - 1, d, h, min));

  // What hour does that UTC moment represent in Rome?
  const romeH = parseInt(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/Rome",
    }).format(ref)
  );

  // Compute Rome offset (positive → Rome is ahead of UTC)
  let offset = romeH - h;
  if (offset > 12) offset -= 24;
  if (offset < -12) offset += 24;

  // Subtract offset to get the UTC instant that equals the requested Rome time
  return new Date(ref.getTime() - offset * 3_600_000);
}

/** Default opening hours used when the studio has none configured */
const DEFAULT_OPENING_HOURS: Record<string, { open: string; close: string }> = {
  Monday: { open: "09:00", close: "18:00" },
  Tuesday: { open: "09:00", close: "18:00" },
  Wednesday: { open: "09:00", close: "18:00" },
  Thursday: { open: "09:00", close: "18:00" },
  Friday: { open: "09:00", close: "18:00" },
};

// ── Tool builder ─────────────────────────────────────────────────────────────

export function buildTools(studio: Studio, patient: Patient) {
  const studioId = studio.id;
  const patientId = patient.id;

  const settings = studio.settings as {
    openingHours?: Record<string, { open: string; close: string }>;
  } | null;

  const openingHours =
    settings?.openingHours && Object.keys(settings.openingHours).length > 0
      ? settings.openingHours
      : DEFAULT_OPENING_HOURS;

  // ── getTreatments ──────────────────────────────────────────────────────────

  const getTreatments = tool({
    description:
      "Recupera la lista delle prestazioni dentistiche disponibili nello studio. Usa questo tool quando il paziente vuole sapere cosa offre lo studio o per trovare il tipo di cura giusto.",
    parameters: jsonSchema({ type: "object" as const, properties: {} }),
    execute: async () => {
      const treatments = await db
        .select({
          id: treatmentTypes.id,
          name: treatmentTypes.name,
          description: treatmentTypes.description,
          category: treatmentTypes.category,
          defaultDurationMinutes: treatmentTypes.defaultDurationMinutes,
        })
        .from(treatmentTypes)
        .where(
          and(eq(treatmentTypes.studioId, studioId), eq(treatmentTypes.isActive, true))
        )
        .orderBy(treatmentTypes.category, treatmentTypes.name);

      return { treatments };
    },
  });

  // ── checkAvailability ──────────────────────────────────────────────────────

  const checkAvailability = tool({
    description:
      "Controlla gli slot disponibili nel calendario dello studio per una prestazione. Rispetta automaticamente gli orari di apertura e controlla i conflitti con appuntamenti esistenti. Restituisce massimo 10 slot.",
    parameters: jsonSchema({
      type: "object" as const,
      properties: {
        treatmentId: {
          type: "string",
          description: "ID del tipo di trattamento (lascia vuoto per durata predefinita 30 min)",
        },
        daysAhead: {
          type: "integer",
          minimum: 1,
          maximum: 30,
          default: 7,
          description: "Quanti giorni avanti cercare (default 7, max 30)",
        },
      },
    }),
    execute: async ({ treatmentId, daysAhead = 7 }: { treatmentId?: string; daysAhead?: number }) => {
      // Get treatment duration
      let durationMinutes = 30;
      let treatmentName = "Visita";

      if (treatmentId) {
        const [treatment] = await db
          .select({
            defaultDurationMinutes: treatmentTypes.defaultDurationMinutes,
            name: treatmentTypes.name,
          })
          .from(treatmentTypes)
          .where(
            and(
              eq(treatmentTypes.id, treatmentId),
              eq(treatmentTypes.studioId, studioId)
            )
          )
          .limit(1);

        if (treatment) {
          durationMinutes = treatment.defaultDurationMinutes;
          treatmentName = treatment.name;
        }
      }

      // Get active dentists
      const dentists = await db
        .select({ id: users.id, name: users.fullName })
        .from(users)
        .where(
          and(
            eq(users.studioId, studioId),
            eq(users.role, "dentist"),
            eq(users.isActive, true)
          )
        );

      if (dentists.length === 0) {
        return {
          slots: [],
          message: "Nessun dentista disponibile al momento. Contatta lo studio.",
        };
      }

      const slots: Array<{
        startTime: string;
        endTime: string;
        dentistId: string;
        dentistName: string;
        label: string;
      }> = [];

      const now = new Date();

      for (let dayOffset = 0; dayOffset < daysAhead && slots.length < 10; dayOffset++) {
        // Advance by dayOffset days from tomorrow
        const baseDate = new Date(now);
        baseDate.setDate(baseDate.getDate() + 1 + dayOffset);

        const romeDateStr = getRomeDateStr(baseDate);
        const dayName = getRomeDayName(baseDate);
        const dayHours = openingHours[dayName];

        if (!dayHours) continue; // Studio closed this day

        const [openH, openM] = dayHours.open.split(":").map(Number);
        const [closeH, closeM] = dayHours.close.split(":").map(Number);
        const openMinutes = openH * 60 + openM;
        const closeMinutes = closeH * 60 + closeM;

        for (
          let slotStart = openMinutes;
          slotStart + durationMinutes <= closeMinutes && slots.length < 10;
          slotStart += durationMinutes
        ) {
          const slotEnd = slotStart + durationMinutes;

          const startHH = String(Math.floor(slotStart / 60)).padStart(2, "0");
          const startMM = String(slotStart % 60).padStart(2, "0");
          const endHH = String(Math.floor(slotEnd / 60)).padStart(2, "0");
          const endMM = String(slotEnd % 60).padStart(2, "0");

          const slotStartUTC = romeTimeToUTC(romeDateStr, `${startHH}:${startMM}`);
          const slotEndUTC = romeTimeToUTC(romeDateStr, `${endHH}:${endMM}`);

          // Skip slots in the past
          if (slotStartUTC <= now) continue;

          // Find first available dentist for this slot
          for (const dentist of dentists) {
            const conflicts = await db
              .select({ id: appointments.id })
              .from(appointments)
              .where(
                and(
                  eq(appointments.studioId, studioId),
                  eq(appointments.dentistId, dentist.id),
                  sql`${appointments.status} NOT IN ('cancelled', 'no_show')`,
                  or(
                    and(
                      gte(appointments.startTime, slotStartUTC),
                      lte(appointments.startTime, slotEndUTC)
                    ),
                    and(
                      gte(appointments.endTime, slotStartUTC),
                      lte(appointments.endTime, slotEndUTC)
                    ),
                    and(
                      lte(appointments.startTime, slotStartUTC),
                      gte(appointments.endTime, slotEndUTC)
                    )
                  )
                )
              )
              .limit(1);

            if (conflicts.length === 0) {
              const label = format(slotStartUTC, "EEEE d MMMM 'alle' HH:mm", {
                locale: it,
              });

              slots.push({
                startTime: slotStartUTC.toISOString(),
                endTime: slotEndUTC.toISOString(),
                dentistId: dentist.id,
                dentistName: dentist.name,
                label,
              });
              break; // Found a dentist, move to next time slot
            }
          }
        }
      }

      return {
        slots,
        treatmentName,
        durationMinutes,
        message:
          slots.length === 0
            ? `Nessuno slot disponibile nei prossimi ${daysAhead} giorni. Prova ad aumentare il periodo di ricerca.`
            : undefined,
      };
    },
  });

  // ── createBooking ──────────────────────────────────────────────────────────

  const createBooking = tool({
    description:
      "Crea una prenotazione IN ATTESA per il paziente. Chiama questo tool SOLO dopo conferma esplicita del paziente (sì/confermo). Lo stato sarà sempre 'In Attesa' — lo staff dello studio lo confermerà.",
    parameters: jsonSchema({
      type: "object" as const,
      properties: {
        treatmentTypeId: { type: "string", description: "ID del tipo di trattamento" },
        startTime: { type: "string", description: "Orario inizio in formato ISO8601 UTC" },
        endTime: { type: "string", description: "Orario fine in formato ISO8601 UTC" },
        dentistId: { type: "string", description: "ID del dentista" },
        notes: { type: "string", description: "Note aggiuntive del paziente" },
      },
      required: ["treatmentTypeId", "startTime", "endTime", "dentistId"],
    }),
    execute: async ({ treatmentTypeId, startTime, endTime, dentistId, notes }: { treatmentTypeId: string; startTime: string; endTime: string; dentistId: string; notes?: string }) => {
      // Double-check opening hours before inserting
      const startDate = new Date(startTime);
      const dayName = getRomeDayName(startDate);
      const dayHours = openingHours[dayName];

      if (!dayHours) {
        return {
          success: false,
          error: "Lo studio è chiuso in questo giorno. Scegli un altro slot.",
        };
      }

      const toMin = (hhmm: string) => {
        const [h, m] = hhmm.split(":").map(Number);
        return h * 60 + m;
      };
      const startTimeStr = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/Rome",
      }).format(startDate);
      const endTimeStr = new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Europe/Rome",
      }).format(new Date(endTime));

      if (
        toMin(startTimeStr) < toMin(dayHours.open) ||
        toMin(endTimeStr) > toMin(dayHours.close)
      ) {
        return {
          success: false,
          error: `Lo studio è aperto dalle ${dayHours.open} alle ${dayHours.close}. Scegli un altro slot.`,
        };
      }

      // Check conflict one more time before inserting
      const conflict = await db
        .select({ id: appointments.id })
        .from(appointments)
        .where(
          and(
            eq(appointments.studioId, studioId),
            eq(appointments.dentistId, dentistId),
            sql`${appointments.status} NOT IN ('cancelled', 'no_show')`,
            or(
              and(
                gte(appointments.startTime, new Date(startTime)),
                lte(appointments.startTime, new Date(endTime))
              ),
              and(
                gte(appointments.endTime, new Date(startTime)),
                lte(appointments.endTime, new Date(endTime))
              ),
              and(
                lte(appointments.startTime, new Date(startTime)),
                gte(appointments.endTime, new Date(endTime))
              )
            )
          )
        )
        .limit(1);

      if (conflict.length > 0) {
        return {
          success: false,
          error: "Lo slot non è più disponibile. Cerca altri slot con checkAvailability.",
        };
      }

      const [appointment] = await db
        .insert(appointments)
        .values({
          studioId,
          patientId,
          dentistId,
          treatmentTypeId,
          startTime: new Date(startTime),
          endTime: new Date(endTime),
          status: "pending", // Always pending from Pippibot
          notes: notes ?? null,
        })
        .returning({
          id: appointments.id,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
        });

      const appointmentLabel = format(
        new Date(startTime),
        "EEEE d MMMM 'alle' HH:mm",
        { locale: it }
      );

      return {
        success: true,
        appointmentId: appointment.id,
        label: appointmentLabel,
        status: "pending",
        message:
          "Prenotazione creata con successo. Lo staff dello studio la confermerà a breve.",
      };
    },
  });

  // ── cancelBooking ──────────────────────────────────────────────────────────

  const cancelBooking = tool({
    description:
      "Cancella un appuntamento del paziente. Verifica che l'appuntamento appartenga al paziente corrente prima di cancellarlo.",
    parameters: jsonSchema({
      type: "object" as const,
      properties: {
        appointmentId: { type: "string", description: "ID dell'appuntamento da cancellare" },
        reason: { type: "string", description: "Motivo della cancellazione (opzionale)" },
      },
      required: ["appointmentId"],
    }),
    execute: async ({ appointmentId, reason }: { appointmentId: string; reason?: string }) => {
      // Security check: appointment must belong to this patient and studio
      const [appointment] = await db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          status: appointments.status,
        })
        .from(appointments)
        .where(
          and(
            eq(appointments.id, appointmentId),
            eq(appointments.patientId, patientId),
            eq(appointments.studioId, studioId)
          )
        )
        .limit(1);

      if (!appointment) {
        return {
          success: false,
          error: "Appuntamento non trovato o non appartiene a questo paziente.",
        };
      }

      if (appointment.status === "cancelled") {
        return { success: false, error: "L'appuntamento è già stato cancellato." };
      }

      if (appointment.status === "completed") {
        return {
          success: false,
          error: "Non è possibile cancellare un appuntamento già effettuato.",
        };
      }

      await db
        .update(appointments)
        .set({
          status: "cancelled",
          cancellationReason: reason ?? "Cancellato dal paziente tramite Pippibot",
          updatedAt: new Date(),
        })
        .where(eq(appointments.id, appointmentId));

      const label = format(
        new Date(appointment.startTime),
        "EEEE d MMMM 'alle' HH:mm",
        { locale: it }
      );

      return { success: true, label };
    },
  });

  // ── getMyAppointments ──────────────────────────────────────────────────────

  const getMyAppointments = tool({
    description:
      "Recupera i prossimi appuntamenti del paziente (futuri, non cancellati). Usa questo tool quando il paziente vuole vedere i suoi appuntamenti o vuole cancellarne uno.",
    parameters: jsonSchema({ type: "object" as const, properties: {} }),
    execute: async () => {
      const now = new Date();

      const upcomingAppointments = await db
        .select({
          id: appointments.id,
          startTime: appointments.startTime,
          endTime: appointments.endTime,
          status: appointments.status,
          notes: appointments.notes,
          treatmentName: treatmentTypes.name,
          dentistName: users.fullName,
        })
        .from(appointments)
        .leftJoin(treatmentTypes, eq(appointments.treatmentTypeId, treatmentTypes.id))
        .leftJoin(users, eq(appointments.dentistId, users.id))
        .where(
          and(
            eq(appointments.patientId, patientId),
            eq(appointments.studioId, studioId),
            gte(appointments.startTime, now),
            sql`${appointments.status} NOT IN ('cancelled', 'no_show')`
          )
        )
        .orderBy(appointments.startTime)
        .limit(10);

      const formatted = upcomingAppointments.map((a) => ({
        id: a.id,
        label: format(new Date(a.startTime), "EEEE d MMMM 'alle' HH:mm", {
          locale: it,
        }),
        treatment: a.treatmentName ?? "Visita",
        dentist: a.dentistName ?? "Dentista",
        status:
          a.status === "pending"
            ? "In Attesa di Conferma"
            : a.status === "confirmed"
            ? "Confermato"
            : a.status,
      }));

      return {
        appointments: formatted,
        count: formatted.length,
      };
    },
  });

  return {
    getTreatments,
    checkAvailability,
    createBooking,
    cancelBooking,
    getMyAppointments,
  };
}
