"use client";

import { useState, useEffect, useCallback } from "react";
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO, startOfDay, endOfDay } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { AppointmentModal } from "./appointment-modal";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8:00 - 20:00
const HOUR_HEIGHT = 60; // px per ora

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
  patientPhone: string | null;
  dentistId: string;
  dentistName: string | null;
  treatmentTypeId?: string | null;
  treatmentName?: string | null;
}

const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  confirmed: { bg: "bg-green-100", border: "border-green-400", text: "text-green-900" },
  pending: { bg: "bg-yellow-100", border: "border-yellow-400", text: "text-yellow-900" },
  completed: { bg: "bg-gray-100", border: "border-gray-400", text: "text-gray-700" },
  cancelled: { bg: "bg-red-100", border: "border-red-400", text: "text-red-900" },
  no_show: { bg: "bg-orange-100", border: "border-orange-400", text: "text-orange-900" },
};

interface CalendarClientProps {
  dentists: Dentist[];
  treatmentTypes: TreatmentTypeOption[];
  currentUserId: string;
  currentUserRole: string;
}

export function CalendarClient({ dentists, treatmentTypes, currentUserId, currentUserRole }: CalendarClientProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [view, setView] = useState<"week" | "day">("week");
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [selectedDentistFilter, setSelectedDentistFilter] = useState<string>("all");
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentItem | null>(null);

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 1 });

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const from = view === "week" ? weekStart : startOfDay(selectedDay);
      const to = view === "week" ? weekEnd : endOfDay(selectedDay);
      const params = new URLSearchParams({
        dateFrom: from.toISOString(),
        dateTo: to.toISOString(),
        ...(selectedDentistFilter !== "all" ? { dentistId: selectedDentistFilter } : {}),
      });
      const res = await fetch(`/api/appointments?${params}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAppointments(data);
    } catch {
      toast.error("Errore nel caricamento appuntamenti");
    } finally {
      setLoading(false);
    }
  }, [currentWeek, view, selectedDay, selectedDentistFilter]); // eslint-disable-line

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  function handleSlotClick(day: Date, hour: number) {
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(hour + 1, 0, 0, 0);
    setSelectedSlot({ start, end });
    setEditingAppointment(null);
    setModalOpen(true);
  }

  function handleAppointmentClick(apt: AppointmentItem) {
    setEditingAppointment(apt);
    setSelectedSlot(null);
    setModalOpen(true);
  }

  function getAppointmentsForDay(day: Date) {
    return appointments.filter((a) => isSameDay(parseISO(a.startTime), day));
  }

  function getTopOffset(startTime: string) {
    const date = parseISO(startTime);
    const hours = date.getHours() - 8;
    const minutes = date.getMinutes();
    return (hours + minutes / 60) * HOUR_HEIGHT;
  }

  function getHeight(startTime: string, endTime: string) {
    const start = parseISO(startTime);
    const end = parseISO(endTime);
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    return Math.max(durationHours * HOUR_HEIGHT, 20);
  }

  const days = view === "week"
    ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
    : [selectedDay];

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (view === "week") setCurrentWeek(subWeeks(currentWeek, 1));
              else setSelectedDay(addDays(selectedDay, -1));
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (view === "week") setCurrentWeek(new Date());
              else setSelectedDay(new Date());
            }}
          >
            Oggi
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (view === "week") setCurrentWeek(addWeeks(currentWeek, 1));
              else setSelectedDay(addDays(selectedDay, 1));
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-gray-700 ml-2">
            {view === "week"
              ? `${format(weekStart, "d MMM", { locale: it })} – ${format(weekEnd, "d MMM yyyy", { locale: it })}`
              : format(selectedDay, "EEEE d MMMM yyyy", { locale: it })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select
            className="text-sm border border-gray-200 rounded-md px-2 py-1"
            value={selectedDentistFilter}
            onChange={(e) => setSelectedDentistFilter(e.target.value)}
          >
            <option value="all">Tutti i dentisti</option>
            {dentists.map((d) => (
              <option key={d.id} value={d.id}>{d.fullName}</option>
            ))}
          </select>

          <div className="flex border border-gray-200 rounded-md overflow-hidden">
            <button
              className={`px-3 py-1 text-sm ${view === "day" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              onClick={() => setView("day")}
            >
              Giorno
            </button>
            <button
              className={`px-3 py-1 text-sm ${view === "week" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              onClick={() => setView("week")}
            >
              Settimana
            </button>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setSelectedSlot(null);
              setEditingAppointment(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            Nuovo
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="flex border-b border-gray-200">
          <div className="w-14 shrink-0" />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className={`flex-1 text-center py-2 text-sm cursor-pointer hover:bg-gray-50 ${
                isSameDay(day, new Date()) ? "bg-blue-50" : ""
              }`}
              onClick={() => {
                setSelectedDay(day);
                setView("day");
              }}
            >
              <div className="text-xs text-gray-500 uppercase">
                {format(day, "EEE", { locale: it })}
              </div>
              <div className={`text-lg font-semibold ${isSameDay(day, new Date()) ? "text-blue-600" : "text-gray-900"}`}>
                {format(day, "d")}
              </div>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="flex overflow-y-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
          {/* Hours column */}
          <div className="w-14 shrink-0 border-r border-gray-200">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="border-b border-gray-100 text-xs text-gray-400 pr-2 text-right"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="relative -top-2">{hour}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dayApts = getAppointmentsForDay(day);
            return (
              <div
                key={day.toISOString()}
                className={`flex-1 relative border-r border-gray-200 last:border-r-0 ${
                  isSameDay(day, new Date()) ? "bg-blue-50/30" : ""
                }`}
                style={{ height: HOURS.length * HOUR_HEIGHT }}
              >
                {/* Hour slots */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute w-full border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                    style={{ top: (hour - 8) * HOUR_HEIGHT, height: HOUR_HEIGHT }}
                    onClick={() => handleSlotClick(day, hour)}
                  />
                ))}

                {/* Appointments */}
                {dayApts.map((apt) => {
                  const colors = STATUS_COLORS[apt.status] ?? STATUS_COLORS.confirmed;
                  return (
                    <div
                      key={apt.id}
                      className={`absolute left-0.5 right-0.5 rounded px-1 py-0.5 border-l-2 cursor-pointer hover:opacity-80 transition-opacity overflow-hidden ${colors.bg} ${colors.border} ${colors.text}`}
                      style={{
                        top: getTopOffset(apt.startTime),
                        height: getHeight(apt.startTime, apt.endTime) - 2,
                        zIndex: 10,
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAppointmentClick(apt);
                      }}
                    >
                      <div className="text-xs font-semibold truncate">
                        {format(parseISO(apt.startTime), "HH:mm")} {apt.patientLastName} {apt.patientFirstName}
                      </div>
                      {getHeight(apt.startTime, apt.endTime) > 35 && (
                        <div className="text-xs opacity-75 truncate">{apt.treatmentName}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <AppointmentModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        initialSlot={selectedSlot}
        editingAppointment={editingAppointment}
        dentists={dentists}
        treatmentTypes={treatmentTypes}
        onSuccess={fetchAppointments}
      />
    </div>
  );
}
