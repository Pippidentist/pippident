"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PatientForm, type PatientFormValues } from "./patient-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Patient } from "@/lib/db/schema";
import { Trash2 } from "lucide-react";

interface PatientEditFormProps {
  patient: Patient;
}

export function PatientEditForm({ patient }: PatientEditFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const defaultValues: Partial<PatientFormValues> = {
    firstName: patient.firstName,
    lastName: patient.lastName,
    phone: patient.phone,
    email: patient.email ?? "",
    dateOfBirth: patient.dateOfBirth ?? undefined,
    fiscalCode: patient.fiscalCode ?? "",
    gender: patient.gender as "M" | "F" | "Other" | undefined,
    address: patient.address ?? undefined,
    city: patient.city ?? undefined,
    postalCode: patient.postalCode ?? undefined,
    province: patient.province ?? undefined,
    notes: patient.notes ?? undefined,
    gdprConsent: patient.gdprConsent,
    firstVisitDate: patient.firstVisitDate ?? undefined,
  };

  async function handleSubmit(data: PatientFormValues) {
    setLoading(true);
    try {
      const res = await fetch(`/api/patients/${patient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Errore nel salvataggio");
      toast.success("Paziente aggiornato");
      router.refresh();
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive() {
    setArchiving(true);
    try {
      const res = await fetch(`/api/patients/${patient.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Errore nell'archiviazione");
      toast.success("Paziente archiviato");
      router.push("/dashboard/patients");
      router.refresh();
    } catch {
      toast.error("Errore nell'archiviazione");
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Dati Anagrafici</CardTitle>
          {!patient.isArchived && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Archivia
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Archivia paziente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Il paziente sarà archiviato. I dati restano nel database per obblighi
                    legali. Potrai visualizzarlo attivando i filtri &quot;Mostra archiviati&quot;.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleArchive}
                    disabled={archiving}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Archivia
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </CardHeader>
        <CardContent>
          <PatientForm
            defaultValues={defaultValues}
            onSubmit={handleSubmit}
            isLoading={loading}
            submitLabel="Salva Modifiche"
          />
        </CardContent>
      </Card>
    </div>
  );
}
