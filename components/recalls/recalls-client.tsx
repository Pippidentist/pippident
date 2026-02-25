"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
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
import { Bell, CheckCircle, XCircle, Send } from "lucide-react";
import Link from "next/link";

interface RecallItem {
  id: string;
  recallType: string;
  dueDate: string;
  status: string;
  notes: string | null;
  createdAutomatically: boolean;
  patientId: string;
  patientFirstName: string | null;
  patientLastName: string | null;
  patientPhone: string | null;
}

interface RecallsClientProps {
  initialRecalls: RecallItem[];
  daysWindow: number;
  statusFilter: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  sent: "bg-blue-100 text-blue-800",
  completed: "bg-gray-100 text-gray-700",
  ignored: "bg-red-100 text-red-700",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Attivo",
  sent: "Inviato",
  completed: "Completato",
  ignored: "Ignorato",
  all: "Tutti",
};

export function RecallsClient({ initialRecalls, daysWindow, statusFilter }: RecallsClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [recalls, setRecalls] = useState(initialRecalls);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function setFilter(days: number, status: string) {
    const params = new URLSearchParams({ days: String(days), status });
    router.push(`${pathname}?${params.toString()}`);
  }

  async function updateStatus(id: string, status: "sent" | "completed" | "ignored") {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/recalls/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setRecalls((prev) => prev.map((r) => (r.id === id ? { ...r, status: updated.status } : r)));
      toast.success("Richiamo aggiornato");
    } catch {
      toast.error("Errore nell'aggiornamento");
    } finally {
      setLoadingId(null);
    }
  }

  function getDueDateColor(dueDate: string) {
    const days = differenceInDays(new Date(dueDate), new Date());
    if (days < 0) return "text-red-600 font-semibold";
    if (days <= 7) return "text-orange-600 font-semibold";
    if (days <= 14) return "text-yellow-600";
    return "text-gray-600";
  }

  return (
    <div className="space-y-4">
      {/* Filtri */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-500 mr-1">Finestra:</span>
          {[30, 60, 90].map((d) => (
            <Button
              key={d}
              variant={daysWindow === d ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(d, statusFilter)}
            >
              {d} giorni
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <span className="text-sm text-gray-500 mr-1">Stato:</span>
          {["active", "sent", "completed", "all"].map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(daysWindow, s)}
            >
              {STATUS_LABELS[s]}
            </Button>
          ))}
        </div>
        <Button size="sm" asChild className="ml-auto">
          <Link href="/dashboard/recalls/new">
            <Bell className="h-4 w-4 mr-1" />
            Nuovo Richiamo
          </Link>
        </Button>
      </div>

      {/* Tabella */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Paziente</TableHead>
              <TableHead>Tipo Richiamo</TableHead>
              <TableHead>Data Prevista</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Origine</TableHead>
              <TableHead className="w-40">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recalls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                  Nessun richiamo trovato per i filtri selezionati
                </TableCell>
              </TableRow>
            ) : (
              recalls.map((recall) => (
                <TableRow key={recall.id}>
                  <TableCell>
                    <Link href={`/dashboard/patients/${recall.patientId}`} className="hover:underline">
                      <p className="font-medium text-gray-900">
                        {recall.patientLastName} {recall.patientFirstName}
                      </p>
                      {recall.patientPhone && (
                        <p className="text-xs text-gray-500">{recall.patientPhone}</p>
                      )}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{recall.recallType}</p>
                    {recall.notes && (
                      <p className="text-xs text-gray-500">{recall.notes}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className={`text-sm ${getDueDateColor(recall.dueDate)}`}>
                      {format(new Date(recall.dueDate), "d MMM yyyy", { locale: it })}
                    </span>
                    <p className="text-xs text-gray-400">
                      {differenceInDays(new Date(recall.dueDate), new Date())} giorni
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[recall.status] ?? ""}
                    >
                      {STATUS_LABELS[recall.status] ?? recall.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {recall.createdAutomatically ? "Auto" : "Manuale"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {recall.status === "active" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Segna come inviato"
                            disabled={loadingId === recall.id}
                            onClick={() => updateStatus(recall.id, "sent")}
                          >
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Segna come completato"
                            disabled={loadingId === recall.id}
                            onClick={() => updateStatus(recall.id, "completed")}
                          >
                            <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Ignora"
                            disabled={loadingId === recall.id}
                            onClick={() => updateStatus(recall.id, "ignored")}
                          >
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
