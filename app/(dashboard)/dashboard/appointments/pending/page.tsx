import { auth } from "@/auth";
import { db } from "@/lib/db";
import { appointments, patients, treatmentTypes, users } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { PendingAppointmentsClient } from "@/components/appointments/pending-appointments-client";

export default async function PendingAppointmentsPage() {
  const session = await auth();
  const studioId = session!.user.studioId;

  const rows = await db
    .select({
      id: appointments.id,
      startTime: appointments.startTime,
      endTime: appointments.endTime,
      notes: appointments.notes,
      createdAt: appointments.createdAt,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      patientPhone: patients.phone,
      treatmentName: treatmentTypes.name,
      dentistName: users.fullName,
    })
    .from(appointments)
    .leftJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(treatmentTypes, eq(appointments.treatmentTypeId, treatmentTypes.id))
    .leftJoin(users, eq(appointments.dentistId, users.id))
    .where(and(eq(appointments.studioId, studioId), eq(appointments.status, "pending")))
    .orderBy(asc(appointments.startTime));

  const pendingAppointments = rows.map((r) => ({
    id: r.id,
    startTime: r.startTime.toISOString(),
    endTime: r.endTime.toISOString(),
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
    patientName: r.patientFirstName && r.patientLastName
      ? `${r.patientFirstName} ${r.patientLastName}`
      : "N/A",
    patientPhone: r.patientPhone ?? "",
    treatmentName: r.treatmentName ?? "N/A",
    dentistName: r.dentistName ?? "N/A",
  }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Appuntamenti In Attesa</h1>
        <p className="text-gray-500 mt-1">
          Appuntamenti prenotati dal chatbot AI in attesa di conferma
        </p>
      </div>
      <PendingAppointmentsClient appointments={pendingAppointments} />
    </div>
  );
}
