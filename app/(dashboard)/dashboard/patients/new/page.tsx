"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PatientForm, type PatientFormValues } from "@/components/patients/patient-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default function NewPatientPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleSubmit(data: PatientFormValues) {
    setLoading(true);
    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error ?? "Errore nel salvataggio");
      }

      const patient = await res.json();
      toast.success("Paziente creato con successo");
      router.push(`/dashboard/patients/${patient.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore nel salvataggio");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/patients" className="flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />
            Pazienti
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nuovo Paziente</CardTitle>
        </CardHeader>
        <CardContent>
          <PatientForm
            onSubmit={handleSubmit}
            isLoading={loading}
            submitLabel="Crea Paziente"
          />
        </CardContent>
      </Card>
    </div>
  );
}
