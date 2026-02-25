"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import type { Patient } from "@/lib/db/schema";

interface PatientsTableProps {
  patients: Patient[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  search: string;
  includeArchived: boolean;
}

export function PatientsTable({
  patients,
  total,
  page,
  pageSize,
  totalPages,
  search,
  includeArchived,
}: PatientsTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [searchValue, setSearchValue] = useState(search);
  const [isPending, startTransition] = useTransition();

  function handleSearch(value: string) {
    setSearchValue(value);
    startTransition(() => {
      const params = new URLSearchParams();
      if (value) params.set("search", value);
      if (includeArchived) params.set("includeArchived", "true");
      params.set("page", "1");
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function handlePage(newPage: number) {
    const params = new URLSearchParams();
    if (searchValue) params.set("search", searchValue);
    if (includeArchived) params.set("includeArchived", "true");
    params.set("page", String(newPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-4">
      {/* Search + filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Cerca per nome, CF, telefono..."
            value={searchValue}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const params = new URLSearchParams();
            if (searchValue) params.set("search", searchValue);
            params.set("includeArchived", String(!includeArchived));
            params.set("page", "1");
            router.push(`${pathname}?${params.toString()}`);
          }}
        >
          {includeArchived ? "Nascondi archiviati" : "Mostra archiviati"}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Paziente</TableHead>
              <TableHead>Telefono</TableHead>
              <TableHead>Data di nascita</TableHead>
              <TableHead>Codice Fiscale</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isPending ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : patients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                  Nessun paziente trovato
                </TableCell>
              </TableRow>
            ) : (
              patients.map((patient) => (
                <TableRow
                  key={patient.id}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <TableCell>
                    <Link href={`/dashboard/patients/${patient.id}`} className="block">
                      <p className="font-medium text-gray-900">
                        {patient.lastName} {patient.firstName}
                      </p>
                      {patient.email && (
                        <p className="text-xs text-gray-500">{patient.email}</p>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell className="text-gray-600">{patient.phone}</TableCell>
                  <TableCell className="text-gray-600">
                    {patient.dateOfBirth
                      ? format(new Date(patient.dateOfBirth), "d MMM yyyy", { locale: it })
                      : "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-gray-600">
                    {patient.fiscalCode ?? "—"}
                  </TableCell>
                  <TableCell>
                    {patient.isArchived ? (
                      <Badge variant="outline" className="text-gray-500">
                        Archiviato
                      </Badge>
                    ) : patient.gdprConsent ? (
                      <Badge className="bg-green-100 text-green-800" variant="outline">
                        Attivo
                      </Badge>
                    ) : (
                      <Badge className="bg-yellow-100 text-yellow-800" variant="outline">
                        GDPR mancante
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/dashboard/patients/${patient.id}`}>
                        Apri
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Mostrati {Math.min((page - 1) * pageSize + 1, total)}–
            {Math.min(page * pageSize, total)} di {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => handlePage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              Pagina {page} di {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => handlePage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
