"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { Check, X, Clock, User, Phone, FileText } from "lucide-react";

interface PendingAppointment {
  id: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  createdAt: string;
  patientName: string;
  patientPhone: string;
  treatmentName: string;
  dentistName: string;
}

export function PendingAppointmentsClient({ appointments }: { appointments: PendingAppointment[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  async function handleConfirm(id: string) {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "confirmed" }),
      });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setLoadingId(null);
    }
  }

  async function handleReject(id: string) {
    setLoadingId(id);
    try {
      const res = await fetch(`/api/appointments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "cancelled",
          cancellationReason: rejectReason || "Rifiutato dal dentista",
        }),
      });
      if (res.ok) {
        setRejectingId(null);
        setRejectReason("");
        router.refresh();
      }
    } finally {
      setLoadingId(null);
    }
  }

  if (appointments.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-gray-900 mb-1">Nessun appuntamento in attesa</h2>
        <p className="text-gray-500 text-sm">
          Gli appuntamenti prenotati dai pazienti tramite il chatbot appariranno qui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{appointments.length} appuntament{appointments.length === 1 ? "o" : "i"} in attesa</p>

      <div className="grid gap-4">
        {appointments.map((appt) => {
          const start = new Date(appt.startTime);
          const end = new Date(appt.endTime);
          const isFromChatbot = appt.notes?.startsWith("[Chatbot AI]");

          return (
            <div key={appt.id} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div className="space-y-3 flex-1 min-w-0">
                  {/* Date & Time */}
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                    <span className="font-semibold text-gray-900">
                      {format(start, "EEEE d MMMM yyyy", { locale: it })}
                    </span>
                    <span className="text-gray-500">
                      {format(start, "HH:mm")} - {format(end, "HH:mm")}
                    </span>
                  </div>

                  {/* Patient */}
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="text-gray-700 font-medium">{appt.patientName}</span>
                    {appt.patientPhone && (
                      <span className="flex items-center gap-1 text-gray-500">
                        <Phone className="w-3 h-3" />
                        {appt.patientPhone}
                      </span>
                    )}
                  </div>

                  {/* Treatment & Dentist */}
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md text-xs font-medium">
                      {appt.treatmentName}
                    </span>
                    <span>Dott. {appt.dentistName}</span>
                  </div>

                  {/* Notes */}
                  {appt.notes && (
                    <div className="flex items-start gap-2 text-sm">
                      <FileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                      <p className="text-gray-600">{appt.notes}</p>
                    </div>
                  )}

                  {/* Source badge */}
                  <div className="flex items-center gap-2">
                    {isFromChatbot && (
                      <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-md text-xs font-medium">
                        Chatbot AI
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      Creato {format(new Date(appt.createdAt), "d MMM yyyy HH:mm", { locale: it })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex sm:flex-col gap-2 shrink-0">
                  <button
                    onClick={() => handleConfirm(appt.id)}
                    disabled={loadingId === appt.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    Conferma
                  </button>
                  <button
                    onClick={() => setRejectingId(appt.id)}
                    disabled={loadingId === appt.id}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white text-red-600 text-sm font-medium rounded-lg border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                    Rifiuta
                  </button>
                </div>
              </div>

              {/* Reject reason dialog */}
              {rejectingId === appt.id && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Motivo del rifiuto (opzionale)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Es: Agenda piena, orario non disponibile..."
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    />
                    <button
                      onClick={() => handleReject(appt.id)}
                      disabled={loadingId === appt.id}
                      className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      Conferma rifiuto
                    </button>
                    <button
                      onClick={() => { setRejectingId(null); setRejectReason(""); }}
                      className="px-3 py-2 text-gray-500 text-sm hover:text-gray-700"
                    >
                      Annulla
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
