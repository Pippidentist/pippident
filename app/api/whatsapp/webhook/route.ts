import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { handleIncomingMessage } from "@/lib/whatsapp-bot";
import { getTwilioAuthToken, sendWhatsAppMessage } from "@/lib/whatsapp";

export const runtime = "nodejs";

const EMPTY_TWIML = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

export async function POST(req: NextRequest) {
  const authToken = getTwilioAuthToken();

  // Parse form-urlencoded body from Twilio
  const text = await req.text();
  const params = Object.fromEntries(new URLSearchParams(text));

  // Validate Twilio signature
  const signature = req.headers.get("x-twilio-signature") ?? "";
  const host = req.headers.get("host") ?? "";
  const urlFromHost = `https://${host}/api/whatsapp/webhook`;
  const urlFromEnv = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/api/whatsapp/webhook`
    : urlFromHost;

  const validFromHost = authToken ? twilio.validateRequest(authToken, signature, urlFromHost, params) : true;
  const validFromEnv  = authToken ? twilio.validateRequest(authToken, signature, urlFromEnv, params) : true;

  console.log("[WA webhook] host:", host, "validFromHost:", validFromHost, "validFromEnv:", validFromEnv);

  if (authToken && !validFromHost && !validFromEnv) {
    console.error("[WA webhook] Signature validation failed. URL host:", urlFromHost, "URL env:", urlFromEnv);
    return new NextResponse("Firma non valida", { status: 403 });
  }

  const fromRaw: string = params["From"] ?? "";
  const toRaw: string = params["To"] ?? "";
  const body: string = params["Body"] ?? "";
  const messageSid: string = params["MessageSid"] ?? "";

  console.log("[WA webhook] From:", fromRaw, "To:", toRaw, "Body:", body, "SID:", messageSid);

  // Normalize phone: strip "whatsapp:" prefix
  const fromPhone = fromRaw.replace(/^whatsapp:/, "");
  const toPhone = toRaw; // keep full format e.g. "whatsapp:+14155238886"

  let replyText: string;
  try {
    replyText = await handleIncomingMessage({ fromPhone, toPhone, body, waMessageId: messageSid });
    console.log("[WA webhook] Reply:", replyText.substring(0, 100));
  } catch (err) {
    console.error("[WhatsApp webhook] handleIncomingMessage error:", err);
    replyText = "Si è verificato un errore. Riprova tra qualche minuto.";
  }

  // Send reply via REST API (more reliable than TwiML for sandbox delivery)
  try {
    const sid = await sendWhatsAppMessage(fromRaw, replyText, toRaw);
    console.log("[WA webhook] Message sent via REST API, SID:", sid);
  } catch (err) {
    console.error("[WA webhook] Failed to send via REST API:", err);
  }

  // Return empty TwiML so Twilio doesn't also try to send the message
  return new NextResponse(EMPTY_TWIML, {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
