"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Stethoscope, Loader2, AlertCircle, CheckCircle, Lock } from "lucide-react";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) {
      setError("Le password non coincidono.");
      return;
    }
    if (newPassword.length < 8) {
      setError("La password deve avere almeno 8 caratteri.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Errore. Riprova.");
        setLoading(false);
        return;
      }

      setDone(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError("Errore di rete. Riprova.");
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <p className="text-red-600 text-sm">Link non valido.</p>
        <Link href="/forgot-password" className="text-blue-600 hover:underline text-sm mt-2 inline-block">
          Richiedi un nuovo link
        </Link>
      </div>
    );
  }

  return (
    <>
      {done ? (
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center">
              <CheckCircle className="w-7 h-7 text-green-600" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Password aggiornata!</h1>
          <p className="text-sm text-gray-500">Verrai reindirizzato al login tra pochi secondi...</p>
        </div>
      ) : (
        <>
          <div className="flex justify-center mb-5">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center">
              <Lock className="w-7 h-7 text-blue-600" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900 text-center mb-2">Nuova password</h1>
          <p className="text-sm text-gray-500 text-center mb-6">
            Scegli una nuova password per il tuo account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="newPassword">Nuova password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Minimo 8 caratteri"
                className="mt-1.5"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="confirm">Conferma password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Ripeti la password"
                className="mt-1.5"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              disabled={loading}
            >
              {loading ? (
                <><Loader2 className="mr-2 w-4 h-4 animate-spin" /> Salvataggio...</>
              ) : (
                "Salva nuova password"
              )}
            </Button>
          </form>
        </>
      )}
    </>
  );
}

export default function ResetPasswordPage() {
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
          <Suspense fallback={<Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600" />}>
            <ResetPasswordContent />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
