# Pippivoice — Integrazione Telefonica & Problemi Noti

> Documento operativo di setup e rischi. Per il comportamento dell'agente AI vedi [knowledge-base.md](knowledge-base.md).

---

## Architettura scelta

Il paziente compone sempre **il numero pubblico dello studio** (fisso o mobile esistente). Twilio è infrastruttura invisibile a paziente e studio.

```
Paziente
   │ chiama il numero dello studio
   ▼
Numero dello studio (fisso o mobile esistente)
   │
   ├── Libero + qualcuno risponde → conversazione umana normale
   │
   ├── Occupato (CFB) ────────────┐
   ├── Non risponde (CFNR) ───────┤
   └── Fuori orario (CFU manuale) ┤
                                  ▼
                          DID Twilio italiano geografico
                                  │
                                  ▼
                          Webhook Pippivoice
                          (TwiML <Connect><ConversationRelay>)
                                  │
                                  ▼
                          Agente AI: Claude Sonnet 4.6
                          + ElevenLabs TTS (voce italiana)
                          + Deepgram STT (italiano)
                          + Knowledge Base + Dati studio
                          + Tool calls (getTreatments, checkAvailability,
                            createBooking, getMyAppointments, cancelBooking)
```

**Modello**: `claude-sonnet-4-6` come cervello dell'agente, con `knowledge-base.md` iniettata come system prompt + dati studio dal DB (orari, indirizzo, telefoni, email, pronto soccorso di riferimento).

---

## Codici MMI da configurare sul telefono dello studio

Standard ETSI Supplementary Services. Funzionano su qualunque operatore italiano (TIM, Vodafone, Fastweb, WindTre, Iliad, ecc.), sia su fisso che su mobile.

| Codice | Funzione | Quando |
|---|---|---|
| `##002#` | Disattiva TUTTE le deviazioni esistenti (incluse segreterie operatore) | Una volta, all'inizio dell'onboarding |
| `*67*[numeroTwilio]#` | CFB — deviazione se occupato | Una volta, in onboarding |
| `*61*[numeroTwilio]#` | CFNR — deviazione se non risponde (15-25 sec) | Una volta, in onboarding |
| `*61*[numeroTwilio]**25#` | CFNR con tempo personalizzato (qui 25 sec) | Una volta, se l'operatore lo permette |
| `*21*[numeroTwilio]#` | CFU — deviazione incondizionata | Ogni chiusura giornaliera dello studio |
| `##21#` | Disattiva CFU | Ogni riapertura giornaliera dello studio |
| `*#67#` / `*#61#` / `*#21#` | Verifica stato deviazione | Per debugging |

---

## Procedura "chiusura/apertura studio"

Non usare il trucco "staccare la cornetta" — su linee VoIP moderne genera comportamenti imprevedibili (chiamata in attesa, segreteria operatore, ecc.) anziché "occupato".

**Procedura corretta**:
1. Alla **chiusura dello studio**: chi chiude preme un tasto di chiamata rapida del cordless precaricato con `*21*[numeroTwilio]#`. Si sente un tono di conferma. Tutte le chiamate da questo momento vanno direttamente all'AI.
2. Alla **riapertura dello studio**: stesso tasto rapido o secondo tasto precaricato con `##21#`. Si sente tono di conferma. Le chiamate tornano a squillare normalmente sul fisso, con i fallback CFB/CFNR sempre attivi sotto.

La maggior parte dei cordless Gigaset e Panasonic ha 5-10 tasti rapidi programmabili. Su smartphone si crea un contatto col codice MMI come "numero" (e widget homescreen su Android, contatto preferito su iPhone).

---

## Checklist onboarding (5-7 minuti per studio)

