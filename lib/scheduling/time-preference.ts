/**
 * Time-of-day preference per type of dental treatment.
 *
 * Shared between Pippibot (WhatsApp) and Pippivoice (phone). When the
 * agent proposes slots to a patient and the patient has no specific
 * time preference, we want to surface the "right" slots first — based
 * on dental practice management best practices:
 *
 *   - Complex/long procedures (implants, oral surgery, root canals,
 *     prosthetics) → morning (≤ 13:00) — operator at peak focus,
 *     patient not yet fatigued, full day to handle any complications.
 *   - Light/routine procedures (hygiene, cleanings, check-ups,
 *     whitening, suture removal) → afternoon (≥ 14:00) — lower
 *     cognitive load late in the day, quick turnover.
 *   - Everything else → no preference, keep chronological order.
 *
 * The mapping is keyword-based (looks at treatment name + category),
 * so it works across studios without requiring DB migrations or
 * configuration. If the studio has unusual treatment names that don't
 * match the heuristic, it falls back to chronological order — safe
 * default, no regression vs current behavior.
 */

export type TimeTier = "morning" | "afternoon" | "any";

/** Threshold (Rome time, 24h) between "morning" and "afternoon" buckets */
const AFTERNOON_HOUR_THRESHOLD = 14;

/**
 * Maps a treatment to its preferred time-of-day tier.
 * Case-insensitive keyword matching on name + category.
 */
export function preferredTimeTier(
  treatmentName: string | null | undefined,
  treatmentCategory: string | null | undefined
): TimeTier {
  const text = `${treatmentName ?? ""} ${treatmentCategory ?? ""}`.toLowerCase();

  // High complexity → morning
  const morningPatterns =
    /(impianto|implant|chirurg|endodon|devital|protes|riabilitaz|rigenera|estraz.{0,20}(complessa|ottava|giudizio)|innesto|rialzo)/i;
  if (morningPatterns.test(text)) return "morning";

  // Low complexity → afternoon
  const afternoonPatterns =
    /(igien|pulizia|controllo|sbiancament|rimozion.{0,20}punt|seduta\s+di\s+richiamo|sigillatura)/i;
  if (afternoonPatterns.test(text)) return "afternoon";

  return "any";
}

/** Returns the hour (0-23) of an ISO8601 UTC timestamp in Europe/Rome timezone */
function getRomeHour(isoUtc: string): number {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Rome",
    hour: "numeric",
    hour12: false,
  }).format(new Date(isoUtc));
  return parseInt(hourStr, 10);
}

/**
 * Re-orders an already-chronological list of slots so that those in the
 * preferred time bucket appear first, while preserving chronological
 * order within each bucket.
 *
 * Examples (preferring morning):
 *   [09:00, 10:00, 14:00, 15:00] → [09:00, 10:00, 14:00, 15:00] (unchanged)
 *   [14:00, 15:00, 09:00, 10:00] → [09:00, 10:00, 14:00, 15:00]
 *
 * Returns a new array; does not mutate the input.
 */
export function sortSlotsByPreference<T extends { startTime: string }>(
  slots: T[],
  tier: TimeTier
): T[] {
  if (tier === "any" || slots.length <= 1) return slots;

  const wantAfternoon = tier === "afternoon";

  const tagged = slots.map((slot, originalIndex) => ({
    slot,
    originalIndex,
    inAfternoon: getRomeHour(slot.startTime) >= AFTERNOON_HOUR_THRESHOLD,
  }));

  tagged.sort((a, b) => {
    if (a.inAfternoon !== b.inAfternoon) {
      // Different buckets: preferred bucket first
      if (wantAfternoon) return a.inAfternoon ? -1 : 1;
      return a.inAfternoon ? 1 : -1;
    }
    // Same bucket: preserve chronological order (input is already chronological)
    return a.originalIndex - b.originalIndex;
  });

  return tagged.map((t) => t.slot);
}
