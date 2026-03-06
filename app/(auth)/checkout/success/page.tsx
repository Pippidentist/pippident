import Link from "next/link";
import { CheckCircle, ArrowRight, Stethoscope } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutSuccessPage() {
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
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-9 h-9 text-green-500" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Pagamento completato!
          </h1>
          <p className="text-gray-500 mb-2">
            Benvenuto su Pippident. Il tuo studio è in fase di attivazione.
          </p>
          <p className="text-gray-500 mb-6">
            Riceverai un&apos;email di conferma a breve. Puoi accedere subito con le
            credenziali che hai scelto.
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
        </div>
      </div>
    </div>
  );
}
