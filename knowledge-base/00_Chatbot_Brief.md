# Pippident AI Secretary Chatbot — Project Brief

> **Cos'è questo documento:** Il brief completo della feature chatbot. Definisce cosa costruire, per chi, con quale tecnologia, e i confini. Ogni fase di implementazione parte da questo documento.

---

## 1. Obiettivo

Costruire un chatbot web accessibile da un URL pubblico (`/chat/[studioId]?phone=[phone]`) che permetta ai pazienti registrati di uno studio dentistico di interagire con un agente AI che agisce come segretaria virtuale. L'agente può:

- Prenotare appuntamenti (stato "In Attesa", il dentista conferma manualmente)
- Mostrare gli appuntamenti futuri del paziente
- Cancellare appuntamenti su richiesta
- Rispondere a domande sullo studio (orari, contatti, trattamenti disponibili)

Il paziente viene identificato automaticamente dal numero di telefono nell'URL. L'agente opera esclusivamente nel contesto dello studio specifico.

## 2. Stack Tecnologico

- **Framework:** Next.js 16 (App Router) — già in uso nel progetto Pippident
- **Frontend:** React con Tailwind CSS + shadcn/ui (già in uso)
- **Backend:** Next.js API Routes (serverless)
- **Database:** Neon PostgreSQL con Drizzle ORM (già in uso)
- **LLM:** Anthropic Claude API via Vercel AI SDK (`ai` + `@ai-sdk/anthropic`)
- **Tool calling:** Vercel AI SDK tool definitions per permettere all'agente di interagire con il DB
- **Deploy:** Vercel
- **Knowledge Base:** File `.md` statici iniettati come system prompt

## 3. Architettura

```
┌─────────────────────────────────────┐
│  PAGINA CHAT (/chat/[studioId])     │
│  React + useChat hook               │
│  Paziente identificato da ?phone=   │
└──────────────┬──────────────────────┘
               │ POST /api/chat/[studioId]
               ▼
┌─────────────────────────────────────┐
│  API ROUTE (Next.js)                │
│                                     │
│  1. Identifica paziente da phone    │
│  2. Carica system prompt + KB       │
│  3. Chiama Claude con tools         │
│  4. Claude decide se usare tools    │
│  5. Esegue tools → query DB         │
│  6. Streaming risposta al frontend  │
└──────────────┬──────────────────────┘
               │
    ┌──────────┼──────────┐
    ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐
│ getTreat│ │ getSlot│ │ book   │
│ mentType│ │ s      │ │ Appoint│
│ s       │ │        │ │ ment   │
└────────┘ └────────┘ └────────┘
    ... + listUpcoming, cancel,
          getStudioInfo
```

**Flusso per ogni messaggio:**
1. Il frontend invia messaggio + cronologia + phone del paziente
2. L'API identifica il paziente dal telefono (query DB)
3. Costruisce il contesto: system prompt + KB + info paziente
4. Chiama Claude con streaming + tool definitions
5. Se Claude invoca un tool, l'API esegue la query DB e restituisce il risultato a Claude
6. Claude genera la risposta finale in streaming al frontend

## 4. Vincoli

- **Già esiste:** Il gestionale Pippident è già costruito con DB, schema, autenticazione, dashboard
- **Singolo agente:** Non serve un sistema multi-agente. Una sola "personalità" (segretaria)
- **Accesso isolato:** L'agente accede SOLO ai dati dello studio del paziente
- **Stato "In Attesa":** Tutti gli appuntamenti creati dal chatbot hanno stato `pending`
- **Nessuna autenticazione:** Il chatbot è accessibile via URL con telefono come identificativo
- **API key:** L'API key di Anthropic va in `.env.local` come `ANTHROPIC_API_KEY`

## 5. Definizione di "Finito"

- Il paziente apre `/chat/[studioId]?phone=+39...` e vede una chat con messaggio di benvenuto personalizzato
- Il paziente può chiedere di prenotare un appuntamento e l'agente cerca slot reali dal DB
- L'appuntamento creato appare nel gestionale con stato "In Attesa" e note descrittive
- Il paziente può vedere i propri appuntamenti futuri e cancellarli
- Nel gestionale esiste una sezione "Appuntamenti In Attesa" che mostra tutti gli appuntamenti pending creati dal chatbot
- Il dentista può confermare o rifiutare gli appuntamenti dalla dashboard

## 6. Anti-Goals

- **Non serve un sistema multi-agente.** Un solo agente con un solo prompt.
- **Non serve autenticazione per il chatbot.** L'URL con il telefono è sufficiente.
- **Non serve speech-to-text o voice.** Solo testo.
- **Non serve memoria tra sessioni.** Refresh = conversazione persa.
- **Non servono pagamenti nel chatbot.** Solo prenotazioni.
- **Non serve RAG o vector store.** La KB è piccola e iniettata come testo.
- **Non serve analytics sulle conversazioni chatbot.**

## 7. Integrazione con WhatsApp Bot

Il WhatsApp bot esistente (Twilio) invia il link del chatbot ai pazienti:
- **Paziente esistente:** Riceve link `/chat/[studioId]?phone=[phone]`
- **Paziente nuovo:** Riceve link registrazione `/register/[studioId]`, dopo la registrazione viene reindirizzato al chatbot

## 8. Dashboard — Sezione "In Attesa"

Nella dashboard del gestionale, aggiungere:
- Una sezione/pagina dedicata che mostra tutti gli appuntamenti con stato `pending`
- Per ogni appuntamento: paziente, data/ora, trattamento, note dell'AI, data creazione
- Azioni: "Conferma" (→ status confirmed) e "Rifiuta" (→ status cancelled + motivo)
- Filtro opzionale: solo appuntamenti creati dal chatbot (note che iniziano con "[Chatbot AI]")
