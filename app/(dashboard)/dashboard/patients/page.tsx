import { auth } from "@/auth";
import { db } from "@/lib/db";
import { patients } from "@/lib/db/schema";
import { eq, and, or, ilike, sql } from "drizzle-orm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { UserPlus, Search, Users } from "lucide-react";
import { PatientsTable } from "@/components/patients/patients-table";

interface SearchParams {
  search?: string;
  page?: string;
  includeArchived?: string;
}

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const studioId = session!.user.studioId;
  const sp = await searchParams;

  const search = sp.search ?? "";
  const page = parseInt(sp.page ?? "1");
  const pageSize = 20;
  const includeArchived = sp.includeArchived === "true";
  const offset = (page - 1) * pageSize;

  const conditions = [
    eq(patients.studioId, studioId),
    ...(includeArchived ? [] : [eq(patients.isArchived, false)]),
    ...(search
      ? [
          or(
            ilike(patients.firstName, `%${search}%`),
            ilike(patients.lastName, `%${search}%`),
            ilike(patients.fiscalCode, `%${search}%`),
            ilike(patients.phone, `%${search}%`)
          ),
        ]
      : []),
  ].filter(Boolean) as Parameters<typeof and>;

  const [data, countResult] = await Promise.all([
    db
      .select()
      .from(patients)
      .where(and(...conditions))
      .orderBy(patients.lastName, patients.firstName)
      .limit(pageSize)
      .offset(offset),

    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(patients)
      .where(and(...conditions)),
  ]);

  const total = Number(countResult[0]?.count ?? 0);
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pazienti</h1>
          <p className="text-gray-500 mt-1">{total} pazienti{includeArchived ? " (inclusi archiviati)" : ""}</p>
        </div>
        <Button asChild>
          <Link href="/dashboard/patients/new" className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Nuovo Paziente
          </Link>
        </Button>
      </div>

      <PatientsTable
        patients={data}
        total={total}
        page={page}
        pageSize={pageSize}
        totalPages={totalPages}
        search={search}
        includeArchived={includeArchived}
      />
    </div>
  );
}
