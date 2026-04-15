import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { studios } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { ChatInterface } from "@/components/pippibot/ChatInterface";

interface ChatPageProps {
  searchParams: Promise<{ phone?: string; studioId?: string }>;
}

export default async function ChatPage({ searchParams }: ChatPageProps) {
  const { phone, studioId } = await searchParams;

  if (!phone || !studioId) {
    notFound();
  }

  // Fetch studio name server-side to show in header
  const [studio] = await db
    .select({ name: studios.name })
    .from(studios)
    .where(and(eq(studios.id, studioId), eq(studios.isActive, true)))
    .limit(1);

  if (!studio) {
    notFound();
  }

  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen text-gray-500">Caricamento...</div>}>
      <ChatInterface
        phone={phone}
        studioId={studioId}
        studioName={studio.name}
      />
    </Suspense>
  );
}

export const metadata = {
  title: "Pippibot — Assistente Virtuale",
  description: "Prenota il tuo appuntamento con l'assistente virtuale dello studio dentistico",
};
