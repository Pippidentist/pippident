import type { Studio, Patient } from "@/lib/db/schema";
import { KNOWLEDGE_BASE } from "./knowledge-base";

function formatOpeningHours(
  openingHours: Record<string, { open: string; close: string }> | undefined
): string {
  if (!openingHours || Object.keys(openingHours).length === 0) {
    return "Non configurati — contatta lo studio per informazioni sugli orari";
  }

  const DAY_LABELS: Record<string, string> = {
    Monday: "Lun",
    Tuesday: "Mar",
    Wednesday: "Mer",
    Thursday: "Gio",
    Friday: "Ven",
    Saturday: "Sab",
    Sunday: "Dom",
  };
  const ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  const lines = ORDER.map((day) => {
    const label = DAY_LABELS[day] ?? day;
    const hours = openingHours[day];
    return hours ? `${label}: ${hours.open}–${hours.close}` : `${label}: Chiuso`;
  });

  return lines.join(" | ");
}

export function buildSystemPrompt(studio: Studio, patient: Patient): string {
  const settings = studio.settings as {
    openingHours?: Record<string, { open: string; close: string }>;
    emergencyHospital?: string;
  } | null;

  const openingHoursText = formatOpeningHours(settings?.openingHours);
  const emergencyHospital =
    settings?.emergencyHospital ?? "il Pronto Soccorso più vicino";

  const now = new Date();

  // All date math done in Rome timezone to avoid UTC edge cases on Vercel
  const romeLabel = (ymd: string) => {
    // Parse YYYY-MM-DD as a noon-UTC date (avoids DST/midnight ambiguity)
    const [y, m, d] = ymd.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0));
    return new Intl.DateTimeFormat("it-IT", {
      weekday: "long", day: "numeric", month: "long", year: "numeric",
      timeZone: "Europe/Rome",
    }).format(date);
  };

  // Today's date as YYYY-MM-DD in Rome timezone
  const todayYMD = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(now);
  const today = romeLabel(todayYMD);

  // Explicit date table for next 7 days — LLM reads this instead of computing
  const nextDays = Array.from({ length: 7 }, (_, i) => {
    const [y, m, d] = todayYMD.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + i + 1, 12, 0));
    const nextYMD = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(next);
    return `${romeLabel(nextYMD)} → ${nextYMD}`;
  }).join("\n");

  return `${KNOWLEDGE_BASE}

---

## DATI STUDIO CORRENTE

- **Nome**: ${studio.name}
- **Indirizzo**: ${studio.address ?? "Non specificato"}
- **Telefono**: ${studio.phone ?? "Non specificato"}
- **Email**: ${studio.email ?? "Non specificata"}
- **Orari di apertura**: ${openingHoursText}
- **Pronto Soccorso Odontoiatrico di riferimento**: ${emergencyHospital}

---

## PAZIENTE IDENTIFICATO

- **Nome**: ${patient.firstName} ${patient.lastName}
- **ID interno**: ${patient.id}
- **Telefono**: ${patient.phone} (VERIFICATO tramite WhatsApp — non chiedere mai)

Il paziente è già registrato e verificato. Non chiedere mai il numero di telefono.

---

## DATA ODIERNA

Oggi è ${today}. Usa questa data per i riferimenti temporali.

Prossimi 7 giorni (usa questi valori YYYY-MM-DD per targetDate):
${nextDays}

---

## TOOL DISPONIBILI

- \`getTreatments\` → lista prestazioni attive dello studio
- \`checkAvailability\` → slot liberi (rispetta automaticamente gli orari dello studio)
- \`createBooking\` → crea prenotazione IN ATTESA (mai in altro stato)
- \`cancelBooking\` → cancella appuntamento del paziente
- \`getMyAppointments\` → appuntamenti futuri del paziente

Non inventare mai disponibilità: usa sempre \`checkAvailability\`.
`;
}
