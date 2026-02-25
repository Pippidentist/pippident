"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
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
import { Plus, Search, X } from "lucide-react";

const METHOD_LABELS: Record<string, string> = {
  cash: "Contanti",
  card: "Carta",
  bank_transfer: "Bonifico",
  financing: "Finanziamento",
};

const paymentSchema = z.object({
  patientId: z.string().uuid("Seleziona un paziente"),
  patientName: z.string().min(1),
  paymentDate: z.string().min(1, "Data obbligatoria"),
  amount: z.coerce.number().positive("Importo obbligatorio"),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "financing"]),
  notes: z.string().optional(),
});

type PaymentFormValues = z.infer<typeof paymentSchema>;

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface PaymentItem {
  id: string;
  receiptNumber: string | null;
  paymentDate: string;
  amount: string;
  paymentMethod: string | null;
  notes: string | null;
  patientId: string;
  patientFirstName: string | null;
  patientLastName: string | null;
  createdAt: Date;
}

interface ReceiptsClientProps {
  initialPayments: PaymentItem[];
}

export function ReceiptsClient({ initialPayments }: ReceiptsClientProps) {
  const router = useRouter();
  const [paymentsData, setPaymentsData] = useState(initialPayments);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<PatientOption[]>([]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<PaymentFormValues, any, PaymentFormValues>({
    resolver: zodResolver(paymentSchema) as any,
    defaultValues: {
      patientId: "",
      patientName: "",
      paymentDate: format(new Date(), "yyyy-MM-dd"),
      amount: 0,
      paymentMethod: "cash",
    },
  });

  const selectedPatientName = form.watch("patientName");

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

  async function onSubmit(data: PaymentFormValues) {
    setLoading(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: data.patientId,
          paymentDate: data.paymentDate,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          notes: data.notes,
        }),
      });
      if (!res.ok) throw new Error();
      const created = await res.json();
      setPaymentsData((prev) => [created, ...prev]);
      setDialogOpen(false);
      toast.success("Pagamento registrato");
      router.refresh();
    } catch {
      toast.error("Errore nella registrazione");
    } finally {
      setLoading(false);
    }
  }

  const totalIncome = paymentsData.reduce(
    (sum, p) => sum + parseFloat(String(p.amount)),
    0
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="bg-white border border-gray-200 rounded-lg px-4 py-2">
          <p className="text-xs text-gray-500">Totale incassato</p>
          <p className="text-xl font-bold text-gray-900">€{totalIncome.toFixed(2)}</p>
        </div>
        <Button onClick={() => {
          form.reset({
            patientId: "",
            patientName: "",
            paymentDate: format(new Date(), "yyyy-MM-dd"),
            amount: 0,
            paymentMethod: "cash",
          });
          setDialogOpen(true);
        }}>
          <Plus className="h-4 w-4 mr-1" />
          Registra Pagamento
        </Button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>N. Ricevuta</TableHead>
              <TableHead>Paziente</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Importo</TableHead>
              <TableHead>Metodo</TableHead>
              <TableHead>Note</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paymentsData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-gray-500">
                  Nessun pagamento registrato
                </TableCell>
              </TableRow>
            ) : (
              paymentsData.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-sm">
                    {p.receiptNumber ?? "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {p.patientLastName} {p.patientFirstName}
                  </TableCell>
                  <TableCell className="text-gray-600">
                    {format(new Date(p.paymentDate), "d MMM yyyy", { locale: it })}
                  </TableCell>
                  <TableCell className="font-semibold">
                    €{parseFloat(String(p.amount)).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {METHOD_LABELS[p.paymentMethod ?? ""] ?? p.paymentMethod}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {p.notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registra Pagamento</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {/* Paziente */}
              <FormField control={form.control} name="patientId" render={({ field }) => (
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
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="paymentDate" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data *</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="amount" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Importo (€) *</FormLabel>
                    <FormControl><Input type="number" min={0} step={0.01} placeholder="0.00" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="paymentMethod" render={({ field }) => (
                <FormItem>
                  <FormLabel>Metodo di pagamento *</FormLabel>
                  <FormControl>
                    <select className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm" {...field}>
                      <option value="cash">Contanti</option>
                      <option value="card">Carta</option>
                      <option value="bank_transfer">Bonifico</option>
                      <option value="financing">Finanziamento</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl><Textarea rows={2} placeholder="Note opzionali..." {...field} /></FormControl>
                </FormItem>
              )} />

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Annulla</Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvataggio..." : "Registra"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
