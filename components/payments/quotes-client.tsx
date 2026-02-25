"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, Trash2, Search, X } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  draft: "Bozza",
  sent: "Inviato",
  accepted: "Accettato",
  rejected: "Rifiutato",
  expired: "Scaduto",
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-orange-100 text-orange-800",
};

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface TreatmentTypeOption {
  id: string;
  name: string;
  listPrice: string | null;
}

interface QuoteItem {
  id: string;
  quoteNumber: string;
  issueDate: string;
  expiryDate: string | null;
  status: string;
  total: string;
  notes: string | null;
  patientId: string;
  patientFirstName: string | null;
  patientLastName: string | null;
  createdAt: Date;
}

const quoteSchema = z.object({
  patientId: z.string().uuid("Seleziona un paziente"),
  patientName: z.string().min(1),
  issueDate: z.string().min(1),
  expiryDate: z.string().optional(),
  notes: z.string().optional(),
  discountAmount: z.coerce.number().min(0).default(0),
  items: z.array(
    z.object({
      treatmentTypeId: z.string().optional(),
      description: z.string().min(1, "Descrizione obbligatoria"),
      quantity: z.coerce.number().int().min(1).default(1),
      unitPrice: z.coerce.number().min(0),
      discountPct: z.coerce.number().min(0).max(100).default(0),
    })
  ).min(1, "Almeno una voce"),
});

type QuoteFormValues = z.infer<typeof quoteSchema>;

interface QuotesClientProps {
  initialQuotes: QuoteItem[];
  treatmentTypes: TreatmentTypeOption[];
}

