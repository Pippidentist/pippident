"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/form";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import type { Studio } from "@/lib/db/schema";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
type DayKey = typeof DAYS[number];

const DAY_LABELS: Record<DayKey, string> = {
  Monday: "Lunedì",
  Tuesday: "Martedì",
  Wednesday: "Mercoledì",
  Thursday: "Giovedì",
  Friday: "Venerdì",
  Saturday: "Sabato",
  Sunday: "Domenica",
};

type DaySchedule = { isOpen: boolean; open: string; close: string };
type OpeningHoursState = Record<DayKey, DaySchedule>;

function RegistrationLinkBox({ studioId }: { studioId: string }) {
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${baseUrl}/register/${studioId}`;
  return (
    <div className="flex items-center gap-2">
      <Input readOnly value={link} className="text-xs text-gray-600 bg-gray-50" />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiato!"); }}
      >
        Copia
      </Button>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Amministratore",
  dentist: "Dentista",
  secretary: "Segreteria",
};

const studioSchema = z.object({
  name: z.string().min(1, "Nome studio obbligatorio"),
  email: z.string().email("Email non valida"),
  phone: z.string().optional(),
  address: z.string().optional(),
  vatNumber: z.string().optional(),
});

const userSchema = z.object({
  fullName: z.string().min(2, "Nome obbligatorio"),
  email: z.string().email("Email non valida"),
  password: z.string().min(8, "Password di almeno 8 caratteri"),
  role: z.enum(["admin", "dentist", "secretary"]),
});

type StudioFormValues = z.infer<typeof studioSchema>;
type UserFormValues = z.infer<typeof userSchema>;

interface StudioUser {
  id: string;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  lastLoginAt: Date | null;
}

interface SettingsClientProps {
  studio: Studio;
  studioUsers: StudioUser[];
  currentUserId: string;
}

export function SettingsClient({ studio, studioUsers, currentUserId }: SettingsClientProps) {
  const router = useRouter();
  const [users, setUsers] = useState(studioUsers);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [savingStudio, setSavingStudio] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [twilioPhone, setTwilioPhone] = useState(studio.twilioPhoneFrom ?? "");
  const [savingWhatsapp, setSavingWhatsapp] = useState(false);
  const [savingHours, setSavingHours] = useState(false);

  const initOpeningHours = (): OpeningHoursState => {
    const saved = (studio.settings as { openingHours?: Record<string, { open: string; close: string }> } | null)?.openingHours ?? {};
    return Object.fromEntries(
      DAYS.map((day) => [
        day,
        { isOpen: !!saved[day], open: saved[day]?.open ?? "09:00", close: saved[day]?.close ?? "18:00" },
      ])
    ) as OpeningHoursState;
  };

  const [openingHours, setOpeningHours] = useState<OpeningHoursState>(initOpeningHours);

  const studioForm = useForm<StudioFormValues>({
    resolver: zodResolver(studioSchema),
    defaultValues: {
      name: studio.name,
      email: studio.email,
      phone: studio.phone ?? "",
      address: studio.address ?? "",
      vatNumber: studio.vatNumber ?? "",
    },
  });

  const userForm = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { fullName: "", email: "", password: "", role: "secretary" },
  });

  async function saveStudio(data: StudioFormValues) {
    setSavingStudio(true);
    try {
      const res = await fetch("/api/settings/studio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast.success("Impostazioni studio salvate");
      router.refresh();
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSavingStudio(false);
    }
  }

  async function createUser(data: UserFormValues) {
    setCreatingUser(true);
    try {
      const res = await fetch("/api/settings/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Errore");
      }
      const created = await res.json();
      setUsers((prev) => [...prev, created]);
      setUserDialogOpen(false);
      toast.success("Utente creato con successo");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Errore nella creazione");
    } finally {
      setCreatingUser(false);
    }
  }

  async function saveWhatsapp(e: React.FormEvent) {
    e.preventDefault();
    setSavingWhatsapp(true);
    try {
      const res = await fetch("/api/settings/studio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ twilioPhoneFrom: twilioPhone.trim() || null }),
      });
      if (!res.ok) throw new Error();
      toast.success("Configurazione WhatsApp salvata");
      router.refresh();
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSavingWhatsapp(false);
    }
  }

  function updateDay(day: DayKey, patch: Partial<DaySchedule>) {
    setOpeningHours((prev) => ({ ...prev, [day]: { ...prev[day], ...patch } }));
  }

  async function saveOpeningHours(e: React.FormEvent) {
    e.preventDefault();
    setSavingHours(true);
    try {
      const toSave = Object.fromEntries(
        DAYS.filter((d) => openingHours[d].isOpen).map((d) => [
          d,
          { open: openingHours[d].open, close: openingHours[d].close },
        ])
      );
      const res = await fetch("/api/settings/studio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingHours: toSave }),
      });
      if (!res.ok) throw new Error();
      toast.success("Orari salvati");
      router.refresh();
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSavingHours(false);
    }
  }

  async function toggleUser(userId: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/settings/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!res.ok) throw new Error();
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: !isActive } : u))
      );
      toast.success(!isActive ? "Utente attivato" : "Utente disattivato");
    } catch {
      toast.error("Errore");
    }
  }

  return (
    <Tabs defaultValue="studio">
      <TabsList>
        <TabsTrigger value="studio">Profilo Studio</TabsTrigger>
        <TabsTrigger value="orari">Orari</TabsTrigger>
        <TabsTrigger value="users">Utenti ({users.length})</TabsTrigger>
        <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
      </TabsList>

      {/* Tab Studio */}
      <TabsContent value="studio">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dati Studio</CardTitle>
          </CardHeader>
          <CardContent>
            <Form {...studioForm}>
              <form onSubmit={studioForm.handleSubmit(saveStudio)} className="space-y-4 max-w-lg">
                <FormField control={studioForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Studio *</FormLabel>
                    <FormControl><Input placeholder="Studio Dentistico Rossi" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={studioForm.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={studioForm.control} name="phone" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefono</FormLabel>
                      <FormControl><Input type="tel" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={studioForm.control} name="vatNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel>P.IVA</FormLabel>
                      <FormControl><Input placeholder="IT12345678901" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={studioForm.control} name="address" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Indirizzo</FormLabel>
                    <FormControl><Input placeholder="Via Roma 1, Milano" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="flex justify-end">
                  <Button type="submit" disabled={savingStudio}>
                    {savingStudio ? "Salvataggio..." : "Salva Modifiche"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab Orari */}
      <TabsContent value="orari">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orari di apertura</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Configura i giorni e gli orari in cui lo studio è aperto. Non sarà possibile prenotare appuntamenti fuori da questi orari.
            </p>
            <form onSubmit={saveOpeningHours} className="space-y-3">
              {DAYS.map((day) => {
                const schedule = openingHours[day];
                return (
                  <div key={day} className="flex items-center gap-4 py-2 border-b border-gray-100 last:border-0">
                    <div className="w-28">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 accent-blue-600"
                          checked={schedule.isOpen}
                          onChange={(e) => updateDay(day, { isOpen: e.target.checked })}
                        />
                        <span className="text-sm font-medium">{DAY_LABELS[day]}</span>
                      </label>
                    </div>
                    {schedule.isOpen ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          className="border border-gray-200 rounded-md px-2 py-1 text-sm w-28"
                          value={schedule.open}
                          onChange={(e) => updateDay(day, { open: e.target.value })}
                        />
                        <span className="text-gray-400 text-sm">—</span>
                        <input
                          type="time"
                          className="border border-gray-200 rounded-md px-2 py-1 text-sm w-28"
                          value={schedule.close}
                          onChange={(e) => updateDay(day, { close: e.target.value })}
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 italic">Chiuso</span>
                    )}
                  </div>
                );
              })}
              <div className="flex justify-end pt-2">
                <Button type="submit" disabled={savingHours}>
                  {savingHours ? "Salvataggio..." : "Salva Orari"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab WhatsApp */}
      <TabsContent value="whatsapp" className="space-y-4">
        {/* Registration link */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Link di registrazione pazienti</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-gray-600">
              Invia questo link ai tuoi pazienti per farli registrare online. Raccoglie tutti i dati anagrafici e il consenso GDPR.
            </p>
            <RegistrationLinkBox studioId={studio.id} />
          </CardContent>
        </Card>

        {/* WhatsApp bot config */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configurazione WhatsApp Bot</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveWhatsapp} className="space-y-4 max-w-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Numero WhatsApp Studio (Twilio)
                </label>
                <Input
                  placeholder="whatsapp:+393331234567"
                  value={twilioPhone}
                  onChange={(e) => setTwilioPhone(e.target.value)}
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  Inserisci il numero Twilio nel formato <code>whatsapp:+39XXXXXXXXXX</code>.
                  Per la sandbox usa <code>whatsapp:+14155238886</code>.
                  I pazienti potranno interagire con il bot da questo numero.
                </p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700 space-y-1">
                <p className="font-medium">Funzionalità abilitate quando configurato:</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>Messaggio di benvenuto ai nuovi pazienti</li>
                  <li>Registrazione self-service via WhatsApp</li>
                  <li>Lista appuntamenti su richiesta</li>
                  <li>Cancellazione appuntamenti via chat</li>
                  <li>Reminder automatici 48h e 2h prima</li>
                </ul>
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={savingWhatsapp}>
                  {savingWhatsapp ? "Salvataggio..." : "Salva configurazione WhatsApp"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab Utenti */}
      <TabsContent value="users">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Gestione Utenti</CardTitle>
            <Button size="sm" onClick={() => {
              userForm.reset({ fullName: "", email: "", password: "", role: "secretary" });
              setUserDialogOpen(true);
            }}>
              Aggiungi Utente
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-4 p-3 border border-gray-100 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{user.fullName}</p>
                      {user.id === currentUserId && (
                        <Badge variant="outline" className="text-xs">Tu</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">{user.email}</p>
                    {user.lastLoginAt && (
                      <p className="text-xs text-gray-400">
                        Ultimo accesso: {format(new Date(user.lastLoginAt), "d MMM yyyy HH:mm", { locale: it })}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {ROLE_LABELS[user.role] ?? user.role}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={user.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
                  >
                    {user.isActive ? "Attivo" : "Disattivato"}
                  </Badge>
                  {user.id !== currentUserId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleUser(user.id, user.isActive)}
                    >
                      {user.isActive ? "Disattiva" : "Attiva"}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Dialog Nuovo Utente */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuovo Utente</DialogTitle>
          </DialogHeader>
          <Form {...userForm}>
            <form onSubmit={userForm.handleSubmit(createUser)} className="space-y-4">
              <FormField control={userForm.control} name="fullName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome completo *</FormLabel>
                  <FormControl><Input placeholder="Mario Rossi" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={userForm.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl><Input type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={userForm.control} name="password" render={({ field }) => (
                <FormItem>
                  <FormLabel>Password *</FormLabel>
                  <FormControl><Input type="password" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={userForm.control} name="role" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ruolo *</FormLabel>
                  <FormControl>
                    <select className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm" {...field}>
                      <option value="admin">Amministratore</option>
                      <option value="dentist">Dentista</option>
                      <option value="secretary">Segreteria</option>
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setUserDialogOpen(false)}>Annulla</Button>
                <Button type="submit" disabled={creatingUser}>
                  {creatingUser ? "Creazione..." : "Crea Utente"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Tabs>
  );
}
