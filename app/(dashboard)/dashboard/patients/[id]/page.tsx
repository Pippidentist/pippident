import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  patients,
  appointments,
  patientTreatments,
  recalls,
  payments,
  users,
  treatmentTypes,
} from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { ChevronLeft, Phone, Mail, MapPin, Calendar, FileText } from "lucide-react";
import { PatientEditForm } from "@/components/patients/patient-edit-form";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const studioId = session!.user.studioId;
  const { id } = await params;

  const [patient] = await db
    .select()
    .from(patients)
    .where(and(eq(patients.id, id), eq(patients.studioId, studioId)))
    .limit(1);

  if (!patient) notFound();

  const [
    patientAppointmentsList,
    patientTreatmentsList,
    patientRecallsList,
    patientPaymentsList,
  ] = await Promise.all([
    db
      .select({
        id: appointments.id,
        startTime: appointments.startTime,
        status: appointments.status,
        dentistName: users.fullName,
        treatmentName: treatmentTypes.name,
      })
      .from(appointments)
      .leftJoin(users, eq(appointments.dentistId, users.id))
      .leftJoin(treatmentTypes, eq(appointments.treatmentTypeId, treatmentTypes.id))
      .where(eq(appointments.patientId, id))
      .orderBy(desc(appointments.startTime))
      .limit(20),

    db
      .select({
        id: patientTreatments.id,
        performedAt: patientTreatments.performedAt,
        status: patientTreatments.status,
        teeth: patientTreatments.teeth,
        clinicalNotes: patientTreatments.clinicalNotes,
        dentistName: users.fullName,
        treatmentName: treatmentTypes.name,
      })
      .from(patientTreatments)
      .leftJoin(users, eq(patientTreatments.dentistId, users.id))
      .leftJoin(treatmentTypes, eq(patientTreatments.treatmentTypeId, treatmentTypes.id))
      .where(eq(patientTreatments.patientId, id))
      .orderBy(desc(patientTreatments.performedAt))
      .limit(20),

    db
      .select()
      .from(recalls)
      .where(eq(recalls.patientId, id))
      .orderBy(desc(recalls.dueDate))
      .limit(10),

    db
      .select()
      .from(payments)
      .where(eq(payments.patientId, id))
      .orderBy(desc(payments.paymentDate))
      .limit(20),
  ]);

  const totalPayments = patientPaymentsList.reduce(
    (sum, p) => sum + parseFloat(String(p.amount)),
    0
  );

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
    planned: "Pianificata",
    performed: "Eseguita",
    suspended: "Sospesa",
    active: "Attivo",
    sent: "Inviato",
    ignored: "Ignorato",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/patients" className="flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />
            Pazienti
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              {patient.lastName} {patient.firstName}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
            {patient.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {patient.phone}
              </span>
            )}
            {patient.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                {patient.email}
              </span>
            )}
            {patient.city && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {patient.city}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/dashboard/calendar?patient=${patient.id}`}>
              <Calendar className="h-4 w-4 mr-1" />
              Prenota
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="anagrafica">
        <TabsList>
          <TabsTrigger value="anagrafica">Anagrafica</TabsTrigger>
          <TabsTrigger value="appuntamenti">
            Appuntamenti ({patientAppointmentsList.length})
          </TabsTrigger>
          <TabsTrigger value="cure">
            Cure ({patientTreatmentsList.length})
          </TabsTrigger>
          <TabsTrigger value="pagamenti">
            Pagamenti ({patientPaymentsList.length})
          </TabsTrigger>
          <TabsTrigger value="richiami">
            Richiami ({patientRecallsList.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab Anagrafica */}
        <TabsContent value="anagrafica">
          <PatientEditForm patient={patient} />
        </TabsContent>

        {/* Tab Appuntamenti */}
        <TabsContent value="appuntamenti">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Storico Appuntamenti</CardTitle>
              <Button size="sm" asChild>
                <Link href={`/dashboard/calendar?patient=${patient.id}`}>
                  Nuovo Appuntamento
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {patientAppointmentsList.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  Nessun appuntamento
                </p>
              ) : (
                <div className="space-y-2">
                  {patientAppointmentsList.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center gap-4 p-3 rounded-lg border border-gray-100"
                    >
                      <div className="text-sm text-gray-500 w-32 shrink-0">
                        {format(new Date(apt.startTime), "d MMM yyyy HH:mm", { locale: it })}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{apt.treatmentName ?? "—"}</p>
                        <p className="text-xs text-gray-500">Dr. {apt.dentistName}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={statusColors[apt.status] ?? ""}
                      >
                        {statusLabels[apt.status] ?? apt.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Cure */}
        <TabsContent value="cure">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Storico Cure</CardTitle>
            </CardHeader>
            <CardContent>
              {patientTreatmentsList.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  Nessuna cura registrata
                </p>
              ) : (
                <div className="space-y-2">
                  {patientTreatmentsList.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-start gap-4 p-3 rounded-lg border border-gray-100"
                    >
                      <div className="text-sm text-gray-500 w-32 shrink-0">
                        {format(new Date(t.performedAt), "d MMM yyyy", { locale: it })}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{t.treatmentName}</p>
                        {t.teeth && t.teeth.length > 0 && (
                          <p className="text-xs text-gray-500">
                            Denti: {t.teeth.join(", ")}
                          </p>
                        )}
                        {t.clinicalNotes && (
                          <p className="text-xs text-gray-600 mt-1">{t.clinicalNotes}</p>
                        )}
                        <p className="text-xs text-gray-500">Dr. {t.dentistName}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={statusColors[t.status] ?? ""}
                      >
                        {statusLabels[t.status] ?? t.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Pagamenti */}
        <TabsContent value="pagamenti">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                Pagamenti — Totale: €{totalPayments.toFixed(2)}
              </CardTitle>
              <Button size="sm" asChild>
                <Link href={`/dashboard/payments/receipts/new?patient=${patient.id}`}>
                  Registra Pagamento
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {patientPaymentsList.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  Nessun pagamento registrato
                </p>
              ) : (
                <div className="space-y-2">
                  {patientPaymentsList.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center gap-4 p-3 rounded-lg border border-gray-100"
                    >
                      <div className="text-sm text-gray-500 w-28 shrink-0">
                        {format(new Date(p.paymentDate), "d MMM yyyy", { locale: it })}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          €{parseFloat(String(p.amount)).toFixed(2)}
                        </p>
                        {p.notes && <p className="text-xs text-gray-500">{p.notes}</p>}
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {p.paymentMethod?.replace("_", " ") ?? "—"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Richiami */}
        <TabsContent value="richiami">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Richiami</CardTitle>
              <Button size="sm" asChild>
                <Link href={`/dashboard/recalls/new?patient=${patient.id}`}>
                  Nuovo Richiamo
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {patientRecallsList.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-6">
                  Nessun richiamo
                </p>
              ) : (
                <div className="space-y-2">
                  {patientRecallsList.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-4 p-3 rounded-lg border border-gray-100"
                    >
                      <div className="text-sm text-gray-500 w-28 shrink-0">
                        {format(new Date(r.dueDate), "d MMM yyyy", { locale: it })}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{r.recallType}</p>
                        {r.notes && <p className="text-xs text-gray-500">{r.notes}</p>}
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          r.status === "active"
                            ? "bg-green-100 text-green-800"
                            : r.status === "sent"
                            ? "bg-blue-100 text-blue-800"
                            : r.status === "completed"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-red-100 text-red-700"
                        }
                      >
                        {statusLabels[r.status] ?? r.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
