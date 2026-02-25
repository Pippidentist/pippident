import { auth } from "@/auth";
import { db } from "@/lib/db";
import { treatmentTypes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { TreatmentsClient } from "@/components/treatments/treatments-client";

export default async function TreatmentsPage() {
  const session = await auth();
  const studioId = session!.user.studioId;

  const data = await db
    .select()
    .from(treatmentTypes)
    .where(eq(treatmentTypes.studioId, studioId))
    .orderBy(treatmentTypes.category, treatmentTypes.name);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Catalogo Cure</h1>
        <p className="text-gray-500 mt-1">
          Gestisci i tipi di visita e le cure offerte dallo studio
        </p>
      </div>
      <TreatmentsClient initialTreatments={data} />
    </div>
  );
}
