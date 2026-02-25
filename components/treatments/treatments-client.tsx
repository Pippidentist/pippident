"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
  FormDescription,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Pencil, ToggleLeft } from "lucide-react";
import type { TreatmentType } from "@/lib/db/schema";

const CATEGORIES = [
  "Igiene",
  "Conservativa",
  "Endodonzia",
  "Protesi",
  "Implantologia",
  "Ortodonzia",
  "Chirurgia",
  "Diagnostica",
  "Altro",
];

const treatmentSchema = z.object({
  code: z.string().optional(),
  name: z.string().min(1, "Nome obbligatorio"),
  description: z.string().optional(),
  category: z.string().optional(),
  defaultDurationMinutes: z.coerce.number().int().min(15).default(30),
  listPrice: z.string().optional(),
  autoRecallDays: z.coerce.number().int().min(0).optional().nullable(),
});

type TreatmentFormValues = z.infer<typeof treatmentSchema>;

interface TreatmentsClientProps {
  initialTreatments: TreatmentType[];
}

export function TreatmentsClient({ initialTreatments }: TreatmentsClientProps) {
  const router = useRouter();
  const [treatments, setTreatments] = useState(initialTreatments);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<TreatmentType | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<TreatmentFormValues, any, TreatmentFormValues>({
    resolver: zodResolver(treatmentSchema) as any,
    defaultValues: {
      name: "",
      defaultDurationMinutes: 30,
    },
  });

  function openCreate() {
    setEditingTreatment(null);
    form.reset({ name: "", defaultDurationMinutes: 30, code: "", description: "", listPrice: "", autoRecallDays: undefined });
    setDialogOpen(true);
  }

  function openEdit(t: TreatmentType) {
    setEditingTreatment(t);
    form.reset({
      code: t.code ?? "",
      name: t.name,
      description: t.description ?? "",
      category: t.category ?? "",
      defaultDurationMinutes: t.defaultDurationMinutes,
      listPrice: t.listPrice ?? "",
      autoRecallDays: t.autoRecallDays ?? undefined,
    });
    setDialogOpen(true);
  }

  async function onSubmit(data: TreatmentFormValues) {
    setLoading(true);
    try {
      if (editingTreatment) {
        const res = await fetch(`/api/treatment-types/${editingTreatment.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error();
        const updated = await res.json();
        setTreatments((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
        toast.success("Cura aggiornata");
      } else {
        const res = await fetch("/api/treatment-types", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error();
        const created = await res.json();
        setTreatments((prev) => [...prev, created]);
        toast.success("Cura creata");
      }
      setDialogOpen(false);
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(t: TreatmentType) {
    try {
      const res = await fetch(`/api/treatment-types/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !t.isActive }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setTreatments((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(updated.isActive ? "Cura attivata" : "Cura disattivata");
    } catch {
      toast.error("Errore");
    }
  }

  const filtered = treatments.filter((t) => showInactive || t.isActive);
  const grouped = filtered.reduce<Record<string, TreatmentType[]>>((acc, t) => {
    const cat = t.category ?? "Altro";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowInactive(!showInactive)}
        >
          {showInactive ? "Nascondi disattivate" : "Mostra tutte"}
        </Button>
        <Button onClick={openCreate} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Nuova Cura
        </Button>
      </div>

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">{category}</h3>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Codice</TableHead>
                <TableHead>Durata</TableHead>
                <TableHead>Prezzo listino</TableHead>
                <TableHead>Richiamo auto</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((t) => (
                <TableRow key={t.id} className={!t.isActive ? "opacity-50" : ""}>
                  <TableCell>
                    <p className="font-medium">{t.name}</p>
                    {t.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{t.code ?? "—"}</TableCell>
                  <TableCell>{t.defaultDurationMinutes} min</TableCell>
                  <TableCell>
                    {t.listPrice ? `€${parseFloat(String(t.listPrice)).toFixed(2)}` : "—"}
                  </TableCell>
                  <TableCell>
                    {t.autoRecallDays ? `${t.autoRecallDays} giorni` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={t.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
                    >
                      {t.isActive ? "Attiva" : "Inattiva"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(t)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleActive(t)}
                        title={t.isActive ? "Disattiva" : "Attiva"}
                      >
                        <ToggleLeft className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>Nessuna cura nel catalogo.</p>
          <Button onClick={openCreate} className="mt-4">
            Aggiungi la prima cura
          </Button>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTreatment ? "Modifica Cura" : "Nuova Cura"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Nome *</FormLabel>
                      <FormControl>
                        <Input placeholder="Igiene Professionale" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Codice</FormLabel>
                      <FormControl>
                        <Input placeholder="IG01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <FormControl>
                        <Input placeholder="Igiene" list="categories" {...field} />
                      </FormControl>
                      <datalist id="categories">
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c} />
                        ))}
                      </datalist>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrizione</FormLabel>
                    <FormControl>
                      <Textarea rows={2} placeholder="Descrizione della cura..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="defaultDurationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Durata (min)</FormLabel>
                      <FormControl>
                        <Input type="number" min={15} step={15} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="listPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Prezzo (€)</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} step={0.01} placeholder="80.00" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="autoRecallDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Richiamo (giorni)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder="180"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                        />
                      </FormControl>
                      <FormDescription className="text-xs">
                        Giorni per richiamo auto
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>
                  Annulla
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Salvataggio..." : "Salva"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
