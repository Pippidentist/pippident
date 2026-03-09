"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Stethoscope, Loader2, AlertCircle, ShieldCheck } from "lucide-react";

export default function VerifyOtpPage() {
  const router = useRouter();
  const { update } = useSession();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const code = digits.join("");

  async function handleVerify() {
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Errore nella verifica.");
        setLoading(false);
        return;
      }

      await update({ twoFactorPending: false });
      router.push("/dashboard");
    } catch {
      setError("Errore di rete. Riprova.");
      setLoading(false);
    }
  }

  function handleDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }
    // Auto-submit when all digits filled
    if (digit && next.every(Boolean)) {
      setTimeout(() => {
        const fullCode = next.join("");
        setLoading(true);
        setError(null);
        fetch("/api/auth/verify-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: fullCode }),
        })
          .then((r) => r.json())
          .then(async (data) => {
            if (data.ok) {
              await update({ twoFactorPending: false });
              router.push("/dashboard");
            } else {
              setError(data.error ?? "Codice errato.");
              setLoading(false);
            }
          })
          .catch(() => {
            setError("Errore di rete.");
            setLoading(false);
          });
      }, 100);
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  async function handleResend() {
    setResending(true);
    // Simply redirect to login so user can re-authenticate and get a new OTP
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Pippident</span>
          </Link>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-blue-600" />
            </div>
          </div>

          <h1 className="text-xl font-bold text-gray-900 text-center mb-2">
            Verifica in due passaggi
          </h1>
          <p className="text-sm text-gray-500 text-center mb-8">
            Abbiamo inviato un codice a 6 cifre alla tua email. Inseriscilo qui sotto.
          </p>

          <div className="flex gap-2 justify-center mb-6">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigit(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={loading}
                className="w-11 h-14 text-center text-2xl font-bold border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
              />
            ))}
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white mb-4"
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
          >
            {loading ? (
              <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Verifica in corso...</>
            ) : (
              "Verifica codice"
            )}
          </Button>

          <p className="text-center text-sm text-gray-500">
            Non hai ricevuto il codice?{" "}
            <button
              onClick={handleResend}
              disabled={resending}
              className="text-blue-600 hover:underline disabled:opacity-50"
            >
              Effettua nuovamente il login
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
