import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { handleIncomingMessage } from "@/lib/whatsapp-bot";
import { getTwilioAuthToken } from "@/lib/whatsapp";

export const runtime = "nodejs";

function buildTwimlResponse(message: string): string {
  // Escape XML special chars
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
}

export async function POST(req: NextRequest) {
  const authToken = getTwilioAuthToken();

  // Parse form-urlencoded body from Twilio
  const text = await req.text();
  const params = Object.fromEntries(new URLSearchParams(text));

  // Validate Twilio signature
  const signature = req.headers.get("x-twilio-signature") ?? "";
  const url = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/api/whatsapp/webhook`
    : `https://${req.headers.get("host")}/api/whatsapp/webhook`;

  if (authToken && !twilio.validateRequest(authToken, signature, url, params)) {
    return new NextResponse("Firma non valida", { status: 403 });
  }

  const fromRaw: string = params["From"] ?? "";
  const toRaw: string = params["To"] ?? "";
  const body: string = params["Body"] ?? "";
  const messageSid: string = params["MessageSid"] ?? "";

  // Normalize phone: strip "whatsapp:" prefix
  const fromPhone = fromRaw.replace(/^whatsapp:/, "");
  const toPhone = toRaw; // keep full format e.g. "whatsapp:+14155238886"

  let replyText: string;
  try {
    replyText = await handleIncomingMessage({ fromPhone, toPhone, body, waMessageId: messageSid });
  } catch (err) {
    console.error("[WhatsApp webhook]", err);
    replyText = "Si è verificato un errore. Riprova tra qualche minuto.";
  }

  return new NextResponse(buildTwimlResponse(replyText), {
    status: 200,
    headers: { "Content-Type": "text/xml" },
  });
}
