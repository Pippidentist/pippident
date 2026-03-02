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
  essenziale: {
    name: "Piano Essenziale",
    price: "99",
    features: [
      "Gestione pazienti illimitata",
      "Calendario appuntamenti",
      "Catalogo cure e storico clinico",
      "Preventivi e pagamenti",
      "Supporto via email",
    ],
  },
  completo: {
    name: "Piano Completo",
    price: "199",
    features: [
      "Tutto il piano Essenziale",
      "Bot WhatsApp integrato",
      "Promemoria appuntamenti via WhatsApp",
      "Richiami automatici via WhatsApp",
      "Prenotazioni pazienti via WhatsApp",
      "Supporto prioritario",
    ],
  },
} as const;

type PlanKey = keyof typeof PLANS;

// ─── Card helpers ─────────────────────────────────────────────────────────────

function detectBrand(number: string) {
  const n = number.replace(/\s/g, "");
  if (n.startsWith("4")) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "mastercard";
  if (/^3[47]/.test(n)) return "amex";
  return "generic";
}

function formatCardNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 16);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

const BRAND_GRADIENT: Record<string, string> = {
  visa: "from-blue-700 to-blue-500",
  mastercard: "from-orange-600 to-red-500",
  amex: "from-emerald-600 to-teal-500",
  generic: "from-gray-600 to-gray-500",
};

const BRAND_LABEL: Record<string, string> = {
  visa: "VISA",
  mastercard: "MASTERCARD",
  amex: "AMEX",
  generic: "",
};

// ─── Main content (uses useSearchParams) ────────────────────────────────────

