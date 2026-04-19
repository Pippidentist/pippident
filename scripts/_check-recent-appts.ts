import { db } from "../lib/db";
import { appointments, patients, studios } from "../lib/db/schema";
import { desc, eq } from "drizzle-orm";

async function main() {
  console.log(`── Now: ${new Date().toISOString()} ──`);
  const appts = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      startTime: appointments.startTime,
      createdAt: appointments.createdAt,
      studioId: appointments.studioId,
      studioName: studios.name,
      studioWaId: studios.whatsappPhoneNumberId,
      patient: patients.firstName,
      patientLast: patients.lastName,
    })
    .from(appointments)
    .leftJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(studios, eq(appointments.studioId, studios.id))
    .orderBy(desc(appointments.createdAt))
    .limit(10);

  for (const a of appts) {
    console.log(
      `[${a.createdAt?.toISOString()}] status=${a.status} start=${a.startTime?.toISOString()} patient=${a.patient} ${a.patientLast} studio=${a.studioName} studioId=${a.studioId} waId=${a.studioWaId ?? "NULL"}`
    );
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