1. Chiedere: **"il vostro telefono è collegato direttamente al router o passa per un centralino?"** — se centralino, percorso separato (vedi problema noto #3 Onboarding).
2. Digitare `##002#` per cancellare tutte le deviazioni preesistenti (incluse le segreterie operatore tipo Memotel TIM).
3. Disattivare la **segreteria integrata del cordless** dal menu del telefono.
4. Digitare `*67*[numeroTwilio]#` (occupato → AI).
5. Digitare `*61*[numeroTwilio]**25#` (no reply 25 sec → AI). Se l'operatore rifiuta il tempo, fallback a `*61*[numeroTwilio]#`.
6. Programmare il tasto rapido di chiusura con `*21*[numeroTwilio]#` e il tasto rapido di apertura con `##21#`.
7. **Test reale 1**: chiamare il fisso dello studio da un cellulare esterno, lasciare squillare a vuoto → deve rispondere l'AI dopo ~25 sec.
8. **Test reale 2**: con il fisso già occupato da una telefonata, chiamare da un secondo numero → deve rispondere l'AI immediatamente.
9. **Test reale 3**: attivare CFU con il tasto rapido, chiamare → l'AI deve rispondere subito senza squilli a vuoto. Disattivare CFU con l'altro tasto.

Se tutti e tre i test passano, l'onboarding è chiuso.

---

## Problemi noti — Onboarding (rischi di setup)

### 1. Segreteria operatore preinstallata (Memotel TIM, Voicemail Vodafone, ecc.)
Molti operatori hanno una segreteria di rete attiva di default che intercetta il "non risponde" **prima** che scatti CFNR. Risultato: la chiamata va alla segreteria operatore invece che all'AI.
**Fix**: digitare `##002#` come **prima** operazione dell'onboarding.

### 2. Segreteria del cordless
Gigaset/Panasonic con segreteria integrata partono dopo 4-5 squilli (~15 sec), spesso prima del CFNR carrier (~20 sec). L'AI non parte mai.
**Fix**: disabilitare segreteria del cordless dal menu del telefono in onboarding.

### 3. Centralino virtuale preesistente
Se lo studio ha già un PBX (Asterisk, 3CX, Centralino Pronto Vodafone, Office Smart WindTre, IAFY TIM), i codici MMI digitati dal telefono vengono intercettati dal PBX e non escono verso il carrier.
**Fix**: percorso di onboarding separato — la deviazione va configurata nel pannello del PBX. Richiede credenziali. Stima studi colpiti: <10%, tipicamente studi medio-grandi multi-poltrona.

### 4. Costo della deviazione
Quando scatta il forward, lo studio paga la chiamata dal suo numero al DID Twilio, alla tariffa del suo contratto. Su flat business verso fissi italiani: 0€. Su contratto a consumo: ~€0.02-0.05/min.
**Fix**: usare DID Twilio **geografico italiano** (+39 con prefisso di città). Mai non-geografici (800, 199) o internazionali — costerebbero molto di più.

### 5. Tempo di squillo prima del CFNR
Il "no reply" carrier scatta dopo un tempo prefissato (15-25 sec), non sempre configurabile dal cliente. Se chi è in studio risponde "lentamente", la chiamata può finire all'AI prima.
**Fix**: provare `*61*[numero]**25#` o `**30#` per allungare. Se l'operatore rifiuta, accettare il default.

---

## Problemi noti — Produzione (rischi runtime)

### Critici (da risolvere prima del primo cliente reale)

#### 1. Caller ID che si perde nel forwarding
Alcuni operatori italiani **non passano il numero del chiamante originale** quando deviano: Twilio riceve il numero dello studio anziché quello del paziente. Si perde la capacità di riconoscere il paziente nel DB.
**Mitigazione**: testare in onboarding (chiamata da numero esterno, verificare che Twilio veda il numero corretto). Se l'operatore non lo passa, disabilitare la feature "riconoscimento paziente" per quello studio.

#### 2. Disclosure GDPR + AI Act art. 50
- **GDPR**: registrazione e trascrizione vocale sono trattamento dati. I dati sanitari (triage sintomi) sono **categoria speciale ex Art. 9** → consenso esplicito obbligatorio.
- **AI Act art. 50** (in vigore da feb 2026): disclosure proattiva che l'interlocutore è un sistema AI.
- **Anthropic / Deepgram / ElevenLabs in US**: serve DPA + Standard Contractual Clauses per trasferimento extra-UE.

**Mitigazione**:
- Frase di apertura modificata: "Studio Dentistico Rossi, buongiorno. La informo che sta parlando con un assistente vocale automatico e che la chiamata può essere registrata per finalità di prenotazione. Come posso aiutarla?"
- Aggiornamento della privacy policy dello studio (Pippident fornisce template).
- Firma DPA + SCC con i fornitori.

#### 3. Latenza dell'agente vocale
Pipeline tipica: STT (~200ms) → Claude (1.5-3s) → TTS (~400ms) = 2-4 secondi di silenzio. Al telefono percepiti come "linea caduta", il paziente dice "pronto? pronto?".
**Mitigazione**:
- Twilio ConversationRelay (gestisce streaming e barge-in nativamente).
- Prompt caching aggressivo su Anthropic (KB e dati studio cachati) → 700-1500ms.
- Filler audio pre-generati ("Un momento…", "Vediamo…") riprodotti durante il pensiero.
- Haiku 4.5 per turni semplici (saluti, conferme), Sonnet 4.6 solo per flussi complessi (prenotazione, triage).

#### 4. STT italiano su anziani e accenti regionali
Il target dentistico è 70% over-50, molti over-70. Voci sottili, dialetti, telefono in altoparlante. Date e numeri telefonici sono i punti più fragili. Tasso di abbandono atteso significativo per pazienti anziani.
**Mitigazione**:
- KB già impone "scandisci lettera per lettera" e "ripeti a coppie di cifre" — bene.
- Misurare dalla settimana 1: % chiamate concluse senza azione utile, per fascia oraria (proxy età paziente).
- Provider STT con modello italiano specializzato (Deepgram Nova-3 IT, valutare alternative).

#### 5. Fallback quando una dipendenza è giù
Anthropic, Twilio, ElevenLabs, Deepgram. Quattro fornitori esterni — prima o poi uno cade. Senza fallback la chiamata muore.
**Mitigazione minima**: TwiML fallback con messaggio pre-registrato ("Lo studio è momentaneamente non raggiungibile, la richiamiamo appena possibile. Le chiediamo di lasciare un breve messaggio dopo il segnale") + voicemail inviato via mail allo studio.

#### 6. Costo per chiamata + spam
Stima per chiamata di 3 minuti:
- Twilio inbound IT: ~€0.03
- Deepgram STT: ~€0.02
- ElevenLabs TTS: ~€0.20
- Anthropic Sonnet 4.6 (5k token input cached + 1k output): ~€0.03
- **Totale: ~€0.28 per chiamata**

Più costo forwarding pagato dallo studio (~€0.05-0.15 su contratto a consumo).

**Spam**: uno studio italiano riceve 5-15 chiamate commerciali/giorno. Se l'AI le gestisce come pazienti reali → **€1.50-4.50/giorno bruciati**, ~€100/mese per niente.

**Mitigazione**: detection nei primi 5-10 secondi se è commerciale (parole chiave: "energia", "telefonia", "investimento", "fotovoltaico", "TIM Business", "operatore commerciale"…) → chiusura immediata con frase neutra.

---

### Operativi (da risolvere entro i primi 50 clienti)

#### 7. Verifica identità per cancellazioni
Chi garantisce che chi chiama per cancellare l'appuntamento di "Mario Rossi" sia davvero Mario Rossi? Una cancellazione sbagliata è un disastro PR.
**Mitigazione**: politica di 2 fattori obbligatori per cancellazione (nome completo + data nascita, oppure nome + telefono di registrazione). Senza, l'AI dirotta allo studio.

#### 8. Conflitto di scrittura sul calendario
Pippibot (WhatsApp) + Pippivoice (telefono) + dentista manuale → race condition su slot.
**Mitigazione**: lock pessimistico sullo slot durante il flusso vocale (pre-riservato per 60 sec), oppure transazione DB con check di disponibilità al `createBooking` e gestione del conflitto con scuse al paziente.

#### 9. Triage che sbaglia (eccesso o difetto)
- Eccesso: leggero fastidio → slot urgenza, sottrae spazio a urgenze vere.
- Difetto: ascesso vero → visita controllo tra 3 settimane.

**Mitigazione**: classificare al ribasso e mandare alert al dentista quando l'AI segna urgenza, ri-triage manuale ogni mattina del dentista.

#### 10. Trasferimento a operatore umano
La KB attuale ("le passo i riferimenti dello studio") forza il paziente a riagganciare e richiamare. Insoddisfacente per metà dei casi complessi.
**Mitigazione**: trasferimento di chiamata vero (TwiML `<Dial>`) verso mobile di backup del dentista/segretaria, quando l'AI non sa gestire e siamo in orario apertura.

---

### Strategici (da pianificare, non bloccanti)

- **Portabilità numero**: se lo studio cambia operatore, la config CFB/CFNR/CFU si resetta. Procedura di re-onboarding semplificata.
- **Responsabilità medico-legale**: se l'AI dà info che danneggia il paziente, chi risponde? Contratto Pippident con clausole di limitazione di responsabilità + assicurazione professionale del dentista che copra uso di AI.
- **Multilinea / più dentisti**: studi con 2-3 dentisti su numeri separati moltiplicano la complessità di config e di routing AI.
- **Cambio di KB nel tempo**: il dentista vorrà personalizzare. Versionamento + UI di editing che non rompe i tool calls.

---

## Differenze fisso vs mobile come numero pubblico dello studio

Stima del parco clienti (non statistica ufficiale, da validare con sampling Google Maps):
- ~55-65% studi: solo fisso pubblico
- ~20-25% studi: fisso + mobile
- ~15-25% studi: solo mobile pubblico

| Setup | CFB/CFNR | CFU "fuori orario" | Note |
|---|---|---|---|
| **Fisso dedicato** | OK | OK (tasto rapido cordless) | Caso ideale |
| **Mobile dedicato allo studio** | OK | OK (widget Android / contatto iPhone) | Funziona uguale al fisso |
| **Mobile personale del dentista** | OK | **Rischioso** — tutte le chiamate personali serali finiscono all'AI | Consigliare eSIM secondaria dedicata (~€5-10/mese), oppure attivare solo CFB+CFNR senza CFU |

**Policy onboarding**: chiedere sempre *"il numero che pubblicizzate ai pazienti è un fisso dedicato, un mobile dedicato, o il vostro mobile personale?"* e instradare di conseguenza.

---

## Casi non supportati (al momento) o da gestire separatamente

- Studi con centralino virtuale già esistente → setup manuale nel loro pannello PBX
- Studi multi-sede con numeri diversi per sede
- Studi con linee SIP trunk dirette (caso raro, tipico di grandi cliniche)
- Numeri non geografici come numero pubblico dello studio (800, 199)

---

## Priorità per il primo deploy reale

Da blindare **prima** di andare live con il primo studio cliente:
1. **Disclosure GDPR/AI Act in apertura** (Produzione #2) — non opzionale, rischio Garante.
2. **TwiML fallback** quando dipendenze giù (Produzione #5) — protezione minima del brand.
3. **Verifica identità per cancellazioni** (Produzione #7) — un errore qui è un disastro PR.
4. **Detection rapida chiamate spam** (Produzione #6) — protezione economica.

Latenza, conflitti calendario, triage si migliorano a iterazioni successive con dati reali — ma devono già avere un piano in testa al momento del go-live.
