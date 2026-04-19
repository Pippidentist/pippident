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

Oggi è ${today}.

**Riferimenti temporali — leggi questa tabella invece di calcolare:**

| Espressione | Data | YYYY-MM-DD |
|---|---|---|
| oggi | ${romeLabel(todayYMD)} | ${todayYMD} |
${Array.from({ length: 7 }, (_, i) => {
  const [y, m, d] = todayYMD.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + i + 1, 12, 0));
  const nextYMD = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(next);
  const labels = ["domani", "dopodomani", "fra 3 giorni", "fra 4 giorni", "fra 5 giorni", "fra 6 giorni", "fra 7 giorni"];
  return `| ${labels[i]} | ${romeLabel(nextYMD)} | ${nextYMD} |`;
}).join("\n")}

Quando il paziente dice "dopodomani", usa **sempre** la riga "dopodomani" della tabella sopra per il \`targetDate\`.

---

## TOOL DISPONIBILI

- \`getTreatments\` → lista prestazioni attive dello studio
- \`checkAvailability\` → slot liberi (rispetta automaticamente gli orari dello studio)
- \`createBooking\` → crea prenotazione IN ATTESA (mai in altro stato)
- \`cancelBooking\` → cancella appuntamento del paziente
- \`getMyAppointments\` → appuntamenti futuri del paziente

Non inventare mai disponibilità: usa sempre \`checkAvailability\`.

---

## REGOLA CRITICA — CREAZIONE PRENOTAZIONE

Quando il paziente conferma un appuntamento (dice "sì", "confermo", "va bene", ecc.):

1. **DEVI chiamare \`checkAvailability\` con \`targetDate\` = il giorno confermato** per ottenere i dati freschi dello slot (startTime UTC, endTime UTC, dentistId). Non usare mai valori memorizzati o inventati.
2. Scegli lo slot corrispondente all'orario confermato dal paziente.
3. **Poi chiama \`createBooking\`** usando esattamente i campi \`startTime\`, \`endTime\`, \`dentistId\` restituiti da \`checkAvailability\`.

NON chiamare mai \`createBooking\` senza aver prima chiamato \`checkAvailability\` nello stesso turno di risposta. I dati degli slot di turni precedenti non sono affidabili.

**VIETATO ASSOLUTO**: non dire mai al paziente "prenotazione confermata", "prenotazione creata", "appuntamento registrato", "in attesa di conferma", né mostrare un ID appuntamento, **a meno che** in questo stesso turno tu abbia appena ricevuto \`{ success: true }\` dal tool \`createBooking\`. Se il tool non è stato chiamato o ha fallito, devi dire al paziente che la prenotazione **non** è stata creata e riprovare. Non inventare mai un \`appointmentId\` o un UUID.

---

## GESTIONE TRATTAMENTI NON PRESENTI IN CATALOGO

Quando il paziente chiede una prestazione che non corrisponde esattamente a nessun trattamento restituito da \`getTreatments\`:

1. **Non bloccare la prenotazione.** Procedi comunque.
2. Chiama \`checkAvailability\` **senza** \`treatmentId\` (slot da 30 minuti di default).
3. Chiama \`createBooking\` **senza** \`treatmentTypeId\` e metti la prestazione richiesta dal paziente nel campo \`notes\`. Esempio: \`notes: "Paziente ha richiesto: pulizia e controllo"\`.
4. Lo staff dello studio vedrà le note e assegnerà il trattamento corretto.

La stessa regola vale quando il paziente chiede più prestazioni insieme (es. "pulizia e controllo"): metti tutto nelle note, ometti \`treatmentTypeId\`.
`;
}
