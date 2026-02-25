import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  appointments,
  patients,
  recalls,
  payments,
  users,
} from "@/lib/db/schema";
import { eq, and, gte, lte, sql, ne } from "drizzle-orm";
import { startOfDay, endOfDay, endOfWeek, format } from "date-fns";
import { it } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Calendar,
  Users,
  Bell,
  Euro,
  ArrowRight,
  Clock,
} from "lucide-react";

const statusColors: Record<string, string> = {
  confirmed: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  completed: "bg-gray-100 text-gray-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-orange-100 text-orange-700",
};

const statusLabels: Record<string, string> = {
  confirmed: "Confermato",
  pending: "In attesa",
  completed: "Completato",
  cancelled: "Cancellato",
  no_show: "Non presentato",
};

export default async function DashboardPage() {
  const session = await auth();
  const studioId = session!.user.studioId;

  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const [
    todayAppointmentsList,
    weekRecallsList,
    todayIncomeResult,
    totalPatientsResult,
  ] = await Promise.all([
    db
      .select({
        id: appointments.id,
        startTime: appointments.startTime,
        status: appointments.status,
        patientFirstName: patients.firstName,
        patientLastName: patients.lastName,
        dentistName: users.fullName,
      })
      .from(appointments)
      .leftJoin(patients, eq(appointments.patientId, patients.id))
      .leftJoin(users, eq(appointments.dentistId, users.id))
      .where(
        and(
          eq(appointments.studioId, studioId),
          gte(appointments.startTime, todayStart),
          lte(appointments.startTime, todayEnd),
          ne(appointments.status, "cancelled")
        )
      )
      .orderBy(appointments.startTime),

    db
      .select({
        id: recalls.id,
        recallType: recalls.recallType,
        dueDate: recalls.dueDate,
        patientFirstName: patients.firstName,
        patientLastName: patients.lastName,
      })
      .from(recalls)
      .leftJoin(patients, eq(recalls.patientId, patients.id))
      .where(
        and(
          eq(recalls.studioId, studioId),
          eq(recalls.status, "active"),
          gte(recalls.dueDate, now.toISOString().split("T")[0]),
          lte(recalls.dueDate, weekEnd.toISOString().split("T")[0])
        )
      )
      .orderBy(recalls.dueDate),

    db
      .select({ total: sql<string>`COALESCE(SUM(${payments.amount}), 0)` })
      .from(payments)
      .where(
        and(
          eq(payments.studioId, studioId),
          eq(payments.paymentDate, todayStart.toISOString().split("T")[0])
        )
      ),

    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(patients)
      .where(and(eq(patients.studioId, studioId), eq(patients.isArchived, false))),
  ]);

  const todayIncome = parseFloat(todayIncomeResult[0]?.total ?? "0");
  const totalPatients = Number(totalPatientsResult[0]?.count ?? 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          {format(now, "EEEE d MMMM yyyy", { locale: it })}
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Appuntamenti oggi</p>
                <p className="text-2xl font-bold">{todayAppointmentsList.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Pazienti totali</p>
                <p className="text-2xl font-bold">{totalPatients}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Bell className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Richiami questa settimana</p>
                <p className="text-2xl font-bold">{weekRecallsList.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Euro className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Incasso oggi</p>
                <p className="text-2xl font-bold">
                  €{todayIncome.toFixed(2)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Appuntamenti oggi */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">
              Appuntamenti di oggi
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/calendar" className="flex items-center gap-1 text-blue-600">
                Vedi calendario <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {todayAppointmentsList.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">
                Nessun appuntamento per oggi
              </p>
            ) : (
              <div className="space-y-2">
                {todayAppointmentsList.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-1 text-gray-500 text-sm w-16 shrink-0">
                      <Clock className="h-3 w-3" />
                      {format(new Date(apt.startTime), "HH:mm")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {apt.patientLastName} {apt.patientFirstName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        Dr. {apt.dentistName}
                      </p>
                    </div>
                    <Badge
                      className={`text-xs shrink-0 ${statusColors[apt.status] ?? ""}`}
                      variant="outline"
                    >
                      {statusLabels[apt.status] ?? apt.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Richiami in scadenza */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">
              Richiami in scadenza
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/recalls" className="flex items-center gap-1 text-blue-600">
                Vedi tutti <ArrowRight className="h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {weekRecallsList.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">
                Nessun richiamo in scadenza questa settimana
              </p>
            ) : (
              <div className="space-y-2">
                {weekRecallsList.map((recall) => (
                  <div
                    key={recall.id}
                    className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {recall.patientLastName} {recall.patientFirstName}
                      </p>
                      <p className="text-xs text-gray-500">{recall.recallType}</p>
                    </div>
                    <div className="text-xs text-gray-500 shrink-0">
                      {format(new Date(recall.dueDate), "d MMM", { locale: it })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Accessi rapidi */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Accessi Rapidi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button variant="outline" asChild className="h-auto py-4 flex-col gap-2">
              <Link href="/dashboard/patients/new">
                <Users className="h-5 w-5 text-blue-600" />
                <span className="text-sm">Nuovo Paziente</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-4 flex-col gap-2">
              <Link href="/dashboard/calendar">
                <Calendar className="h-5 w-5 text-green-600" />
                <span className="text-sm">Prenota Appuntamento</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-4 flex-col gap-2">
              <Link href="/dashboard/payments/quotes/new">
                <Euro className="h-5 w-5 text-purple-600" />
                <span className="text-sm">Nuovo Preventivo</span>
              </Link>
            </Button>
            <Button variant="outline" asChild className="h-auto py-4 flex-col gap-2">
              <Link href="/dashboard/recalls">
                <Bell className="h-5 w-5 text-orange-600" />
                <span className="text-sm">Gestisci Richiami</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
