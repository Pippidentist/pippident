import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, treatmentTypes, studios } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { CalendarClient } from "@/components/calendar/calendar-client";

const DEFAULT_OPENING_HOURS: Record<string, { open: string; close: string }> = {
  Monday: { open: "09:00", close: "18:00" },
  Tuesday: { open: "09:00", close: "18:00" },
  Wednesday: { open: "09:00", close: "18:00" },
  Thursday: { open: "09:00", close: "18:00" },
  Friday: { open: "09:00", close: "18:00" },
};

export default async function CalendarPage() {
  const session = await auth();
  const studioId = session!.user.studioId;

  const [dentists, treatmentTypesList, studioRow] = await Promise.all([
    db
      .select({ id: users.id, fullName: users.fullName })
      .from(users)
      .where(
        and(
          eq(users.studioId, studioId),
          eq(users.isActive, true)
        )
      )
      .orderBy(users.fullName),

    db
      .select({ id: treatmentTypes.id, name: treatmentTypes.name, defaultDurationMinutes: treatmentTypes.defaultDurationMinutes })
      .from(treatmentTypes)
      .where(and(eq(treatmentTypes.studioId, studioId), eq(treatmentTypes.isActive, true)))
      .orderBy(treatmentTypes.name),

    db
      .select({ settings: studios.settings })
      .from(studios)
      .where(eq(studios.id, studioId))
      .limit(1),
  ]);

  const settings = (studioRow[0]?.settings ?? null) as {
    openingHours?: Record<string, { open: string; close: string }>;
  } | null;
  const openingHours =
    settings?.openingHours && Object.keys(settings.openingHours).length > 0
      ? settings.openingHours
      : DEFAULT_OPENING_HOURS;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Calendario</h1>
        <p className="text-gray-500 mt-1">Gestione appuntamenti e disponibilità</p>
      </div>
      <CalendarClient
        dentists={dentists}
        treatmentTypes={treatmentTypesList}
        currentUserId={session!.user.id}
        currentUserRole={session!.user.role}
        openingHours={openingHours}
      />
    </div>
  );
}
