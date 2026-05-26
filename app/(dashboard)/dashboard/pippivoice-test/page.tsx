import { auth } from "@/auth";
import { db } from "@/lib/db";
import { studios, patients } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import PippivoiceTestClient from "./pippivoice-test-client";

export const dynamic = "force-dynamic";

export default async function PippivoiceTestPage() {
  const session = await auth();
  if (!session?.user?.studioId) redirect("/login");

  const studioId = session.user.studioId;

  const [studio] = await db
    .select()
    .from(studios)
    .where(eq(studios.id, studioId))
    .limit(1);

  if (!studio) redirect("/login");

  const studioPatients = await db
    .select({
      id: patients.id,
      firstName: patients.firstName,
      lastName: patients.lastName,
      phone: patients.phone,
    })
    .from(patients)
    .where(
      and(eq(patients.studioId, studioId), eq(patients.isArchived, false))
    )
    .orderBy(patients.lastName, patients.firstName)
    .limit(200);

  const agentId = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID ?? "";

  return (
    <PippivoiceTestClient
      studio={{ id: studio.id, name: studio.name }}
      patients={studioPatients}
      agentId={agentId}
    />
  );
}
