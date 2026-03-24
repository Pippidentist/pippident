import { db } from "@/lib/db";
import { studios } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { PatientRegistrationForm } from "@/components/register/patient-registration-form";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ studioId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { studioId } = await params;
  const [studio] = await db
    .select({ name: studios.name })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);
  return {
    title: studio ? `Registrazione — ${studio.name}` : "Registrazione paziente",
  };
}

export default async function RegisterPage({ params }: Props) {
  const { studioId } = await params;

  const [studio] = await db
    .select({ id: studios.id, name: studios.name })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);

  if (!studio) notFound();

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-100 rounded-full mb-4">
            <svg className="w-7 h-7 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{studio.name}</h1>
          <p className="text-gray-500 mt-1 text-sm">Compila il modulo per registrarti come paziente</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm border p-6 sm:p-8">
          <PatientRegistrationForm studioId={studio.id} studioName={studio.name} />
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          I tuoi dati saranno trattati nel rispetto del GDPR (Reg. UE 2016/679)
        </p>
      </div>
    </div>
  );
}
