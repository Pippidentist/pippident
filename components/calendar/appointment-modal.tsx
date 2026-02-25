"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, addMinutes } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confermato",
  pending: "In attesa",
  completed: "Completato",
  cancelled: "Cancellato",
  no_show: "Non presentato",
};

const appointmentSchema = z.object({
  patientId: z.string().uuid("Seleziona un paziente"),
  patientName: z.string().min(1),
  dentistId: z.string().uuid("Seleziona un dentista"),
  treatmentTypeId: z.string().uuid().optional().nullable(),
  startTime: z.string().min(1, "Data/ora obbligatoria"),
  endTime: z.string().min(1, "Ora fine obbligatoria"),
  status: z.enum(["confirmed", "pending", "completed", "cancelled", "no_show"]),
  notes: z.string().optional(),
});

type AppointmentFormValues = z.infer<typeof appointmentSchema>;

interface Dentist {
  id: string;
  fullName: string;
}

interface TreatmentTypeOption {
  id: string;
  name: string;
  defaultDurationMinutes: number;
}

interface AppointmentItem {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string | null;
  patientId: string;
  patientFirstName: string | null;
  patientLastName: string | null;
  dentistId: string;
  treatmentTypeId?: string | null;
}

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface AppointmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSlot: { start: Date; end: Date } | null;
  editingAppointment: AppointmentItem | null;
  dentists: Dentist[];
  treatmentTypes: TreatmentTypeOption[];
  onSuccess: () => void;
}

function toLocalDateTimeInput(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export function AppointmentModal({
  open,
  onOpenChange,
  initialSlot,
  editingAppointment,
  dentists,
  treatmentTypes,
  onSuccess,
}: AppointmentModalProps) {
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<PatientOption[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(appointmentSchema),
    defaultValues: {
      patientId: "",
      patientName: "",
      dentistId: dentists[0]?.id ?? "",
      treatmentTypeId: null,
      startTime: initialSlot ? toLocalDateTimeInput(initialSlot.start) : "",
      endTime: initialSlot ? toLocalDateTimeInput(initialSlot.end) : "",
      status: "confirmed",
      notes: "",
    },
  });

  useEffect(() => {
    if (open) {
      if (editingAppointment) {
        form.reset({
          patientId: editingAppointment.patientId,
          patientName: `${editingAppointment.patientLastName ?? ""} ${editingAppointment.patientFirstName ?? ""}`.trim(),
          dentistId: editingAppointment.dentistId,
          treatmentTypeId: editingAppointment.treatmentTypeId ?? null,
          startTime: toLocalDateTimeInput(new Date(editingAppointment.startTime)),
          endTime: toLocalDateTimeInput(new Date(editingAppointment.endTime)),
          status: editingAppointment.status as AppointmentFormValues["status"],
          notes: editingAppointment.notes ?? "",
        });
      } else if (initialSlot) {
        form.reset({
          patientId: "",
          patientName: "",
          dentistId: dentists[0]?.id ?? "",
          treatmentTypeId: null,
          startTime: toLocalDateTimeInput(initialSlot.start),
          endTime: toLocalDateTimeInput(initialSlot.end),
          status: "confirmed",
          notes: "",
        });
      }
    }
  }, [open, editingAppointment, initialSlot]); // eslint-disable-line

  useEffect(() => {
    if (!patientSearch || patientSearch.length < 2) {
      setPatientResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/patients?search=${encodeURIComponent(patientSearch)}&pageSize=5`);
        const data = await res.json();
        setPatientResults(data.data ?? []);
      } catch {
        // ignore
      } finally {
        setSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [patientSearch]);

  function selectPatient(patient: PatientOption) {
    form.setValue("patientId", patient.id);
    form.setValue("patientName", `${patient.lastName} ${patient.firstName}`);
    setPatientSearch("");
    setPatientResults([]);
  }

  function handleTreatmentChange(treatmentId: string) {
    form.setValue("treatmentTypeId", treatmentId || null);
    if (treatmentId) {
      const treatment = treatmentTypes.find((t) => t.id === treatmentId);
      if (treatment) {
        const startStr = form.getValues("startTime");
        if (startStr) {
          const start = new Date(startStr);
          const end = addMinutes(start, treatment.defaultDurationMinutes);
          form.setValue("endTime", toLocalDateTimeInput(end));
        }
      }
    }
  }

  async function onSubmit(data: AppointmentFormValues) {
    setLoading(true);
    try {
      const payload = {
        patientId: data.patientId,
        dentistId: data.dentistId,
        treatmentTypeId: data.treatmentTypeId || null,
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
        status: data.status,
        notes: data.notes || null,
      };

      if (editingAppointment) {
        const res = await fetch(`/api/appointments/${editingAppointment.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Errore nel salvataggio");
        }
        toast.success("Appuntamento aggiornato");
      } else {
        const res = await fetch("/api/appointments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Errore nella prenotazione");
        }
        toast.success("Appuntamento prenotato");
      }

      onOpenChange(false);
      onSuccess();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!editingAppointment) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/appointments/${editingAppointment.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Cancellato dall'utente" }),
      });
      if (!res.ok) throw new Error();
      toast.success("Appuntamento cancellato");
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("Errore nella cancellazione");
    } finally {
      setDeleting(false);
    }
  }

  const selectedPatientName = form.watch("patientName");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editingAppointment ? "Modifica Appuntamento" : "Nuovo Appuntamento"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Paziente */}
            <FormField
              control={form.control}
              name="patientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Paziente *</FormLabel>
                  {selectedPatientName && field.value ? (
                    <div className="flex items-center gap-2 p-2 border border-gray-200 rounded-md">
                      <span className="flex-1 text-sm font-medium">{selectedPatientName}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => {
                          form.setValue("patientId", "");
                          form.setValue("patientName", "");
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          className="pl-9"
                          placeholder="Cerca paziente per nome o telefono..."
                          value={patientSearch}
                          onChange={(e) => setPatientSearch(e.target.value)}
                        />
                      </div>
                      {patientResults.length > 0 && (
                        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                          {patientResults.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                              onClick={() => selectPatient(p)}
                            >
                              <span className="font-medium">{p.lastName} {p.firstName}</span>
                              <span className="text-gray-500 text-xs">{p.phone}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Dentista */}
            <FormField
              control={form.control}
              name="dentistId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dentista *</FormLabel>
                  <FormControl>
                    <select
                      className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                      value={field.value}
                      onChange={field.onChange}
                    >
                      {dentists.map((d) => (
                        <option key={d.id} value={d.id}>{d.fullName}</option>
                      ))}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tipo visita */}
            <FormItem>
              <FormLabel>Tipo di visita</FormLabel>
              <select
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                value={form.watch("treatmentTypeId") ?? ""}
                onChange={(e) => handleTreatmentChange(e.target.value)}
              >
                <option value="">— Seleziona tipo visita —</option>
                {treatmentTypes.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.defaultDurationMinutes} min)</option>
                ))}
              </select>
            </FormItem>

            {/* Data/ora */}
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inizio *</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fine *</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Stato (solo in modifica) */}
            {editingAppointment && (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stato</FormLabel>
                    <FormControl>
                      <select
                        className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm"
                        value={field.value}
                        onChange={field.onChange}
                      >
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Note */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note interne</FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Note visibili solo al personale..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2">
              {editingAppointment && (
                <Button
                  type="button"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 mr-auto"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  {deleting ? "Cancellazione..." : "Cancella"}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Chiudi
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvataggio..." : editingAppointment ? "Salva" : "Prenota"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
