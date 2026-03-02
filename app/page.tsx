import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Users,
  Stethoscope,
  Bell,
  CreditCard,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  Shield,
  Zap,
  TrendingUp,
  Phone,
} from "lucide-react";

const features = [
  {
    icon: Users,
    title: "Gestione Pazienti",
    description:
      "Anagrafica completa con storico cure, pagamenti e richiami. Ricerca rapida per nome, telefono o codice fiscale.",
  },
  {
    icon: Calendar,
    title: "Calendario Intelligente",
    description:
      "Vista giornaliera, settimanale e mensile. Drag-and-drop per spostare appuntamenti con notifica automatica al paziente.",
  },
  {
    icon: Stethoscope,
    title: "Catalogo Cure",
    description:
      "Registra le cure effettuate per dente (schema FDI). Crea preventivi dal catalogo in pochi click.",
  },
  {
    icon: Bell,
    title: "Richiami Automatici",
    description:
      "Il sistema ricorda ai pazienti le visite periodiche via WhatsApp. Nessun paziente dimenticato.",
  },
  {
    icon: CreditCard,
    title: "Preventivi e Pagamenti",
    description:
      "Genera preventivi, inviali al paziente via WhatsApp e traccia i pagamenti. Ricevute PDF in un click.",
  },
  {
    icon: MessageSquare,
    title: "Bot WhatsApp",
    description:
      "I pazienti prenotano, confermano e ricevono promemoria direttamente su WhatsApp. Zero app da scaricare.",
  },
];

