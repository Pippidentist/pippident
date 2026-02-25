import { auth } from "@/auth";
import { db } from "@/lib/db";
import { quotes, patients, treatmentTypes } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { QuotesClient } from "@/components/payments/quotes-client";

export default async function QuotesPage() {
  const session = await auth();
  const studioId = session!.user.studioId;

  const [quotesData, treatmentTypesList] = await Promise.all([
    db
      .select({
        id: quotes.id,
        quoteNumber: quotes.quoteNumber,
        issueDate: quotes.issueDate,
        expiryDate: quotes.expiryDate,
        status: quotes.status,
        total: quotes.total,
        notes: quotes.notes,
        patientId: quotes.patientId,
        patientFirstName: patients.firstName,
        patientLastName: patients.lastName,
        createdAt: quotes.createdAt,
      })
      .from(quotes)
      .leftJoin(patients, eq(quotes.patientId, patients.id))
      .where(eq(quotes.studioId, studioId))
      .orderBy(desc(quotes.createdAt)),

    db
      .select({
        id: treatmentTypes.id,
        name: treatmentTypes.name,
        listPrice: treatmentTypes.listPrice,
        defaultDurationMinutes: treatmentTypes.defaultDurationMinutes,
      })
      .from(treatmentTypes)
      .where(eq(treatmentTypes.studioId, studioId)),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Preventivi</h1>
        <p className="text-gray-500 mt-1">
          Gestione preventivi per i pazienti
        </p>
      </div>
      <QuotesClient initialQuotes={quotesData} treatmentTypes={treatmentTypesList} />
    </div>
  );
}
