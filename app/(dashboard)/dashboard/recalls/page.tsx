import { auth } from "@/auth";
import { db } from "@/lib/db";
import { recalls, patients } from "@/lib/db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { addDays, format } from "date-fns";
import { RecallsClient } from "@/components/recalls/recalls-client";

export default async function RecallsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; status?: string }>;
}) {
  const session = await auth();
  const studioId = session!.user.studioId;
  const sp = await searchParams;

  const daysWindow = parseInt(sp.days ?? "30");
  const statusFilter = sp.status ?? "active";

  const today = new Date();
  const futureDate = addDays(today, daysWindow);

  const conditions = [
    eq(recalls.studioId, studioId),
    ...(statusFilter !== "all"
      ? [eq(recalls.status, statusFilter as "active" | "sent" | "completed" | "ignored")]
      : []),
    gte(recalls.dueDate, format(today, "yyyy-MM-dd")),
    lte(recalls.dueDate, format(futureDate, "yyyy-MM-dd")),
  ].filter(Boolean) as Parameters<typeof and>;

  const data = await db
    .select({
      id: recalls.id,
      recallType: recalls.recallType,
      dueDate: recalls.dueDate,
      status: recalls.status,
      notes: recalls.notes,
      createdAutomatically: recalls.createdAutomatically,
      patientId: recalls.patientId,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      patientPhone: patients.phone,
    })
    .from(recalls)
    .leftJoin(patients, eq(recalls.patientId, patients.id))
    .where(and(...conditions))
    .orderBy(recalls.dueDate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Richiami</h1>
        <p className="text-gray-500 mt-1">
          Promemoria periodici per i pazienti
        </p>
      </div>
      <RecallsClient
        initialRecalls={data}
        daysWindow={daysWindow}
        statusFilter={statusFilter}
      />
    </div>
  );
}
