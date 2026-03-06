"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Stethoscope,
  CheckCircle,
  ArrowRight,
  Lock,
  Loader2,
  AlertCircle,
} from "lucide-react";

// ─── Plan definitions ────────────────────────────────────────────────────────

const PLANS = {
  base: {
    name: "Piano Base",
    price: "99",
    features: [
      "Gestione pazienti",
      "Calendario appuntamenti",
      "Catalogo cure e storico clinico",
      "Preventivi e pagamenti",
      "Supporto via email",
    ],
  },
  growth: {
    name: "Piano Growth",
    price: "349",
    features: [
      "Tutto il piano Base",
      "WhatsApp Bot integrato",
      "150 chiamate AI/mese",
      "Promemoria appuntamenti via WhatsApp",
      "Prenotazioni pazienti via WhatsApp",
    ],
  },
  pro: {
    name: "Piano Pro",
    price: "599",
    features: [
      "Tutto il piano Growth",
      "250 chiamate AI/mese",
      "Supporto prioritario",
    ],
  },
  clinic: {
    name: "Piano Clinic",
    price: "799",
    features: [
      "Tutto il piano Pro",
      "500 chiamate AI/mese",
      "Supporto dedicato",
      "Onboarding personalizzato",
    ],
  },
} as const;

type PlanKey = keyof typeof PLANS;

// ─── Main content ────────────────────────────────────────────────────────────

function CheckoutContent() {
  const searchParams = useSearchParams();
  const rawPlan = searchParams.get("plan") ?? "base";
  const planKey: PlanKey = rawPlan in PLANS ? (rawPlan as PlanKey) : "base";
  const plan = PLANS[planKey];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [account, setAccount] = useState({
    studioName: "",
    ownerName: "",
    email: "",
    password: "",
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  function validateAccount() {
    if (!account.studioName.trim()) return "Inserisci il nome dello studio";
    if (!account.ownerName.trim()) return "Inserisci il tuo nome e cognome";
    if (!/\S+@\S+\.\S+/.test(account.email)) return "Inserisci un'email valida";
    if (account.password.length < 8) return "La password deve avere almeno 8 caratteri";
    return null;
  }

  // ── Handler ────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    const err = validateAccount();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studioName: account.studioName,
          ownerName: account.ownerName,
          email: account.email,
          password: account.password,
          plan: planKey,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Errore durante la creazione della sessione.");
        setLoading(false);
        return;
      }

      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch {
      setError("Errore di rete. Riprova.");
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <Stethoscope className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="font-bold text-gray-900">Pippident</span>
        </Link>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12 flex flex-col md:flex-row gap-8">
        {/* ── Order summary ─────────────────────────────────────────────── */}
        <aside className="md:w-72 shrink-0">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-8">
            <p className="text-xs text-gray-400 uppercase font-semibold tracking-wide mb-4">
              Riepilogo ordine
            </p>

            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl font-bold text-gray-900">€{plan.price}</span>
              <span className="text-gray-500 text-sm">/mese</span>
            </div>
            <p className="font-semibold text-gray-900 mb-1">{plan.name}</p>
            <p className="text-sm text-blue-600 mb-5">
              15 giorni gratuiti, poi €{plan.price}/mese
            </p>

            <ul className="space-y-2.5 mb-6">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <div className="border-t border-gray-100 pt-4 space-y-1 text-sm">
              <div className="flex justify-between text-gray-500">
                <span>Dovuto oggi</span>
                <span className="font-semibold text-green-600">€0,00</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>Dal giorno 31</span>
                <span className="font-semibold text-gray-900">€{plan.price}/mese</span>
              </div>
            </div>
          </div>
        </aside>

        {/* ── Account form ──────────────────────────────────────────────── */}
        <div className="flex-1">
          <div className="bg-white rounded-2xl border border-gray-200 p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-2">Crea il tuo account</h2>
            <p className="text-sm text-gray-500 mb-6">
              Inserisci i dati del tuo studio. Il pagamento avviene in modo sicuro su Stripe.
            </p>

            <div className="space-y-4">
              <div>
                <Label htmlFor="studioName">Nome dello studio</Label>
                <Input
                  id="studioName"
                  placeholder="Studio Dentistico Rossi"
                  className="mt-1.5"
                  value={account.studioName}
                  onChange={(e) =>
                    setAccount((a) => ({ ...a, studioName: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="ownerName">Nome e cognome</Label>
                <Input
                  id="ownerName"
                  placeholder="Mario Rossi"
                  className="mt-1.5"
                  value={account.ownerName}
                  onChange={(e) =>
                    setAccount((a) => ({ ...a, ownerName: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="mario@studiodentistico.it"
                  className="mt-1.5"
                  value={account.email}
                  onChange={(e) =>
                    setAccount((a) => ({ ...a, email: e.target.value }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Minimo 8 caratteri"
                  className="mt-1.5"
                  value={account.password}
                  onChange={(e) =>
                    setAccount((a) => ({ ...a, password: e.target.value }))
                  }
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Reindirizzamento a Stripe...
                </>
              ) : (
                <>
                  Continua al pagamento
                  <ArrowRight className="ml-2 w-4 h-4" />
                </>
              )}
            </Button>

            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400 mt-4">
              <Lock className="w-3 h-3" />
              Pagamento sicuro gestito da Stripe · Dati cifrati
            </div>

            <p className="text-center text-xs text-gray-400 mt-3">
              Hai già un account?{" "}
              <Link href="/login" className="text-blue-600 hover:underline">
                Accedi
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Page export with Suspense boundary ─────────────────────────────────────

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
