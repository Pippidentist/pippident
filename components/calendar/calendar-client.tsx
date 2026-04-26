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

// Event color tokens are defined in globals.css and switch with theme.
const STATUS_STYLES: Record<
  string,
  { bg: string; border: string; text: string; glow: string }
> = {
  confirmed: {
    bg: "var(--cal-confirmed-bg)",
    border: "var(--cal-confirmed-border)",
    text: "var(--cal-confirmed-text)",
    glow: "var(--cal-confirmed-glow)",
  },
  pending: {
    bg: "var(--cal-pending-bg)",
    border: "var(--cal-pending-border)",
    text: "var(--cal-pending-text)",
    glow: "var(--cal-pending-glow)",
  },
  completed: {
    bg: "var(--cal-completed-bg)",
    border: "var(--cal-completed-border)",
    text: "var(--cal-completed-text)",
    glow: "var(--cal-completed-glow)",
  },
  cancelled: {
    bg: "var(--cal-cancelled-bg)",
    border: "var(--cal-cancelled-border)",
    text: "var(--cal-cancelled-text)",
    glow: "var(--cal-cancelled-glow)",
  },
  no_show: {
    bg: "var(--cal-noshow-bg)",
    border: "var(--cal-noshow-border)",
    text: "var(--cal-noshow-text)",
    glow: "var(--cal-noshow-glow)",
  },
};

const DAY_NAME_BY_INDEX = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

interface CalendarClientProps {
  dentists: Dentist[];
  treatmentTypes: TreatmentTypeOption[];
  currentUserId: string;
  currentUserRole: string;
  openingHours: Record<string, { open: string; close: string }>;
}

