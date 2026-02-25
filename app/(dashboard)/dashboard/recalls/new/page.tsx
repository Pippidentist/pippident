"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

const recallSchema = z.object({
    patientSearch: z.string().min(1, "Paziente obbligatorio"),
    patientId: z.string().uuid("Seleziona un paziente dalla lista"),
    recallType: z.string().min(1, "Tipo richiamo obbligatorio"),
    dueDate: z.string().min(1, "Data obbligatoria"),
    notes: z.string().optional(),
});

type RecallFormValues = z.infer<typeof recallSchema>;

interface PatientSuggestion {
    id: string;
    firstName: string;
    lastName: string;
    phone: string;
}

function NewRecallForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const prefilledPatientId = searchParams.get("patient");

    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<PatientSuggestion[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const form = useForm<RecallFormValues>({
        resolver: zodResolver(recallSchema) as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        defaultValues: {
            patientSearch: "",
            patientId: "",
            recallType: "",
            dueDate: "",
            notes: "",
        },
    });

    // Se arriva con ?patient=<id>, carica i dati del paziente
    useEffect(() => {
        if (!prefilledPatientId) return;
        async function fetchPatient() {
            try {
                const res = await fetch(`/api/patients/${prefilledPatientId}`);
                if (!res.ok) return;
                const data = await res.json();
                form.setValue("patientId", data.id);
                form.setValue("patientSearch", `${data.lastName} ${data.firstName} — ${data.phone}`);
            } catch {
                // ignore
            }
        }
        fetchPatient();
    }, [prefilledPatientId, form]);

    async function searchPatients(query: string) {
        if (query.length < 2) {
            setSuggestions([]);
            return;
        }
        try {
            const res = await fetch(`/api/patients?search=${encodeURIComponent(query)}&pageSize=10`);
            if (!res.ok) return;
            const data = await res.json();
            setSuggestions(data.data ?? data);
        } catch {
            // ignore
        }
    }

    async function onSubmit(data: RecallFormValues) {
        setLoading(true);
        try {
            const res = await fetch("/api/recalls", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    patientId: data.patientId,
                    recallType: data.recallType,
                    dueDate: data.dueDate,
                    notes: data.notes || undefined,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? "Errore nel salvataggio");
            }

            toast.success("Richiamo creato con successo");

            if (prefilledPatientId) {
                router.push(`/dashboard/patients/${prefilledPatientId}`);
            } else {
                router.push("/dashboard/recalls");
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : "Errore nel salvataggio");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="max-w-lg mx-auto space-y-6">
            <div className="flex items-center gap-3">
                <Button variant="ghost" size="sm" asChild>
                    <Link
                        href={prefilledPatientId ? `/dashboard/patients/${prefilledPatientId}` : "/dashboard/recalls"}
                        className="flex items-center gap-1"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        {prefilledPatientId ? "Scheda paziente" : "Richiami"}
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Nuovo Richiamo</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">

                            {/* Paziente */}
                            <FormField
                                control={form.control}
                                name="patientSearch"
                                render={({ field }) => (
                                    <FormItem className="relative">
                                        <FormLabel>Paziente *</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="Cerca per nome o telefono..."
                                                {...field}
                                                onChange={(e) => {
                                                    field.onChange(e);
                                                    form.setValue("patientId", "");
                                                    searchPatients(e.target.value);
                                                    setShowSuggestions(true);
                                                }}
                                                onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                                autoComplete="off"
                                            />
                                        </FormControl>
                                        {showSuggestions && suggestions.length > 0 && (
                                            <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                {suggestions.map((p) => (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-100 last:border-0"
                                                        onMouseDown={() => {
                                                            form.setValue("patientId", p.id);
                                                            form.setValue(
                                                                "patientSearch",
                                                                `${p.lastName} ${p.firstName} — ${p.phone}`
                                                            );
                                                            setSuggestions([]);
                                                            setShowSuggestions(false);
                                                        }}
                                                    >
                                                        <span className="font-medium">{p.lastName} {p.firstName}</span>
                                                        <span className="text-gray-500 ml-2">{p.phone}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <FormMessage />
                                        {/* Errore patientId */}
                                        {form.formState.errors.patientId && (
                                            <p className="text-sm font-medium text-destructive">
                                                {form.formState.errors.patientId.message}
                                            </p>
                                        )}
                                    </FormItem>
                                )}
                            />

                            {/* Tipo richiamo */}
                            <FormField
                                control={form.control}
                                name="recallType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tipo richiamo *</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="es. Igiene semestrale, Visita di controllo annuale..."
                                                list="recall-types"
                                                {...field}
                                            />
                                        </FormControl>
                                        <datalist id="recall-types">
                                            <option value="Igiene semestrale" />
                                            <option value="Igiene annuale" />
                                            <option value="Visita di controllo annuale" />
                                            <option value="Visita di controllo semestrale" />
                                            <option value="Controllo post-impianto" />
                                            <option value="Controllo ortodontico" />
                                            <option value="Sbiancamento annuale" />
                                        </datalist>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Data prevista */}
                            <FormField
                                control={form.control}
                                name="dueDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Data prevista *</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* Note */}
                            <FormField
                                control={form.control}
                                name="notes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Note</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Note aggiuntive sul richiamo..."
                                                rows={3}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="flex justify-end gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.back()}
                                >
                                    Annulla
                                </Button>
                                <Button type="submit" disabled={loading}>
                                    {loading ? "Salvataggio..." : "Crea Richiamo"}
                                </Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
        </div>
    );
}

export default function NewRecallPage() {
    return (
        <Suspense fallback={<div className="p-6 text-gray-500">Caricamento...</div>}>
            <NewRecallForm />
        </Suspense>
    );
}
