import { db } from "@/lib/db";
import { studios, patients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { ChatClient } from "@/components/chat/chat-client";

interface ChatPageProps {
  params: Promise<{ studioId: string }>;
  searchParams: Promise<{ phone?: string }>;
}

export async function generateMetadata({ params }: ChatPageProps) {
  const { studioId } = await params;
  const [studio] = await db
    .select({ name: studios.name })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);

  if (!studio) return { title: "Chat" };
  return { title: `Chat - ${studio.name}` };
}

export default async function ChatPage({ params, searchParams }: ChatPageProps) {
  const { studioId } = await params;
  const { phone } = await searchParams;

  const [studio] = await db
    .select({ id: studios.id, name: studios.name, phone: studios.phone })
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);

  if (!studio) notFound();

  if (!phone) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-600 text-xl">!</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Link non valido</h1>
          <p className="text-gray-500">
            Questo link non contiene il numero di telefono necessario per accedere alla chat.
            Contatti lo studio per ricevere il link corretto.
          </p>
        </div>
      </div>
    );
  }

  const [patient] = await db
    .select({ id: patients.id, firstName: patients.firstName, lastName: patients.lastName })
    .from(patients)
    .where(and(eq(patients.studioId, studioId), eq(patients.phone, phone)))
    .limit(1);

  if (!patient) {
    const registrationUrl = `/register/${studioId}`;
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-yellow-600 text-xl">?</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Paziente non trovato</h1>
          <p className="text-gray-500 mb-6">
            Il numero <strong>{phone}</strong> non risulta registrato presso <strong>{studio.name}</strong>.
          </p>
          <a
            href={registrationUrl}
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Registrati ora
          </a>
        </div>
      </div>
    );
  }

  return (
    <ChatClient
      studioId={studioId}
      studioName={studio.name}
      studioPhone={studio.phone ?? undefined}
      patientName={`${patient.firstName} ${patient.lastName}`}
      phone={phone}
    />
  );
}