export function CalendarClient({ dentists, treatmentTypes, currentUserId, currentUserRole, openingHours }: CalendarClientProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [view, setView] = useState<"week" | "day">("week");
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [selectedDentistFilter, setSelectedDentistFilter] = useState<string>("all");
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ start: Date; end: Date } | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<AppointmentItem | null>(null);
  // Mobile auto-switches to day view (week view is unreadable on phones)
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const handler = () => {
      setIsMobile(mq.matches);
      if (mq.matches) setView("day");
    };
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

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
    if (!isHourOpen(day, hour)) return; // ignore clicks on closed slots
    const start = new Date(day);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(hour + 1, 0, 0, 0);
    setSelectedSlot({ start, end });
    setEditingAppointment(null);
    setModalOpen(true);
  }

  function getDayHours(day: Date): { open: number; close: number } | null {
    const dayName = DAY_NAME_BY_INDEX[day.getDay()];
    const hours = openingHours[dayName];
    if (!hours) return null; // closed all day
    const [openH] = hours.open.split(":").map(Number);
    const [closeH] = hours.close.split(":").map(Number);
    return { open: openH, close: closeH };
  }

  function isDayOpen(day: Date): boolean {
    return getDayHours(day) !== null;
  }

  function isHourOpen(day: Date, hour: number): boolean {
    const h = getDayHours(day);
    if (!h) return false;
    return hour >= h.open && hour < h.close;
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
      {/* Toolbar — stacks on mobile, single row on tablet+ */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-white border border-gray-200 rounded-lg p-3">
        <div className="flex items-center gap-2 flex-wrap">
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

        <div className="flex items-center gap-2 flex-wrap">
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

          {/* View toggle — Settimana hidden on mobile (week view is unreadable < 768px) */}
          <div className="flex border border-gray-200 rounded-md overflow-hidden">
            <button
              className={`px-3 py-1 text-sm ${view === "day" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              onClick={() => setView("day")}
            >
              Giorno
            </button>
            {!isMobile && (
              <button
                className={`px-3 py-1 text-sm ${view === "week" ? "bg-blue-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
                onClick={() => setView("week")}
              >
                Settimana
              </button>
            )}
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

      {/* Calendar Grid — header + grid share ONE scroll container so the
          scrollbar gutter (if any) eats from BOTH equally and the columns
          stay aligned. The header is sticky so it doesn't scroll away. */}
      <div
        className="rounded-lg cal-scroll"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          overflow: "hidden auto",
          maxHeight: "calc(100vh - 320px)",
        }}
      >
        {/* Day headers — sticky so they pin to the top while the grid
            below scrolls. Same grid-template-columns as the time grid
            below = pixel-perfect column alignment. */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 5,
            display: "grid",
            gridTemplateColumns: `56px repeat(${days.length}, 1fr)`,
            borderBottom: "1px solid var(--border)",
            background: "var(--card)",
          }}
        >
          <div /> {/* hours column spacer */}
          {days.map((day) => {
            const isToday = isSameDay(day, new Date());
            const dayClosed = !isDayOpen(day);
            return (
              <div
                key={day.toISOString()}
                className="text-center py-2 text-sm cursor-pointer transition-colors"
                style={{
                  background: isToday ? "var(--cal-today-bg)" : "transparent",
                  opacity: dayClosed ? 0.55 : 1,
                  minWidth: 0,
                }}
                onMouseEnter={(e) => {
                  if (!isToday) {
                    e.currentTarget.style.background = "var(--cal-cell-divider)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isToday) {
                    e.currentTarget.style.background = "transparent";
                  }
                }}
                onClick={() => {
                  setSelectedDay(day);
                  setView("day");
                }}
              >
                <div
                  className="text-xs uppercase"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {format(day, "EEE", { locale: it })}
                  {dayClosed && <span style={{ marginLeft: 6, fontSize: 9, letterSpacing: 0.5 }}>· CHIUSO</span>}
                </div>
                <div
                  className="text-lg font-semibold"
                  style={{ color: isToday ? "var(--primary)" : "var(--foreground)" }}
                >
                  {format(day, "d")}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time grid — same grid-template-columns as the headers row.
            Both share the same scroll container width, so columns
            line up exactly even if the OS chooses to display a scrollbar. */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `56px repeat(${days.length}, 1fr)`,
          }}
        >
          {/* Hours column */}
          <div
            style={{ borderRight: "1px solid var(--border)", minWidth: 0 }}
          >
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="text-xs pr-2 text-right"
                style={{
                  height: HOUR_HEIGHT,
                  borderBottom: "1px solid var(--cal-cell-divider)",
                  color: "var(--muted-foreground)",
                }}
              >
                <span className="relative -top-2">{hour}:00</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => {
            const dayApts = getAppointmentsForDay(day);
            const isToday = isSameDay(day, new Date());
            const dayClosed = !isDayOpen(day);
            return (
              <div
                key={day.toISOString()}
                className="relative"
                style={{
                  minWidth: 0,
                  height: HOURS.length * HOUR_HEIGHT,
                  borderRight: "1px solid var(--border)",
                  background: isToday
                    ? "var(--cal-hover-bg)"
                    : "transparent",
                }}
              >
                {/* Closed-day backdrop: diagonal stripes covering the whole column */}
                {dayClosed && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(45deg, var(--cal-closed-pattern) 0 6px, transparent 6px 12px)",
                      backgroundColor: "var(--cal-closed-overlay)",
                    }}
                  />
                )}

                {/* Hour slots */}
                {HOURS.map((hour) => {
                  const slotOpen = isHourOpen(day, hour);
                  return (
                    <div
                      key={hour}
                      className="absolute w-full transition-colors"
                      style={{
                        top: (hour - 8) * HOUR_HEIGHT,
                        height: HOUR_HEIGHT,
                        borderBottom: "1px solid var(--cal-cell-divider)",
                        cursor: slotOpen ? "pointer" : "not-allowed",
                        background: slotOpen
                          ? "transparent"
                          : "repeating-linear-gradient(45deg, var(--cal-closed-pattern) 0 6px, transparent 6px 12px)",
                      }}
                      onMouseEnter={(e) => {
                        if (slotOpen) {
                          e.currentTarget.style.background =
                            "var(--cal-today-bg)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (slotOpen) {
                          e.currentTarget.style.background = "transparent";
                        }
                      }}
                      onClick={() => handleSlotClick(day, hour)}
                    />
                  );
                })}

                {/* Appointments */}
                {dayApts.map((apt) => {
                  const s = STATUS_STYLES[apt.status] ?? STATUS_STYLES.confirmed;
                  return (
                    <div
                      key={apt.id}
                      className="absolute rounded cursor-pointer transition-all overflow-hidden"
                      style={{
                        left: 2,
                        right: 2,
                        top: getTopOffset(apt.startTime),
                        height: getHeight(apt.startTime, apt.endTime) - 2,
                        zIndex: 10,
                        background: s.bg,
                        border: `1px solid ${s.border}`,
                        borderLeft: `3px solid ${s.border}`,
                        color: s.text,
                        boxShadow: s.glow,
                        padding: "2px 6px",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = "translateY(-1px)";
                        e.currentTarget.style.boxShadow = `${s.glow}, var(--cal-event-shadow)`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = "translateY(0)";
                        e.currentTarget.style.boxShadow = s.glow;
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAppointmentClick(apt);
                      }}
                    >
                      <div
                        className="text-xs truncate"
                        style={{ fontWeight: 600, color: s.text }}
                      >
                        {format(parseISO(apt.startTime), "HH:mm")}{" "}
                        {apt.patientLastName} {apt.patientFirstName}
                      </div>
                      {getHeight(apt.startTime, apt.endTime) > 35 && (
                        <div
                          className="text-xs truncate"
                          style={{ opacity: 0.85, color: s.text }}
                        >
                          {apt.treatmentName}
                        </div>
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
