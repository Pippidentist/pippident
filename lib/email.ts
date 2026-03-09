import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

export async function sendOtpEmail(to: string, code: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Il tuo codice di accesso Pippident",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="font-size:20px;font-weight:700;color:#111827;margin-bottom:8px">
          Verifica la tua identità
        </h2>
        <p style="color:#6b7280;font-size:14px;margin-bottom:24px">
          Usa il codice seguente per completare il login. Il codice scade tra <strong>10 minuti</strong>.
        </p>
        <div style="background:#f3f4f6;border-radius:12px;padding:20px 32px;text-align:center;letter-spacing:12px;font-size:32px;font-weight:700;color:#111827;margin-bottom:24px">
          ${code}
        </div>
        <p style="color:#9ca3af;font-size:12px">
          Se non hai richiesto questo codice, ignora questa email.
        </p>
      </div>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reimposta la tua password Pippident",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h2 style="font-size:20px;font-weight:700;color:#111827;margin-bottom:8px">
          Reimposta la password
        </h2>
        <p style="color:#6b7280;font-size:14px;margin-bottom:24px">
          Hai richiesto di reimpostare la password del tuo account Pippident.
          Clicca il pulsante qui sotto. Il link scade tra <strong>1 ora</strong>.
        </p>
        <a href="${resetUrl}"
           style="display:inline-block;background:#2563eb;color:#fff;font-weight:600;font-size:14px;padding:12px 24px;border-radius:8px;text-decoration:none;margin-bottom:24px">
          Reimposta password
        </a>
        <p style="color:#9ca3af;font-size:12px">
          Se non hai richiesto il reset della password, ignora questa email.
          Il link scadrà automaticamente tra un'ora.
        </p>
      </div>
    `,
  });
}
