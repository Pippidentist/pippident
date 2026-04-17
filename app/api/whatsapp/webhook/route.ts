import { NextRequest, NextResponse } from "next/server";
import { handleIncomingMessage } from "@/lib/whatsapp-bot";
import { sendMetaWhatsAppMessage, markMetaMessageRead } from "@/lib/meta-whatsapp";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── GET — Meta webhook verification ─────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN?.trim();

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[Meta webhook] Webhook verified");
    return new NextResponse(challenge, { status: 200 });
  }

  console.error("[Meta webhook] Verification failed. token:", token, "expected:", verifyToken);
  return new NextResponse("Forbidden", { status: 403 });
}

// ── POST — Incoming messages ──────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ status: "ok" });
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload = body as any;
    const change = payload?.entry?.[0]?.changes?.[0]?.value;

    if (!change?.messages?.length) {
      // Status update or other notification — not a user message
      return NextResponse.json({ status: "ok" });
    }

    const message = change.messages[0];

    // Only handle text messages (ignore images, audio, etc.)
    if (message.type !== "text") {
      return NextResponse.json({ status: "ok" });
    }

    const fromPhone = `+${message.from as string}`; // Meta sends digits without +
    const phoneNumberId = change.metadata.phone_number_id as string;
    const messageBody = message.text.body as string;
    const waMessageId = message.id as string;
    const accessToken = process.env.META_WHATSAPP_TOKEN ?? "";

    console.log("[Meta webhook] From:", fromPhone, "PhoneNumberId:", phoneNumberId, "Body:", messageBody, "SID:", waMessageId);

    // Mark message as read (shows double blue tick to user)
    await markMetaMessageRead(waMessageId, phoneNumberId, accessToken);

    // Process and get reply
    const replyText = await handleIncomingMessage({
      fromPhone,
      phoneNumberId,
      body: messageBody,
      waMessageId,
    });

    console.log("[Meta webhook] Reply:", replyText.substring(0, 100));

    // Send reply via Meta REST API
    const outboundId = await sendMetaWhatsAppMessage(fromPhone, replyText, phoneNumberId, accessToken);
    console.log("[Meta webhook] Reply sent, ID:", outboundId);

  } catch (err) {
    console.error("[Meta webhook] Error:", err);
  }

  // Always return 200 so Meta doesn't retry
  return NextResponse.json({ status: "ok" });
}
