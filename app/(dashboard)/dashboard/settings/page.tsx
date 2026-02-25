import { auth } from "@/auth";
import { db } from "@/lib/db";
import { studios, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SettingsClient } from "@/components/settings/settings-client";
import { redirect } from "next/navigation";

export default async function SettingsPage() {
  const session = await auth();
  const studioId = session!.user.studioId;

  // Solo admin e super_admin possono accedere
  if (!["admin", "super_admin"].includes(session!.user.role)) {
    redirect("/dashboard");
  }

  const [studio, studioUsers] = await Promise.all([
    db
      .select()
      .from(studios)
      .where(eq(studios.id, studioId))
      .limit(1)
      .then((r) => r[0]),

    db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.studioId, studioId))
      .orderBy(users.fullName),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Impostazioni</h1>
        <p className="text-gray-500 mt-1">Gestione studio e utenti</p>
      </div>
      <SettingsClient studio={studio} studioUsers={studioUsers} currentUserId={session!.user.id} />
    </div>
  );
}
