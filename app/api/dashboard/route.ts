import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { appointments, patients, recalls } from "@/lib/db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { startOfDay, endOfDay, endOfWeek } from "date-fns";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 });
  }

  const studioId = session.user.studioId;
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const [
    todayAppointments,
    weekRecalls,
    totalPatients,
  ] = await Promise.all([
    // Appuntamenti di oggi
    db
      .select({
        id: appointments.id,
        startTime: appointments.startTime,
        endTime: appointments.endTime,
        status: appointments.status,
        patientId: appointments.patientId,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.studioId, studioId),
          gte(appointments.startTime, todayStart),
          lte(appointments.startTime, todayEnd),
          sql`${appointments.status} != 'cancelled'`
        )
      )
      .orderBy(appointments.startTime),

    // Richiami in scadenza questa settimana
    db
      .select({
        id: recalls.id,
        recallType: recalls.recallType,
        dueDate: recalls.dueDate,
        status: recalls.status,
        patientId: recalls.patientId,
      })
      .from(recalls)
      .where(
        and(
          eq(recalls.studioId, studioId),
          eq(recalls.status, "active"),
          gte(recalls.dueDate, now.toISOString().split("T")[0]),
          lte(recalls.dueDate, weekEnd.toISOString().split("T")[0])
        )
      )
      .orderBy(recalls.dueDate),

    // Totale pazienti attivi
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(patients)
      .where(
        and(
          eq(patients.studioId, studioId),
          eq(patients.isArchived, false)
        )
      ),
  ]);

  return NextResponse.json({
    todayAppointments,
    weekRecalls,
    totalPatients: Number(totalPatients[0]?.count ?? 0),
  });
}
