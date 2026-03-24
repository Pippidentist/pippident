"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

const schema = z.object({
  firstName: z.string().min(1, "Nome obbligatorio"),
  lastName: z.string().min(1, "Cognome obbligatorio"),
  gender: z.enum(["M", "F", "Other"], { error: "Sesso obbligatorio" }),
  dateOfBirth: z.string().min(1, "Data di nascita obbligatoria"),
  fiscalCode: z
    .string()
    .regex(/^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/, "Codice fiscale non valido"),
  address: z.string().min(1, "Indirizzo obbligatorio"),
  city: z.string().min(1, "Città obbligatoria"),
  postalCode: z.string().min(5, "CAP obbligatorio"),
  province: z.string().min(2, "Provincia obbligatoria").max(2),
  phone: z.string().min(6, "Telefono obbligatorio"),
  email: z.union([z.literal(""), z.string().email("Email non valida")]).optional(),
  notes: z.string().optional(),
  gdprConsent: z.literal(true, { error: "Il consenso è obbligatorio per procedere" }),
});

type FormValues = z.infer<typeof schema>;

interface PatientRegistrationFormProps {
  studioId: string;
  studioName: string;
}

export function PatientRegistrationForm({ studioId, studioName }: PatientRegistrationFormProps) {
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      fiscalCode: "",
      address: "",
      city: "",
      postalCode: "",
      province: "",
      phone: "",
      email: "",
      notes: "",
    },
  });

  async function onSubmit(data: FormValues) {
    setServerError(null);
    try {
      const res = await fetch(`/api/public/register/${studioId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setSubmitted(true);
      } else {
        const json = await res.json();
        if (res.status === 409) {
          setServerError(json.error);
        } else {
          setServerError("Si è verificato un errore. Riprova.");
        }
      }
    } catch {
      setServerError("Errore di rete. Riprova.");
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-12 space-y-3">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-semibold text-gray-800">Registrazione completata!</h2>
        <p className="text-gray-500">
          I tuoi dati sono stati inviati a <strong>{studioName}</strong>. Verrai contattato a breve.
        </p>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        {/* Nome e Cognome */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome *</FormLabel>
                <FormControl><Input placeholder="Mario" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cognome *</FormLabel>
                <FormControl><Input placeholder="Rossi" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Sesso e Data di nascita */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sesso *</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Seleziona" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="M">Maschio</SelectItem>
                    <SelectItem value="F">Femmina</SelectItem>
                    <SelectItem value="Other">Altro</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dateOfBirth"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Data di nascita *</FormLabel>
                <FormControl><Input type="date" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Codice Fiscale */}
        <FormField
          control={form.control}
          name="fiscalCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Codice Fiscale *</FormLabel>
              <FormControl>
                <Input
                  placeholder="RSSMRA80A01H501U"
                  className="uppercase"
                  {...field}
                  onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Residenza */}
        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Indirizzo *</FormLabel>
              <FormControl><Input placeholder="Via Roma 1" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="city"
            render={({ field }) => (
              <FormItem className="col-span-2 sm:col-span-1">
                <FormLabel>Città *</FormLabel>
                <FormControl><Input placeholder="Milano" {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="postalCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CAP *</FormLabel>
                <FormControl><Input placeholder="20121" maxLength={5} {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="province"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prov. *</FormLabel>
                <FormControl><Input placeholder="MI" maxLength={2} className="uppercase" {...field} onChange={(e) => field.onChange(e.target.value.toUpperCase())} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Contatti */}
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Telefono / WhatsApp *</FormLabel>
              <FormControl><Input placeholder="+39 333 1234567" type="tel" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email (opzionale)</FormLabel>
              <FormControl><Input placeholder="mario@esempio.it" type="email" {...field} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Allergie / Note anamnestiche */}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Allergie / Note anamnestiche (opzionale)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Es: allergia alla penicillina, diabete, ipertensione..."
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* GDPR */}
        <FormField
          control={form.control}
          name="gdprConsent"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-lg border p-4 bg-gray-50">
              <FormControl>
                <Checkbox
                  checked={field.value === true}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-sm font-medium">
                  Consenso al trattamento dei dati personali *
                </FormLabel>
                <p className="text-xs text-gray-500">
                  Autorizzo <strong>{studioName}</strong> al trattamento dei miei dati personali
                  ai sensi del Regolamento UE 2016/679 (GDPR) per la gestione del rapporto di cura.
                </p>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />

        {serverError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
            {serverError}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? "Invio in corso..." : "Invia registrazione"}
        </Button>

        <p className="text-xs text-center text-gray-400">* Campo obbligatorio</p>
      </form>
    </Form>
  );
}
