import Link from "next/link";
import { CheckCircle, ArrowRight, Stethoscope, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { stripe } from "@/lib/stripe";
import { db, studios, users } from "@/lib/db";
import { eq } from "drizzle-orm";

async function ensureUserCreated(sessionId: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const meta = session.metadata;

    if (!meta?.email || !meta?.studioName || !meta?.passwordHash) {
      return { ok: false, error: "Dati sessione mancanti." };
    }

    const { studioName, ownerName, email, passwordHash, plan } = meta;

    // Idempotency: skip if user already exists (webhook may have already created it)
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      return { ok: true };
    }

    // Create studio + user (same logic as webhook)
    const [studio] = await db
      .insert(studios)
      .values({
        name: studioName,
        email,
        settings: { plan, stripeSubscriptionId: session.subscription as string } as never,
      })
      .onConflictDoUpdate({
        target: studios.email,
        set: { settings: { plan, stripeSubscriptionId: session.subscription as string } as never },
      })
      .returning({ id: studios.id });

    await db.insert(users).values({
      studioId: studio.id,
      email,
      passwordHash,
      fullName: ownerName ?? studioName,
      role: "admin",
    });

    console.log(`[success] Studio + user created for ${email} (plan: ${plan})`);
    return { ok: true };
  } catch (err) {
    console.error("[success] Error creating user:", err);
    return { ok: false, error: "Errore nella creazione dell'account." };
  }
}

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id } = await searchParams;

  let error: string | undefined;
  if (session_id) {
    const result = await ensureUserCreated(session_id);
    if (!result.ok) error = result.error;
  }

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

      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <div className="bg-white rounded-2xl border border-gray-200 p-10">
          {error ? (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-9 h-9 text-red-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Pagamento ricevuto
              </h1>
              <p className="text-gray-500 mb-6">
                Il pagamento è andato a buon fine, ma si è verificato un errore durante la creazione del tuo account.
                Contattaci su <strong>support@pippident.com</strong> con la ricevuta del pagamento.
              </p>
            </>
          ) : (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-9 h-9 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                Pagamento completato!
              </h1>
              <p className="text-gray-500 mb-2">
                Benvenuto su Pippident. Il tuo studio è stato attivato.
              </p>
              <p className="text-gray-500 mb-6">
                Accedi ora con le credenziali che hai scelto durante la registrazione.
              </p>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 text-sm text-blue-700">
                Hai <strong>15 giorni gratuiti</strong>. Nessun addebito fino al termine
                della prova.
              </div>
              <Link href="/login">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                  Accedi al tuo studio
                  <ArrowRight className="ml-2 w-4 h-4" />
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
