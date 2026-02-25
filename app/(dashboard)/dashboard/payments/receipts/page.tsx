import { auth } from "@/auth";
import { db } from "@/lib/db";
import { payments, patients } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { ReceiptsClient } from "@/components/payments/receipts-client";

export default async function ReceiptsPage() {
  const session = await auth();
  const studioId = session!.user.studioId;

  const data = await db
    .select({
      id: payments.id,
      receiptNumber: payments.receiptNumber,
      paymentDate: payments.paymentDate,
      amount: payments.amount,
      paymentMethod: payments.paymentMethod,
      notes: payments.notes,
      patientId: payments.patientId,
      patientFirstName: patients.firstName,
      patientLastName: patients.lastName,
      quoteId: payments.quoteId,
      createdAt: payments.createdAt,
    })
    .from(payments)
    .leftJoin(patients, eq(payments.patientId, patients.id))
    .where(eq(payments.studioId, studioId))
    .orderBy(desc(payments.createdAt));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pagamenti e Ricevute</h1>
        <p className="text-gray-500 mt-1">Storico pagamenti e ricevute generate</p>
      </div>
      <ReceiptsClient initialPayments={data} />
    </div>
  );
}
