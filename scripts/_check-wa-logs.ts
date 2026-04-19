import { db } from "../lib/db";
import { whatsappMessages, appointments, patients, studios } from "../lib/db/schema";
import { desc, eq } from "drizzle-orm";

async function main() {
  console.log(`── Current time: ${new Date().toISOString()} ──`);

  const rows = await db
    .select()
    .from(whatsappMessages)
    .orderBy(desc(whatsappMessages.sentAt))
    .limit(5);
  console.log(`\n── Last 5 whatsapp_messages ──`);
  for (const r of rows) {
    console.log(`[${r.sentAt?.toISOString()}] ${r.direction} ${r.messageType} ${r.status}`);
  }

  const appts = await db
    .select({
      id: appointments.id,
      status: appointments.status,
      startTime: appointments.startTime,
      createdAt: appointments.createdAt,
      updatedAt: appointments.updatedAt,
      patient: patients.firstName,
      studio: studios.name,
      studioWaId: studios.whatsappPhoneNumberId,
    })
    .from(appointments)
    .leftJoin(patients, eq(appointments.patientId, patients.id))
    .leftJoin(studios, eq(appointments.studioId, studios.id))
    .orderBy(desc(appointments.updatedAt))
    .limit(5);
  console.log(`\n── Last 5 appointments (by updatedAt) ──`);
  for (const a of appts) {
    console.log(`[upd=${a.updatedAt?.toISOString()}] [crt=${a.createdAt?.toISOString()}] ${a.status} — ${a.patient} @ ${a.studio} (waId=${a.studioWaId ?? "NULL"})`);
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