function CheckoutContent() {
  const searchParams = useSearchParams();
  const rawPlan = searchParams.get("plan") ?? "essenziale";
  const planKey: PlanKey = rawPlan in PLANS ? (rawPlan as PlanKey) : "essenziale";
  const plan = PLANS[planKey];

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [account, setAccount] = useState({
    studioName: "",
    ownerName: "",
    email: "",
    password: "",
  });

  const [card, setCard] = useState({
    number: "",
    expiry: "",
    cvv: "",
    name: "",
  });

  const brand = detectBrand(card.number);

  // ── Validation ────────────────────────────────────────────────────────────

  function validateStep1() {
    if (!account.studioName.trim()) return "Inserisci il nome dello studio";
    if (!account.ownerName.trim()) return "Inserisci il tuo nome e cognome";
    if (!/\S+@\S+\.\S+/.test(account.email)) return "Inserisci un'email valida";
    if (account.password.length < 8) return "La password deve avere almeno 8 caratteri";
    return null;
  }

  function validateStep2() {
    if (card.number.replace(/\s/g, "").length < 16) return "Numero carta non valido";
    if (card.expiry.length < 5) return "Data di scadenza non valida";
    if (card.cvv.length < 3) return "CVV non valido";
    if (!card.name.trim()) return "Inserisci il nome sul carta";
    return null;
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleStep1Next() {
    const err = validateStep1();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep(2);
  }

  async function handleStep2Submit() {
    const err = validateStep2();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setLoading(true);

    // Simulated payment delay (1.5s)
    await new Promise((r) => setTimeout(r, 1500));

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
        setError(data.error ?? "Errore durante la creazione dell'account.");
        setLoading(false);
        return;
      }

      setStep(3);
    } catch {
      setError("Errore di rete. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

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
              30 giorni gratuiti, poi €{plan.price}/mese
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

        {/* ── Steps ─────────────────────────────────────────────────────── */}
        <div className="flex-1">
          {/* Step indicator */}
          {step < 3 && (
            <div className="flex items-center gap-3 mb-8">
              {[
                { n: 1, label: "Account" },
                { n: 2, label: "Pagamento" },
              ].map((s, i) => (
                <div key={s.n} className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        step >= s.n
                          ? "bg-blue-600 text-white"
                          : "bg-gray-200 text-gray-400"
                      }`}
                    >
                      {step > s.n ? "✓" : s.n}
                    </div>
                    <span
                      className={`text-sm font-medium ${
                        step >= s.n ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {i === 0 && (
                    <div
                      className={`h-px w-8 transition-colors ${
                        step > 1 ? "bg-blue-600" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Step 1: Account ───────────────────────────────────────── */}
          {step === 1 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Crea il tuo account</h2>
              <p className="text-sm text-gray-500 mb-6">
                Inserisci i dati del tuo studio per iniziare la prova gratuita.
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
                onClick={handleStep1Next}
              >
                Continua al pagamento
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>

              <p className="text-center text-xs text-gray-400 mt-4">
                Hai già un account?{" "}
                <Link href="/login" className="text-blue-600 hover:underline">
                  Accedi
                </Link>
              </p>
            </div>
          )}

          {/* ── Step 2: Fake payment ──────────────────────────────────── */}
          {step === 2 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-2">Dati di pagamento</h2>
              <p className="text-sm text-gray-500 mb-6">
                Non ti verrà addebitato nulla oggi. Puoi cancellare prima della fine della prova.
              </p>

              {/* Card preview */}
              <div
                className={`w-full max-w-sm mb-8 rounded-2xl p-5 bg-gradient-to-br ${BRAND_GRADIENT[brand]} text-white select-none`}
              >
                <div className="flex justify-between items-start mb-8">
                  {/* Chip */}
                  <div className="w-10 h-7 bg-yellow-400/90 rounded-sm" />
                  {BRAND_LABEL[brand] && (
                    <span className="text-xs font-bold tracking-widest opacity-80">
                      {BRAND_LABEL[brand]}
                    </span>
                  )}
                </div>
                <div className="font-mono text-lg tracking-[0.2em] mb-5 opacity-95">
                  {(() => {
                    const digits = card.number.replace(/\s/g, "");
                    if (!digits) return "•••• •••• •••• ••••";
                    const padded = digits.padEnd(16, "•");
                    return [0, 4, 8, 12].map((i) => padded.slice(i, i + 4)).join(" ");
                  })()}
                </div>
                <div className="flex justify-between text-xs">
                  <div>
                    <div className="opacity-50 mb-0.5 uppercase text-[10px]">Titolare</div>
                    <div className="font-semibold tracking-wide">
                      {card.name || "NOME COGNOME"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="opacity-50 mb-0.5 uppercase text-[10px]">Scade</div>
                    <div className="font-semibold">{card.expiry || "MM/AA"}</div>
                  </div>
                </div>
              </div>

              {/* Payment form fields */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="cardNumber">Numero carta</Label>
                  <Input
                    id="cardNumber"
                    placeholder="1234 5678 9012 3456"
                    className="mt-1.5 font-mono tracking-widest"
                    value={card.number}
                    maxLength={19}
                    onChange={(e) =>
                      setCard((c) => ({ ...c, number: formatCardNumber(e.target.value) }))
                    }
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="expiry">Scadenza</Label>
                    <Input
                      id="expiry"
                      placeholder="MM/AA"
                      className="mt-1.5 font-mono"
                      value={card.expiry}
                      maxLength={5}
                      onChange={(e) =>
                        setCard((c) => ({ ...c, expiry: formatExpiry(e.target.value) }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="cvv">CVV</Label>
                    <Input
                      id="cvv"
                      placeholder="123"
                      className="mt-1.5 font-mono"
                      value={card.cvv}
                      maxLength={4}
                      onChange={(e) =>
                        setCard((c) => ({
                          ...c,
                          cvv: e.target.value.replace(/\D/g, "").slice(0, 4),
                        }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="cardName">Nome sul carta</Label>
                  <Input
                    id="cardName"
                    placeholder="MARIO ROSSI"
                    className="mt-1.5 uppercase"
                    value={card.name}
                    onChange={(e) =>
                      setCard((c) => ({ ...c, name: e.target.value.toUpperCase() }))
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

              <div className="mt-6 space-y-3">
                <Button
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={handleStep2Submit}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                      Elaborazione in corso...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 w-4 h-4" />
                      Attiva prova gratuita — €0 oggi
                    </>
                  )}
                </Button>

                <div className="flex items-center justify-center gap-1.5 text-xs text-gray-400">
                  <Lock className="w-3 h-3" />
                  Pagamento sicuro simulato · I dati della carta non vengono inviati al server
                </div>

                <button
                  className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-1"
                  onClick={() => {
                    setStep(1);
                    setError(null);
                  }}
                >
                  ← Torna ai dati account
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Success ───────────────────────────────────────── */}
          {step === 3 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-9 h-9 text-green-500" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-2">Account creato!</h2>
              <p className="text-gray-500 mb-1">
                Benvenuto su Pippident, <strong>{account.ownerName}</strong>!
              </p>
              <p className="text-gray-500 mb-6">
                Il tuo studio <strong>&quot;{account.studioName}&quot;</strong> è pronto.
                Hai <strong>30 giorni gratuiti</strong> sul {plan.name}.
              </p>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 text-sm text-blue-700">
                Accedi con l&apos;email{" "}
                <strong>{account.email}</strong> e la password che hai scelto.
              </div>

              <Link href="/login">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                  Accedi al tuo studio
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>

              <p className="text-xs text-gray-400 mt-6">
                Non ricevi l&apos;email?{" "}
                <a href="#" className="text-blue-600 hover:underline">
                  Contattaci
                </a>
              </p>
            </div>
          )}
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