const plans = [
  {
    name: "Essenziale",
    price: "99",
    description: "Per 1 studio odontoiatrico",
    features: [
      "Gestione pazienti illimitata",
      "Calendario appuntamenti",
      "Catalogo cure e storico clinico",
      "Preventivi e pagamenti",
      "Supporto via email",
    ],
    cta: "Inizia gratis",
    highlighted: false,
  },
  {
    name: "Completo",
    price: "199",
    description: "Per 1 studio odontoiatrico",
    features: [
      "Tutto il piano Essenziale",
      "Bot WhatsApp integrato",
      "Promemoria appuntamenti via WhatsApp",
      "Richiami automatici via WhatsApp",
      "Prenotazioni pazienti via WhatsApp",
      "Supporto prioritario",
    ],
    cta: "Inizia gratis",
    highlighted: true,
  },
];

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-white">
      {/* ── Navbar ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Pippident</span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-sm text-gray-600">
            <a href="#funzionalita" className="hover:text-gray-900 transition-colors">
              Funzionalità
            </a>
            <a href="#prezzi" className="hover:text-gray-900 transition-colors">
              Prezzi
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Accedi
              </Button>
            </Link>
            <a href="#prezzi">
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                Prova gratis
              </Button>
            </a>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="pt-20 pb-24 px-6 text-center bg-gradient-to-b from-blue-50 to-white">
        <div className="max-w-4xl mx-auto">
          <Badge className="mb-6 bg-blue-100 text-blue-700 hover:bg-blue-100 border-0">
            Pensato per i dentisti italiani
          </Badge>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            La gestione del tuo studio,{" "}
            <span className="text-blue-600">finalmente semplice</span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Pippident centralizza pazienti, appuntamenti, cure e pagamenti in un&apos;unica piattaforma.
            I tuoi pazienti comunicano via WhatsApp — senza scaricare nessuna app.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="#prezzi">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white text-base px-8">
                Inizia la prova gratuita
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </a>
            <Link href="/login">
              <Button size="lg" variant="outline" className="text-base px-8">
                Accedi al tuo studio
              </Button>
            </Link>
          </div>
          <p className="mt-6 text-sm text-gray-400">30 giorni gratuiti · Nessuna carta richiesta</p>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────── */}
      <section className="py-12 border-y border-gray-100 bg-gray-50">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "98%", label: "Studi soddisfatti" },
            { value: "−30%", label: "Riduzione no-show" },
            { value: "4h", label: "Risparmiate a settimana" },
            { value: "GDPR", label: "Conforme" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-3xl font-bold text-blue-600">{stat.value}</div>
              <div className="text-sm text-gray-500 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────── */}
      <section id="funzionalita" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Tutto ciò di cui hai bisogno, in un&apos;unica piattaforma
            </h2>
            <p className="text-xl text-gray-500 max-w-2xl mx-auto">
              Smetti di usare fogli Excel e agende cartacee. Pippident fa il lavoro pesante per te.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="p-6 rounded-2xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all group"
              >
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mb-5 group-hover:bg-blue-100 transition-colors">
                  <feature.icon className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WhatsApp highlight ───────────────────────────────────── */}
      <section className="py-20 px-6 bg-gradient-to-br from-green-50 to-emerald-50">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-12 items-center">
          <div className="flex-1">
            <Badge className="mb-4 bg-green-100 text-green-700 border-0">WhatsApp integrato</Badge>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              I tuoi pazienti usano già WhatsApp. Pippident anche.
            </h2>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Il bot WhatsApp di Pippident invia promemoria automatici, gestisce le conferme e permette
              ai pazienti di prenotare direttamente dal telefono — senza scaricare nessuna app.
            </p>
            <ul className="space-y-3">
              {[
                "Conferma appuntamenti con un semplice messaggio",
                "Promemoria automatici 48h e 2h prima",
                "Richiami periodici per igiene e controlli",
                "Invio preventivi con link dedicato",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3 text-gray-700">
                  <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                  <span className="text-sm">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Mock chat */}
          <div className="flex-1 flex justify-center">
            <div className="bg-white rounded-2xl shadow-lg p-6 max-w-xs w-full border border-gray-100">
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <Phone className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-semibold text-sm text-gray-900">Studio Dentistico</div>
                  <div className="text-xs text-gray-400">WhatsApp Business</div>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-700 max-w-[85%]">
                  Ciao Marco! 👋 Ti ricordiamo l&apos;appuntamento di domani alle 10:30 con la
                  Dott.ssa Bianchi. Confermi?
                </div>
                <div className="bg-green-500 rounded-lg p-3 text-sm text-white ml-auto max-w-[70%]">
                  Sì, confermo! Grazie
                </div>
                <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-700 max-w-[85%]">
                  Perfetto! Ti aspettiamo domani. A presto! 😊
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ──────────────────────────────────────────────── */}
      <section id="prezzi" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Piani semplici e trasparenti</h2>
            <p className="text-gray-500 text-lg">Nessun costo nascosto. Disdici quando vuoi.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl p-8 flex flex-col ${
                  plan.highlighted
                    ? "bg-blue-600 text-white shadow-xl"
                    : "bg-white border border-gray-200"
                }`}
              >
                {plan.highlighted && (
                  <Badge className="self-start mb-4 bg-white/20 text-white border-0 hover:bg-white/20 text-xs">
                    Più scelto
                  </Badge>
                )}
                <h3
                  className={`text-xl font-bold mb-1 ${
                    plan.highlighted ? "text-white" : "text-gray-900"
                  }`}
                >
                  {plan.name}
                </h3>
                <p
                  className={`text-sm mb-6 ${
                    plan.highlighted ? "text-blue-100" : "text-gray-500"
                  }`}
                >
                  {plan.description}
                </p>
                <div className="mb-8">
                  <span
                    className={`text-5xl font-bold ${
                      plan.highlighted ? "text-white" : "text-gray-900"
                    }`}
                  >
                    €{plan.price}
                  </span>
                  <span
                    className={`text-sm ml-1 ${
                      plan.highlighted ? "text-blue-100" : "text-gray-500"
                    }`}
                  >
                    /mese
                  </span>
                </div>

                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle
                        className={`w-4 h-4 shrink-0 ${
                          plan.highlighted ? "text-blue-200" : "text-green-500"
                        }`}
                      />
                      <span className={plan.highlighted ? "text-blue-100" : "text-gray-600"}>
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                <Link href={`/checkout?plan=${plan.name.toLowerCase()}`}>
                  <Button
                    className={`w-full ${
                      plan.highlighted
                        ? "bg-white text-blue-600 hover:bg-blue-50"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>

          <p className="text-center text-sm text-gray-400 mt-10">
            Tutti i piani includono 30 giorni di prova gratuita. Puoi aggiornare o cancellare in
            qualsiasi momento.
          </p>
        </div>
      </section>

      {/* ── Trust ────────────────────────────────────────────────── */}
      <section className="py-16 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Progettato con la sicurezza al centro
          </h2>
          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                icon: Shield,
                title: "GDPR Compliant",
                desc: "I dati sanitari dei pazienti sono protetti secondo la normativa europea.",
              },
              {
                icon: Zap,
                title: "99.5% Uptime",
                desc: "Infrastruttura su Vercel + Neon DB con backup automatici giornalieri.",
              },
              {
                icon: TrendingUp,
                title: "Multi-tenant",
                desc: "I dati del tuo studio sono completamente isolati dagli altri studi.",
              },
            ].map((item) => (
              <div key={item.title} className="bg-white p-6 rounded-xl border border-gray-100">
                <item.icon className="w-8 h-8 text-blue-600 mb-3 mx-auto" />
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────── */}
      <section className="py-20 px-6 bg-blue-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Pronto a modernizzare il tuo studio?
          </h2>
          <p className="text-blue-100 mb-8 text-lg">
            Inizia oggi con 30 giorni gratuiti. Nessuna carta di credito richiesta.
          </p>
          <a href="#prezzi">
            <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 text-base px-8">
              Inizia gratis ora
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </a>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="py-12 px-6 bg-gray-900 text-gray-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold">Pippident</span>
          </div>
          <p className="text-sm">© 2026 Pippident. Tutti i diritti riservati.</p>
          <div className="flex gap-6 text-sm">
            <a href="#" className="hover:text-white transition-colors">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-white transition-colors">
              Termini di Servizio
            </a>
            <Link href="/login" className="hover:text-white transition-colors">
              Accedi
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
