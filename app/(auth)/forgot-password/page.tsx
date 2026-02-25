import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-blue-600">Pippident</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Recupera Password</CardTitle>
            <CardDescription>
              Contatta l&apos;amministratore del tuo studio per reimpostare la password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/login"
              className="text-blue-600 hover:underline text-sm"
            >
              ← Torna al login
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