export function QuotesClient({ initialQuotes, treatmentTypes }: QuotesClientProps) {
  const router = useRouter();
  const [quotesData, setQuotesData] = useState(initialQuotes);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<PatientOption[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<QuoteFormValues, any, QuoteFormValues>({
    resolver: zodResolver(quoteSchema) as any,
    defaultValues: {
      patientId: "",
      patientName: "",
      issueDate: format(new Date(), "yyyy-MM-dd"),
      items: [{ description: "", quantity: 1, unitPrice: 0, discountPct: 0 }],
      discountAmount: 0,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  const watchItems = form.watch("items");
  const watchDiscount = form.watch("discountAmount");

  const subtotal = watchItems.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const disc = Number(item.discountPct) || 0;
    return sum + qty * price * (1 - disc / 100);
  }, 0);

  const total = subtotal - (Number(watchDiscount) || 0);

  async function searchPatients(q: string) {
    if (q.length < 2) { setPatientResults([]); return; }
    try {
      const res = await fetch(`/api/patients?search=${encodeURIComponent(q)}&pageSize=5`);
      const data = await res.json();
      setPatientResults(data.data ?? []);
    } catch { /* ignore */ }
  }

  function selectPatient(p: PatientOption) {
    form.setValue("patientId", p.id);
    form.setValue("patientName", `${p.lastName} ${p.firstName}`);
    setPatientSearch("");
    setPatientResults([]);
  }

  function addTreatment(id: string) {
    const t = treatmentTypes.find((t) => t.id === id);
    if (!t) return;
    append({
      treatmentTypeId: t.id,
      description: t.name,
      quantity: 1,
      unitPrice: parseFloat(t.listPrice ?? "0"),
      discountPct: 0,
    });
  }

  async function onSubmit(data: QuoteFormValues) {
    setLoading(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: data.patientId,
          issueDate: data.issueDate,
          expiryDate: data.expiryDate || undefined,
          notes: data.notes,
          discountAmount: data.discountAmount,
          items: data.items.map((item) => ({
            ...item,
            treatmentTypeId: item.treatmentTypeId || null,
          })),
        }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setQuotesData((prev) => [created, ...prev]);
      setDialogOpen(false);
      toast.success("Preventivo creato");
      router.refresh();
    } catch {
      toast.error("Errore nella creazione del preventivo");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/quotes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setQuotesData((prev) => prev.map((q) => (q.id === id ? { ...q, status: updated.status } : q)));
      toast.success("Preventivo aggiornato");
    } catch {
      toast.error("Errore");
    }
  }

  const selectedPatientName = form.watch("patientName");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => {
          form.reset({
            patientId: "",
            patientName: "",
            issueDate: format(new Date(), "yyyy-MM-dd"),
            items: [{ description: "", quantity: 1, unitPrice: 0, discountPct: 0 }],
            discountAmount: 0,
          });
          setDialogOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-1" />
          Nuovo Preventivo
        </Button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Numero</TableHead>
              <TableHead>Paziente</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Scadenza</TableHead>
              <TableHead>Totale</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead className="w-32">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotesData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-gray-500">
                  Nessun preventivo
                </TableCell>
              </TableRow>
            ) : (
              quotesData.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-mono text-sm">{q.quoteNumber}</TableCell>
                  <TableCell className="font-medium">
                    {q.patientLastName} {q.patientFirstName}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {format(new Date(q.issueDate), "d MMM yyyy", { locale: it })}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {q.expiryDate ? format(new Date(q.expiryDate), "d MMM yyyy", { locale: it }) : "—"}
                  </TableCell>
                  <TableCell className="font-semibold">
                    €{parseFloat(String(q.total)).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[q.status] ?? ""}>
                      {STATUS_LABELS[q.status] ?? q.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {q.status === "draft" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateStatus(q.id, "sent")}
                        >
                          Invia
                        </Button>
                      )}
                      {q.status === "sent" && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600"
                            onClick={() => updateStatus(q.id, "accepted")}
                          >
                            Accetta
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => updateStatus(q.id, "rejected")}
                          >
                            Rifiuta
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

      {/* Dialog Nuovo Preventivo */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuovo Preventivo</DialogTitle>
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
                        <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0"
                          onClick={() => { form.setValue("patientId", ""); form.setValue("patientName", ""); }}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <Input className="pl-9" placeholder="Cerca paziente..."
                            value={patientSearch}
                            onChange={(e) => { setPatientSearch(e.target.value); searchPatients(e.target.value); }} />
                        </div>
                        {patientResults.length > 0 && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
                            {patientResults.map((p) => (
                              <button key={p.id} type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex justify-between"
                                onClick={() => selectPatient(p)}>
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

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="issueDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data emissione *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="expiryDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scadenza</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Voci */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <FormLabel>Voci *</FormLabel>
                  <div className="flex gap-2">
                    <select
                      className="text-sm border border-gray-200 rounded px-2 py-1"
                      onChange={(e) => { if (e.target.value) addTreatment(e.target.value); e.target.value = ""; }}
                      defaultValue=""
                    >
                      <option value="">+ Dal catalogo...</option>
                      {treatmentTypes.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <Button type="button" variant="outline" size="sm"
                      onClick={() => append({ description: "", quantity: 1, unitPrice: 0, discountPct: 0 })}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div key={field.id} className="grid grid-cols-12 gap-2 items-end border border-gray-100 rounded p-2">
                      <div className="col-span-5">
                        <FormField control={form.control} name={`items.${index}.description`} render={({ field }) => (
                          <FormItem>
                            {index === 0 && <FormLabel className="text-xs">Descrizione</FormLabel>}
                            <FormControl><Input placeholder="Descrizione" className="text-sm" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )} />
                      </div>
                      <div className="col-span-2">
                        <FormField control={form.control} name={`items.${index}.quantity`} render={({ field }) => (
                          <FormItem>
                            {index === 0 && <FormLabel className="text-xs">Qt.</FormLabel>}
                            <FormControl><Input type="number" min={1} className="text-sm" {...field} /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                      <div className="col-span-2">
                        <FormField control={form.control} name={`items.${index}.unitPrice`} render={({ field }) => (
                          <FormItem>
                            {index === 0 && <FormLabel className="text-xs">Prezzo €</FormLabel>}
                            <FormControl><Input type="number" min={0} step={0.01} className="text-sm" {...field} /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                      <div className="col-span-2">
                        <FormField control={form.control} name={`items.${index}.discountPct`} render={({ field }) => (
                          <FormItem>
                            {index === 0 && <FormLabel className="text-xs">Sc. %</FormLabel>}
                            <FormControl><Input type="number" min={0} max={100} className="text-sm" {...field} /></FormControl>
                          </FormItem>
                        )} />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        {fields.length > 1 && (
                          <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                            <Trash2 className="h-3.5 w-3.5 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totale */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotale</span>
                  <span>€{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Sconto globale (€)</span>
                  <FormField control={form.control} name="discountAmount" render={({ field }) => (
                    <FormItem className="mb-0">
                      <FormControl>
                        <Input type="number" min={0} step={0.01} className="w-24 text-sm text-right" {...field} />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="flex justify-between font-bold border-t border-gray-200 pt-1">
                  <span>Totale</span>
                  <span>€{total.toFixed(2)}</span>
                </div>
              </div>

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl><Textarea rows={2} {...field} /></FormControl>
                </FormItem>
              )} />

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Annulla</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvataggio..." : "Crea Preventivo"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
