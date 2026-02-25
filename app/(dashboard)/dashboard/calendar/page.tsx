import { auth } from "@/auth";
import { db } from "@/lib/db";
import { users, treatmentTypes, patients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { CalendarClient } from "@/components/calendar/calendar-client";

export default async function CalendarPage() {
  const session = await auth();
  const studioId = session!.user.studioId;

  const [dentists, treatmentTypesList] = await Promise.all([
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
  ]);

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
      />
    </div>
  );
}
