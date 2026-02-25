# Documento di Progetto Tecnico e Funzionale
## Sistema di Gestione per Studi Dentistici — **Pippident**

**Versione:** 1.0
**Data:** Febbraio 2026
**Stato:** Bozza per il Team di Sviluppo

---

## Indice

1. [Panoramica del Progetto](#1-panoramica-del-progetto)
2. [Utenti e Ruoli](#2-utenti-e-ruoli)
3. [Funzionalità Principali](#3-funzionalità-principali)
   - 3.1 Gestione Pazienti
   - 3.2 Gestione Appuntamenti e Calendario
   - 3.3 Gestione Cure e Tipi di Visita
   - 3.4 Gestione Richiami
   - 3.5 Gestione Pagamenti, Preventivi e Ricevute
   - 3.6 Portale Dentisti (Web)
   - 3.7 Canale Pazienti (WhatsApp Bot)
4. [Architettura Tecnica](#4-architettura-tecnica)
5. [Schema del Database](#5-schema-del-database)
6. [API e Integrazioni](#6-api-e-integrazioni)
7. [Requisiti Non Funzionali](#7-requisiti-non-funzionali)
8. [Flussi Principali](#8-flussi-principali)
9. [Roadmap di Sviluppo](#9-roadmap-di-sviluppo)

---

## 1. Panoramica del Progetto

**Pippident** è un sistema SaaS multi-tenant per la gestione completa degli studi dentistici. La piattaforma è progettata per semplificare il lavoro amministrativo del personale dentistico e migliorare l'esperienza dei pazienti, senza richiedere a questi ultimi di installare nessuna applicazione.

### Obiettivi

- Centralizzare la gestione di pazienti, appuntamenti, cure e pagamenti in un'unica piattaforma.
- Offrire ai dentisti un portale web professionale accessibile da browser.
- Offrire ai pazienti un canale diretto via **WhatsApp** per prenotazioni, promemoria e comunicazioni, senza necessità di scaricare app.
- Garantire la conformità al **GDPR** per la gestione dei dati sanitari.

### Modello di Business

Ogni studio dentistico è un **tenant** indipendente. Ogni tenant ha i propri pazienti, appuntamenti e dati, completamente isolati dagli altri.

---

## 2. Utenti e Ruoli

### 2.1 Ruoli nel Portale Web (Studio)

| Ruolo | Descrizione |
|---|---|
| **Super Admin** | Amministratore della piattaforma SaaS. Gestisce i tenant (studi). |
| **Admin Studio** | Titolare/responsabile dello studio. Accede a tutte le funzionalità del proprio studio. |
| **Dentista** | Visualizza e gestisce il proprio agenda, i pazienti e le cure. |
| **Segreteria** | Gestisce appuntamenti, pazienti, pagamenti e promemoria. Non accede ai dati clinici dettagliati. |

### 2.2 Paziente (canale WhatsApp)

Il paziente non ha un account nel portale web. Interagisce con lo studio esclusivamente tramite il bot WhatsApp. Il sistema identifica il paziente tramite il suo **numero di telefono**.

---

## 3. Funzionalità Principali

### 3.1 Gestione Pazienti

**Descrizione:** Archivio completo dei pazienti dello studio. Ogni paziente appartiene a un singolo studio (tenant).

**Dati Anagrafici:**
- Nome e Cognome
- Data di nascita
- Codice fiscale
- Sesso
- Indirizzo (via, città, CAP, provincia)
- Numero di telefono (usato anche per identificazione WhatsApp)
- Indirizzo email (opzionale)
- Note generali (allergie, note anamnestiche)
- Data primo accesso allo studio
- Consenso al trattamento dati (GDPR) — obbligatorio, con data firma

**Funzionalità:**
- **Inserisci paziente:** form con tutti i campi anagrafici. Validazione in tempo reale (CF, telefono, email).
- **Modifica paziente:** modifica qualunque campo anagrafico. Storico delle modifiche salvato.
- **Cancella paziente:** soft delete (il paziente viene marcato come archiviato, i dati restano nel DB per obblighi legali).
- **Ricerca e filtri:** ricerca per nome, cognome, codice fiscale, telefono. Filtri per data di nascita, ultima visita.
- **Scheda paziente:** vista unificata con anamnesi, storico appuntamenti, storico cure, storico pagamenti, richiami attivi.

---

### 3.2 Gestione Appuntamenti e Calendario

**Descrizione:** Calendario condiviso dello studio per la gestione degli appuntamenti dei pazienti con uno o più dentisti.

**Dati Appuntamento:**
- Paziente associato
- Dentista associato
- Data e ora di inizio
- Durata stimata (in minuti)
- Tipo di visita (collegato al catalogo cure — vedi §3.3)
- Stato (Confermato, In attesa di conferma, Completato, Cancellato, Non presentato)
- Note interne (non visibili al paziente)
- Promemoria inviato (flag booleano + timestamp)

**Funzionalità:**

**Prenota appuntamento:**
- Selezione paziente (ricerca per nome o telefono; se il paziente non esiste, possibilità di crearlo al volo).
- Selezione dentista e tipo di visita.
- Visualizzazione degli slot disponibili nel calendario.
- Conferma della prenotazione → il paziente riceve notifica WhatsApp automatica.

**Calendario:**
- Vista settimanale e giornaliera per dentista.
- Vista mensile per la segreteria.
- Colori differenti per stato appuntamento e per dentista.
- Drag-and-drop per spostare gli appuntamenti (con notifica automatica al paziente).
- Blocco di orari non disponibili (ferie, pause, chiusure).

**Modifica appuntamento:**
- Cambio data/ora con notifica automatica al paziente via WhatsApp.
- Cambio stato (es. da "Confermato" a "Completato").

**Cancella appuntamento:**
- Soft delete con motivo di cancellazione.
- Notifica automatica al paziente via WhatsApp.

**Regole di business:**
- Non è possibile prenotare due appuntamenti per lo stesso dentista nello stesso orario.
- La durata minima di un appuntamento è 15 minuti, in slot da 15 minuti.

---

### 3.3 Gestione Cure e Tipi di Visita

**Descrizione:** Catalogo delle cure e delle procedure che lo studio offre. Ogni cura ha un nome, una descrizione, una durata standard e un prezzo di listino.

**Dati Cura/Tipo di Visita:**
- Codice interno
- Nome (es. "Igiene Professionale", "Visita di Controllo", "Otturazione", "Impianto", "Sbiancamento")
- Descrizione
- Durata standard (in minuti)
- Prezzo di listino (può essere sovrascritto per ogni paziente/preventivo)
- Categoria (es. Conservativa, Ortodonzia, Implantologia, Igiene, Protesi)
- Attiva/Non attiva

**Storico cure per paziente:**
Ogni cura effettuata su un paziente viene registrata con:
- Riferimento al paziente
- Riferimento all'appuntamento (se la cura è avvenuta durante un appuntamento)
- Cura effettuata (dal catalogo)
- Dente/i trattato/i (schema dentale internazionale FDI)
- Note cliniche (campo libero, visibile solo ai dentisti)
- Data di esecuzione
- Dentista che ha eseguito la cura
- Stato (Pianificata, Eseguita, Sospesa)

---

### 3.4 Gestione Richiami

**Descrizione:** Sistema automatico per ricordare ai pazienti di tornare per visite di controllo o igiene periodica.

**Dati Richiamo:**
- Paziente associato
- Tipo di richiamo (es. "Igiene semestrale", "Visita di controllo annuale", "Post-impianto a 3 mesi")
- Data prevista del richiamo
- Stato (Attivo, Inviato, Completato, Ignorato)
- Data di invio promemoria
- Canale di invio (WhatsApp)
- Note

**Funzionalità:**

**Creazione richiamo:**
- Manuale dalla scheda paziente.
- Automatico al completamento di determinate cure (configurabile per tipo di cura).
  - Esempio: al completamento di una "Igiene Professionale" il sistema crea automaticamente un richiamo a 6 mesi.

**Invio promemoria:**
- Il sistema invia automaticamente un messaggio WhatsApp al paziente N giorni prima della data prevista (configurabile, default: 7 giorni prima).
- Il paziente può rispondere al messaggio per prenotare direttamente un appuntamento.
- Se il paziente non risponde entro X giorni, il sistema invia un secondo promemoria.

**Dashboard richiami:**
- Vista con tutti i richiami in scadenza (prossimi 30/60/90 giorni).
- Filtri per stato, tipo, dentista.
- Possibilità di inviare il messaggio WhatsApp manualmente da questa vista.

---

### 3.5 Gestione Pagamenti, Preventivi e Ricevute

**Descrizione:** Modulo finanziario per la gestione economica degli appuntamenti e delle cure.

#### Preventivi

**Dati Preventivo:**
- Numero preventivo (progressivo per studio)
- Paziente
- Data emissione
- Data scadenza (validità)
- Elenco voci (cura, quantità, prezzo unitario, sconto %, totale riga)
- Totale preventivo
- Stato (Bozza, Inviato al paziente, Accettato, Rifiutato, Scaduto)
- Note

**Funzionalità:**
- Creazione preventivo con selezione cure dal catalogo.
- Possibilità di applicare sconti per voce o sul totale.
- Invio al paziente via WhatsApp (link a pagina web con preview del preventivo) o email.
- Il paziente può accettare/rifiutare il preventivo rispondendo al messaggio WhatsApp.
- Conversione preventivo accettato in fattura/ricevuta.

#### Pagamenti e Ricevute

**Dati Pagamento:**
- Riferimento al paziente
- Riferimento alla cura/appuntamento (opzionale)
- Data pagamento
- Importo
- Metodo di pagamento (Contanti, Carta, Bonifico, Finanziamento)
- Note
- Riferimento ricevuta

**Funzionalità:**
- Registrazione pagamenti (totali o parziali — rateizzazione).
- Generazione ricevuta in PDF (personalizzata con logo e dati dello studio).
- Storico pagamenti per paziente con saldo residuo.
- Dashboard finanziaria: incassi del giorno/settimana/mese, preventivi in attesa, pagamenti in scadenza.

> **Nota:** La piattaforma non gestisce la fatturazione elettronica (SDI). La ricevuta generata è un documento interno di pagamento. Per la fatturazione elettronica si rimanda a integrazione futura con gestionali dedicati (es. Fatture in Cloud).

---

### 3.6 Portale Dentisti (Web)

**Descrizione:** Applicazione web accessibile da browser, costruita con Next.js, che il personale dello studio utilizza quotidianamente.

**Accesso:**
- Login con email e password.
- Recupero password via email.
- Autenticazione sicura con JWT + sessioni gestite lato server.
- Nessuna registrazione pubblica: gli account vengono creati dall'Admin Studio.

**Struttura dell'interfaccia:**

```
Sidebar navigazione:
├── Dashboard
├── Calendario
├── Pazienti
│   ├── Elenco pazienti
│   └── Scheda paziente
├── Cure
├── Richiami
├── Pagamenti
│   ├── Preventivi
│   └── Ricevute
└── Impostazioni
    ├── Profilo studio
    ├── Utenti
    ├── Catalogo cure
    └── Configurazione WhatsApp
```

**Dashboard:**
- Riepilogo appuntamenti del giorno.
- Pazienti in attesa.
- Richiami in scadenza questa settimana.
- Incasso del giorno.
- Accessi rapidi alle azioni più frequenti.

**Impostazioni Studio:**
- Nome studio, logo, indirizzo, P.IVA, contatti.
- Orari di apertura (per slot disponibili nel calendario).
- Configurazione messaggi WhatsApp automatici (testi personalizzabili per promemoria, conferme, richiami).

---

### 3.7 Canale Pazienti (WhatsApp Bot)

**Descrizione:** Interfaccia conversazionale per i pazienti tramite WhatsApp Business API. Il paziente non deve scaricare nessuna app.

**Identificazione paziente:** tramite numero di telefono. Se il numero non è presente nel sistema, il bot risponde con un messaggio generico invitando a contattare lo studio direttamente.

**Funzionalità disponibili per il paziente:**

| Comando/Azione | Descrizione |
|---|---|
| Visualizza prossimo appuntamento | Il bot risponde con data, ora e tipo di visita. |
| Conferma appuntamento | Il paziente conferma un appuntamento con un semplice messaggio. |
| Richiesta di modifica/cancellazione | Il bot raccoglie la richiesta e notifica la segreteria. |
| Visualizza preventivo | Il bot invia link a pagina web con il preventivo. |
| Accetta/Rifiuta preventivo | Risposta al messaggio del preventivo. |
| Prenota appuntamento | Flusso guidato: tipo visita → disponibilità → conferma. |

**Flusso messaggi automatici (outbound):**
- Conferma prenotazione (immediata).
- Promemoria appuntamento (configurabile: 48h prima + 2h prima).
- Notifica cambio/cancellazione appuntamento.
- Promemoria richiamo periodico.
- Invio preventivo.

**Gestione risposte paziente:**
- Il bot gestisce risposte semplici (Sì/No, scelta da menu).
- Per richieste complesse o non riconosciute, il bot risponde: *"Grazie! La vostra richiesta è stata inoltrata allo studio. Vi risponderemo al più presto."* e notifica la segreteria nel portale.

---

## 4. Architettura Tecnica

### 4.1 Stack Tecnologico

| Layer | Tecnologia | Note |
|---|---|---|
| **Frontend** | Next.js 15 (App Router) | SSR + Client Components |
| **Styling** | Tailwind CSS 4 + shadcn/ui | Design system coerente |
| **Database** | Neon DB (PostgreSQL serverless) | Multi-tenant con Row-Level Security |
| **ORM** | Drizzle ORM | Type-safe, compatibile con Neon |
| **Auth** | NextAuth.js v5 (Auth.js) | Email/password, JWT + session |
| **WhatsApp API** | Meta Cloud API (WhatsApp Business) | Webhook per messaggi in entrata |
| **Job Scheduler** | Vercel Cron Jobs | Per invio promemoria automatici |
| **Storage** | Vercel Blob / Cloudflare R2 | Logo studio, PDF ricevute |
| **Email** | Resend | Recupero password, notifiche |
| **PDF** | React-PDF / Puppeteer | Generazione ricevute e preventivi |
| **Hosting** | Vercel | Deploy Next.js nativo |

### 4.2 Struttura del Progetto Next.js

```
pippident/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── forgot-password/
│   ├── (dashboard)/
│   │   ├── layout.tsx              # Layout con sidebar
│   │   ├── page.tsx                # Dashboard
│   │   ├── calendar/
│   │   ├── patients/
│   │   │   ├── page.tsx            # Elenco pazienti
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Scheda paziente
│   │   ├── treatments/
│   │   ├── recalls/
│   │   ├── payments/
│   │   │   ├── quotes/
│   │   │   └── receipts/
│   │   └── settings/
│   └── api/
│       ├── auth/
│       ├── patients/
│       ├── appointments/
│       ├── treatments/
│       ├── recalls/
│       ├── payments/
│       ├── whatsapp/
│       │   └── webhook/            # Webhook Meta
│       └── cron/
│           ├── send-reminders/
│           └── send-recalls/
├── components/
│   ├── ui/                         # shadcn/ui components
│   ├── calendar/
│   ├── patients/
│   └── shared/
├── lib/
│   ├── db/
│   │   ├── schema.ts               # Drizzle schema
│   │   └── index.ts                # Neon connection
│   ├── whatsapp/
│   │   ├── client.ts
│   │   └── templates.ts
│   ├── auth.ts
│   └── utils.ts
└── drizzle/
    └── migrations/
```

### 4.3 Multi-Tenancy

Ogni studio è un tenant identificato da un `studio_id`. Il multi-tenancy è implementato con:

1. **Row-Level Security (RLS) su Neon DB:** Ogni query è scoped al `studio_id` dell'utente autenticato. Le policy RLS garantiscono che nessun utente possa accedere ai dati di un altro studio.
2. **Middleware Next.js:** Verifica che l'utente autenticato appartenga al tenant corretto prima di ogni richiesta alle API.

---

## 5. Schema del Database

Il database è PostgreSQL su Neon DB. Di seguito lo schema logico principale con le tabelle e i campi chiave.

### 5.1 Tabelle Principali

```sql
-- STUDI (Tenant)
studios
  id            UUID PRIMARY KEY
  name          VARCHAR(255) NOT NULL
  email         VARCHAR(255) UNIQUE NOT NULL
  phone         VARCHAR(50)
  address       TEXT
  vat_number    VARCHAR(20)
  logo_url      TEXT
  whatsapp_phone_number_id  VARCHAR(100)  -- Meta API
  whatsapp_token            TEXT
  settings      JSONB        -- Orari apertura, config messaggi
  created_at    TIMESTAMPTZ  DEFAULT NOW()
  is_active     BOOLEAN      DEFAULT TRUE

-- UTENTI (Staff dello studio)
users
  id            UUID PRIMARY KEY
  studio_id     UUID NOT NULL REFERENCES studios(id)
  email         VARCHAR(255) UNIQUE NOT NULL
  password_hash TEXT NOT NULL
  full_name     VARCHAR(255) NOT NULL
  role          VARCHAR(50)  NOT NULL  -- admin, dentist, secretary
  is_active     BOOLEAN      DEFAULT TRUE
  created_at    TIMESTAMPTZ  DEFAULT NOW()
  last_login_at TIMESTAMPTZ

-- PAZIENTI
patients
  id              UUID PRIMARY KEY
  studio_id       UUID NOT NULL REFERENCES studios(id)
  first_name      VARCHAR(100) NOT NULL
  last_name       VARCHAR(100) NOT NULL
  date_of_birth   DATE
  fiscal_code     VARCHAR(16) UNIQUE
  gender          VARCHAR(10)  -- M, F, Other
  phone           VARCHAR(50)  NOT NULL UNIQUE  -- usato per WhatsApp
  email           VARCHAR(255)
  address         TEXT
  city            VARCHAR(100)
  postal_code     VARCHAR(10)
  province        VARCHAR(5)
  notes           TEXT         -- Allergie, anamnesi generale
  gdpr_consent    BOOLEAN      DEFAULT FALSE
  gdpr_consent_date TIMESTAMPTZ
  first_visit_date DATE
  is_archived     BOOLEAN      DEFAULT FALSE
  created_at      TIMESTAMPTZ  DEFAULT NOW()
  updated_at      TIMESTAMPTZ  DEFAULT NOW()

-- CATALOGO CURE
treatment_types
  id              UUID PRIMARY KEY
  studio_id       UUID NOT NULL REFERENCES studios(id)
  code            VARCHAR(50)
  name            VARCHAR(255) NOT NULL
  description     TEXT
  category        VARCHAR(100) -- Conservativa, Igiene, Implantologia, ...
  default_duration_minutes  INT  DEFAULT 30
  list_price      DECIMAL(10,2)
  auto_recall_days INT         -- Giorni per richiamo automatico (es. 180)
  is_active       BOOLEAN      DEFAULT TRUE
  created_at      TIMESTAMPTZ  DEFAULT NOW()

-- APPUNTAMENTI
appointments
  id              UUID PRIMARY KEY
  studio_id       UUID NOT NULL REFERENCES studios(id)
  patient_id      UUID NOT NULL REFERENCES patients(id)
  dentist_id      UUID NOT NULL REFERENCES users(id)
  treatment_type_id UUID      REFERENCES treatment_types(id)
  start_time      TIMESTAMPTZ NOT NULL
  end_time        TIMESTAMPTZ NOT NULL
  status          VARCHAR(50) NOT NULL  -- confirmed, pending, completed, cancelled, no_show
  notes           TEXT        -- Note interne
  reminder_sent   BOOLEAN     DEFAULT FALSE
  reminder_sent_at TIMESTAMPTZ
  cancellation_reason TEXT
  created_by      UUID        REFERENCES users(id)
  created_at      TIMESTAMPTZ DEFAULT NOW()
  updated_at      TIMESTAMPTZ DEFAULT NOW()

-- CURE EFFETTUATE SU PAZIENTE
patient_treatments
  id              UUID PRIMARY KEY
  studio_id       UUID NOT NULL REFERENCES studios(id)
  patient_id      UUID NOT NULL REFERENCES patients(id)
  appointment_id  UUID        REFERENCES appointments(id)
  treatment_type_id UUID NOT NULL REFERENCES treatment_types(id)
  dentist_id      UUID        REFERENCES users(id)
  teeth           TEXT[]      -- Denti trattati in notazione FDI: ['11','12','21']
  clinical_notes  TEXT        -- Note cliniche (solo dentisti)
  performed_at    TIMESTAMPTZ NOT NULL
  status          VARCHAR(50) -- planned, performed, suspended
  created_at      TIMESTAMPTZ DEFAULT NOW()

-- RICHIAMI
recalls
  id              UUID PRIMARY KEY
  studio_id       UUID NOT NULL REFERENCES studios(id)
  patient_id      UUID NOT NULL REFERENCES patients(id)
  treatment_type_id UUID      REFERENCES treatment_types(id)
  recall_type     VARCHAR(100) NOT NULL  -- es. "Igiene semestrale"
  due_date        DATE NOT NULL
  status          VARCHAR(50) NOT NULL   -- active, sent, completed, ignored
  reminder_sent_at TIMESTAMPTZ
  second_reminder_sent_at TIMESTAMPTZ
  notes           TEXT
  created_automatically BOOLEAN DEFAULT FALSE
  created_at      TIMESTAMPTZ DEFAULT NOW()

-- PREVENTIVI
quotes
  id              UUID PRIMARY KEY
  studio_id       UUID NOT NULL REFERENCES studios(id)
  patient_id      UUID NOT NULL REFERENCES patients(id)
  quote_number    VARCHAR(50) NOT NULL
  issue_date      DATE NOT NULL
  expiry_date     DATE
  status          VARCHAR(50) -- draft, sent, accepted, rejected, expired
  subtotal        DECIMAL(10,2) NOT NULL
  discount_amount DECIMAL(10,2) DEFAULT 0
  total           DECIMAL(10,2) NOT NULL
  notes           TEXT
  created_by      UUID REFERENCES users(id)
  created_at      TIMESTAMPTZ DEFAULT NOW()

-- VOCI PREVENTIVO
quote_items
  id              UUID PRIMARY KEY
  quote_id        UUID NOT NULL REFERENCES quotes(id)
  treatment_type_id UUID REFERENCES treatment_types(id)
  description     VARCHAR(255) NOT NULL
  quantity        INT  DEFAULT 1
  unit_price      DECIMAL(10,2) NOT NULL
  discount_pct    DECIMAL(5,2) DEFAULT 0
  line_total      DECIMAL(10,2) NOT NULL

-- PAGAMENTI
payments
  id              UUID PRIMARY KEY
  studio_id       UUID NOT NULL REFERENCES studios(id)
  patient_id      UUID NOT NULL REFERENCES patients(id)
  quote_id        UUID REFERENCES quotes(id)
  appointment_id  UUID REFERENCES appointments(id)
  receipt_number  VARCHAR(50)
  payment_date    DATE NOT NULL
  amount          DECIMAL(10,2) NOT NULL
  payment_method  VARCHAR(50)  -- cash, card, bank_transfer, financing
  notes           TEXT
  created_by      UUID REFERENCES users(id)
  created_at      TIMESTAMPTZ  DEFAULT NOW()

-- LOG MESSAGGI WHATSAPP
whatsapp_messages
  id              UUID PRIMARY KEY
  studio_id       UUID NOT NULL REFERENCES studios(id)
  patient_id      UUID REFERENCES patients(id)
  direction       VARCHAR(10) NOT NULL  -- inbound, outbound
  message_type    VARCHAR(50)  -- reminder, recall, quote, appointment_confirm, ...
  body            TEXT
  status          VARCHAR(50)  -- sent, delivered, read, failed
  wa_message_id   VARCHAR(255) -- ID restituito da Meta API
  sent_at         TIMESTAMPTZ  DEFAULT NOW()
```

### 5.2 Indici principali

```sql
CREATE INDEX idx_patients_studio ON patients(studio_id);
CREATE INDEX idx_patients_phone ON patients(phone);
CREATE INDEX idx_appointments_studio_date ON appointments(studio_id, start_time);
CREATE INDEX idx_appointments_dentist ON appointments(dentist_id, start_time);
CREATE INDEX idx_recalls_due_date ON recalls(studio_id, due_date, status);
CREATE INDEX idx_payments_patient ON payments(patient_id);
```

---

## 6. API e Integrazioni

### 6.1 API REST Interne (Next.js Route Handlers)

Tutte le API sono sotto `/api/` e richiedono autenticazione JWT.

| Metodo | Path | Descrizione |
|---|---|---|
| POST | `/api/patients` | Crea paziente |
| GET | `/api/patients` | Lista pazienti (paginata, ricercabile) |
| GET | `/api/patients/:id` | Scheda paziente completa |
| PATCH | `/api/patients/:id` | Modifica paziente |
| DELETE | `/api/patients/:id` | Archivia paziente |
| GET | `/api/appointments` | Lista appuntamenti (filtri data, dentista) |
| POST | `/api/appointments` | Crea appuntamento |
| PATCH | `/api/appointments/:id` | Modifica appuntamento |
| DELETE | `/api/appointments/:id` | Cancella appuntamento |
| GET | `/api/treatment-types` | Catalogo cure |
| POST | `/api/treatment-types` | Crea tipo cura |
| POST | `/api/patient-treatments` | Registra cura eseguita |
| GET | `/api/recalls` | Lista richiami |
| POST | `/api/recalls` | Crea richiamo |
| PATCH | `/api/recalls/:id` | Aggiorna stato richiamo |
| GET | `/api/quotes` | Lista preventivi |
| POST | `/api/quotes` | Crea preventivo |
| PATCH | `/api/quotes/:id` | Modifica preventivo |
| POST | `/api/payments` | Registra pagamento |
| GET | `/api/payments` | Lista pagamenti |
| GET | `/api/payments/:id/receipt` | Genera PDF ricevuta |

### 6.2 WhatsApp Business API (Meta Cloud API)

**Webhook inbound:** `POST /api/whatsapp/webhook`

Il webhook riceve i messaggi dei pazienti. Il sistema:
1. Identifica il paziente tramite il numero di telefono mittente.
2. Analizza il messaggio (parsing intent: conferma, cancellazione, prenotazione, ecc.).
3. Aggiorna il DB di conseguenza.
4. Risponde con il messaggio appropriato.

**Template messaggi (outbound):**

I messaggi outbound che iniziano una conversazione richiedono l'uso di **Template pre-approvati da Meta**. I template principali da registrare su Meta:

| Template Name | Trigger | Variabili |
|---|---|---|
| `appointment_confirmation` | Nuova prenotazione | Nome paziente, Data, Ora, Dentista |
| `appointment_reminder_48h` | Cron 48h prima | Nome paziente, Data, Ora |
| `appointment_reminder_2h` | Cron 2h prima | Nome paziente, Ora |
| `appointment_cancelled` | Cancellazione | Nome paziente, Data, Ora |
| `appointment_rescheduled` | Cambio data | Nome paziente, Nuova data, Nuova ora |
| `recall_reminder` | Cron richiami | Nome paziente, Tipo richiamo |
| `quote_sent` | Invio preventivo | Nome paziente, Link preventivo |

### 6.3 Cron Jobs (Vercel Cron)

| Job | Frequenza | Azione |
|---|---|---|
| `send-appointment-reminders` | Ogni ora | Invia promemoria WhatsApp per appuntamenti nelle prossime 48h e 2h |
| `send-recalls` | Ogni giorno alle 09:00 | Invia messaggi richiamo ai pazienti con `due_date` = oggi + 7 giorni |
| `expire-quotes` | Ogni giorno alle 00:00 | Marca come "Scaduti" i preventivi oltre la data di scadenza |

---

## 7. Requisiti Non Funzionali

### 7.1 Sicurezza

- **HTTPS obbligatorio** su tutti gli endpoint.
- **Autenticazione:** JWT con refresh token. Sessioni invalidate al logout.
- **Autorizzazione:** ogni API verifica che l'utente abbia il ruolo corretto e appartenga al tenant corretto.
- **Row-Level Security su Neon:** policy a livello di DB come secondo livello di sicurezza.
- **GDPR:** i dati sanitari sono classificati come dati sensibili. Log di accesso agli audit trail. Supporto alla cancellazione (soft delete + possibilità di richiesta di oblio).
- **Validation:** tutti gli input sono validati lato server con **Zod**.
- **SQL Injection:** uso esclusivo di query parametrizzate tramite Drizzle ORM.
- **Webhook Meta:** verifica della firma HMAC-SHA256 su ogni richiesta in entrata.

### 7.2 Performance

- **Paginazione** su tutte le liste (default: 20 elementi per pagina).
- **Caching** delle query di sola lettura con `unstable_cache` di Next.js.
- **Ottimizzazione immagini** con `next/image`.
- **Database connection pooling** tramite Neon serverless driver.

### 7.3 Usabilità

- L'interfaccia è **responsive** (desktop-first, ottimizzata per tablet).
- Il design segue il sistema di componenti **shadcn/ui** per consistenza.
- Il calendario è drag-and-drop con feedback visivo immediato.
- Feedback utente con toast notifications per tutte le azioni (successo/errore).

### 7.4 Disponibilità e Disaster Recovery

- **SLA target:** 99.5% uptime.
- **Backup automatico** del DB fornito da Neon DB.
- **Monitoraggio errori:** integrazione con Sentry.

---

## 8. Flussi Principali

### 8.1 Flusso: Nuova Prenotazione dalla Segreteria

```
1. Segreteria apre "Calendario" → clicca su slot vuoto
2. Si apre modal "Nuovo Appuntamento"
3. Segreteria cerca il paziente per nome/telefono
   └── Se il paziente non esiste → mini-form inline per creare paziente
4. Seleziona dentista (pre-selezionato se la vista è per dentista)
5. Seleziona tipo di visita dal catalogo
6. Sistema aggiorna automaticamente la durata stimata
7. Segreteria conferma → POST /api/appointments
8. Sistema verifica disponibilità (no conflitti)
9. Appuntamento creato nel DB con status "confirmed"
10. Sistema invia template WhatsApp "appointment_confirmation" al paziente
11. Calendario si aggiorna con il nuovo slot
```

### 8.2 Flusso: Richiamo Automatico Post-Igiene

```
1. Dentista segna appuntamento come "Completato" e registra la cura "Igiene Professionale"
2. Sistema crea automaticamente record in `patient_treatments`
3. Sistema verifica: il treatment_type ha `auto_recall_days = 180`
4. Sistema crea record in `recalls`:
   - patient_id: X
   - recall_type: "Igiene Professionale"
   - due_date: today + 180 giorni
   - status: "active"
   - created_automatically: true
5. Il cron `send-recalls` viene eseguito ogni giorno
6. 7 giorni prima del `due_date`, il cron trova il richiamo
7. Cron invia template WhatsApp "recall_reminder" al paziente
8. Recall aggiornato: status → "sent", reminder_sent_at → now()
9. Il paziente risponde "Sì" sul WhatsApp
10. Webhook inbound riceve il messaggio
11. Sistema crea appuntamento bozza e notifica la segreteria nel portale
```

### 8.3 Flusso: Preventivo e Pagamento

```
1. Dentista/Segreteria apre scheda paziente → "Nuovo Preventivo"
2. Aggiunge voci dal catalogo cure con prezzi e sconti
3. Salva preventivo (status: "draft")
4. Clicca "Invia al paziente"
5. Sistema genera link univoco al preventivo (pagina pubblica, senza login)
6. Sistema invia template WhatsApp "quote_sent" con il link
7. Paziente visualizza il preventivo nel browser (pagina leggera, solo lettura)
8. Paziente risponde "Accetto" su WhatsApp
9. Webhook riceve risposta → preventivo aggiornato status: "accepted"
10. Segreteria vede notifica nel portale → registra pagamento
11. Sistema genera ricevuta PDF numerata
12. PDF salvato su storage; link inviato al paziente via WhatsApp
```

---

## 9. Roadmap di Sviluppo

### Fase 1 — MVP (Mesi 1-2)
- [x] Setup progetto Next.js + Neon DB + Drizzle + Auth
- [ ] Gestione pazienti (CRUD completo)
- [ ] Catalogo cure
- [ ] Calendario appuntamenti (base, senza drag-and-drop)
- [ ] Dashboard base
- [ ] Deploy su Vercel

### Fase 2 — Core Features (Mesi 3-4)
- [ ] Storico cure per paziente
- [ ] Sistema richiami (manuale)
- [ ] Preventivi e pagamenti
- [ ] Generazione PDF ricevute
- [ ] Integrazione WhatsApp: conferma appuntamento + promemoria

### Fase 3 — Automazione (Mesi 5-6)
- [ ] Cron jobs per promemoria automatici
- [ ] Richiami automatici post-cura
- [ ] Bot WhatsApp: prenotazione guidata
- [ ] Bot WhatsApp: accettazione preventivi
- [ ] Calendario con drag-and-drop
- [ ] Dashboard finanziaria

### Fase 4 — Ottimizzazione e Scale (Mesi 7-8)
- [ ] Multi-studio (tenant) completo
- [ ] Ruoli e permessi granulari
- [ ] Notifiche email come canale alternativo
- [ ] Report e statistiche avanzate
- [ ] Onboarding guidato per nuovi studi
- [ ] Integrazione Fatture in Cloud (fatturazione elettronica)

---

*Documento redatto per il team di sviluppo interno. Revisioni successive da concordare con il product owner.*
