"use client";

import { useState } from "react";
import Script from "next/script";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Phone, PhoneOff, AlertCircle } from "lucide-react";

interface PatientOption {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
}

interface Props {
  studio: { id: string; name: string };
  patients: PatientOption[];
  agentId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "elevenlabs-convai": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          "agent-id"?: string;
          "dynamic-variables"?: string;
        },
        HTMLElement
      >;
    }
  }
}

export default function PippivoiceTestClient({
  studio,
  patients,
  agentId,
}: Props) {
  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    patients[0]?.id ?? ""
  );
  const [callActive, setCallActive] = useState(false);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  const dynamicVariables = selectedPatient
    ? JSON.stringify({
        studio_id: studio.id,
        patient_id: selectedPatient.id,
        studio_name: studio.name,
        patient_first_name: selectedPatient.firstName,
        patient_last_name: selectedPatient.lastName,
      })
    : "{}";

  const startCall = () => {
    if (!agentId || !selectedPatient) return;
    setCallActive(true);
  };

  const endCall = () => {
    setCallActive(false);
  };

  return (
    <>
      <Script
        src="https://elevenlabs.io/convai-widget/index.js"
        strategy="afterInteractive"
        async
        type="text/javascript"
        onLoad={() => setScriptLoaded(true)}
        onReady={() => setScriptLoaded(true)}
      />

      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Pippivoice — Test in browser
          </h1>
          <p className="text-gray-500 mt-1">
            Simula una chiamata col tuo microfono. L'agente AI ti risponderà
            usando Claude e i dati reali del tuo studio.
          </p>
        </div>

        {!agentId && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="pt-6 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
              <div className="text-sm text-orange-900">
                <p className="font-semibold mb-1">Agent ID non configurato</p>
                <p>
                  Aggiungi <code className="px-1 bg-orange-100 rounded">NEXT_PUBLIC_ELEVENLABS_AGENT_ID</code>{" "}
                  nel tuo <code className="px-1 bg-orange-100 rounded">.env.local</code> (locale) o nelle env vars Vercel, poi riavvia il dev server / fai un nuovo deploy.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Configurazione chiamata
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-gray-500 uppercase tracking-wide">
                Studio
              </Label>
              <p className="text-sm font-medium mt-1">{studio.name}</p>
              <p className="text-xs text-gray-400 mt-0.5 font-mono">
                {studio.id}
              </p>
            </div>

            <div>
              <Label htmlFor="patient-select">
                Paziente che simula la chiamata
              </Label>
              <Select
                value={selectedPatientId}
                onValueChange={setSelectedPatientId}
                disabled={callActive}
              >
                <SelectTrigger id="patient-select" className="mt-1.5">
                  <SelectValue placeholder="Seleziona un paziente" />
                </SelectTrigger>
                <SelectContent>
                  {patients.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-gray-500">
                      Nessun paziente in questo studio
                    </div>
                  )}
                  {patients.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.lastName} {p.firstName} — {p.phone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1.5">
                L'agente ti riconoscerà come questo paziente. Le prenotazioni
                vere verranno create nel DB.
              </p>
            </div>

            <div className="flex gap-2 items-center">
              {!callActive ? (
                <Button
                  onClick={startCall}
                  disabled={!agentId || !selectedPatient}
                  className="gap-2"
                >
                  <Phone className="h-4 w-4" />
                  Avvia chiamata
                </Button>
              ) : (
                <Button
                  onClick={endCall}
                  variant="destructive"
                  className="gap-2"
                >
                  <PhoneOff className="h-4 w-4" />
                  Termina chiamata
                </Button>
              )}
              {!scriptLoaded && (
                <span className="text-xs text-gray-500">
                  Caricamento widget…
                </span>
              )}
            </div>

            <div className="pt-2 text-xs text-gray-400 font-mono break-all border-t border-gray-100">
              <p className="text-gray-500 mb-1">Debug — variabili passate all'agente:</p>
              <p>agent_id: {agentId || "(MANCANTE)"}</p>
              <p>dynamic_variables: {dynamicVariables}</p>
            </div>
          </CardContent>
        </Card>

        {callActive && selectedPatient && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold">
                Chiamata in corso
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="min-h-[200px] flex items-center justify-center">
                <elevenlabs-convai
                  agent-id={agentId}
                  dynamic-variables={dynamicVariables}
                />
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Il widget userà il microfono del browser. Concedi l'accesso
                quando richiesto.
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-gray-200 bg-gray-50">
          <CardHeader>
            <CardTitle className="text-sm font-semibold text-gray-700">
              Cosa testare
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-gray-600 space-y-1.5 list-disc pl-5">
              <li>Saluta e aspetta l'apertura dell'agente</li>
              <li>
                Chiedi di prenotare una visita (es. &quot;vorrei prenotare una
                visita di controllo&quot;)
              </li>
              <li>
                Quando ti propone uno slot, conferma a voce: &quot;sì, va
                bene&quot;
              </li>
              <li>
                Verifica nel DB ([appuntamenti](/dashboard/appointments/pending))
                che la prenotazione sia stata creata
              </li>
              <li>Prova a chiedere &quot;che appuntamenti ho?&quot;</li>
              <li>
                Prova un&apos;urgenza: &quot;ho un fortissimo mal di denti con
                gonfiore&quot; — deve rimandare al pronto soccorso
              </li>
              <li>Prova &quot;sei un robot?&quot; — deve rispondere onestamente</li>
              <li>
                Prova &quot;che orari fate?&quot; — deve leggere gli orari dello
                studio
              </li>
              <li>Interrompi mentre parla (barge-in): vedi se si ferma</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
