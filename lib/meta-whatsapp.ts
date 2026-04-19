const GRAPH_API_VERSION = "v21.0";

/**
 * Sends a WhatsApp text message via Meta Cloud API.
 * @param to - recipient phone number (with or without +, e.g. "+393319657519" or "393319657519")
 * @param body - message text
 * @param phoneNumberId - Meta phone number ID of the sender
 * @param accessToken - Meta access token
 */
export async function sendMetaWhatsAppMessage(
  to: string,
  body: string,
  phoneNumberId: string,
  accessToken: string
): Promise<string> {
  // Meta expects digits only, no "+" prefix
  const toNormalized = to.replace(/^\+/, "");

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toNormalized,
        type: "text",
        text: { body },
      }),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Meta API error ${res.status}: ${error}`);
  }

  const data = await res.json();
  return (data.messages?.[0]?.id as string) ?? "unknown";
}

/**
 * Sends a WhatsApp template message via Meta Cloud API.
 * Templates bypass the 24h customer-initiated session window.
 */
export async function sendMetaWhatsAppTemplate(
  to: string,
  templateName: string,
  languageCode: string,
  bodyParams: string[],
  phoneNumberId: string,
  accessToken: string
): Promise<string> {
  const toNormalized = to.replace(/^\+/, "");

  const payload = {
    messaging_product: "whatsapp",
    to: toNormalized,
    type: "template",
    template: {
      name: templateName,
      language: { code: languageCode },
      components: bodyParams.length
        ? [
            {
              type: "body",
              parameters: bodyParams.map((text) => ({ type: "text", text })),
            },
          ]
        : undefined,
    },
  };

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!res.ok) {
    const error = await res.text();
    throw new Error(`Meta API error ${res.status}: ${error}`);
  }

  const data = await res.json();
  return (data.messages?.[0]?.id as string) ?? "unknown";
}

/**
 * Marks an incoming WhatsApp message as read.
 */
export async function markMetaMessageRead(
  messageId: string,
  phoneNumberId: string,
  accessToken: string
): Promise<void> {
  try {
    await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          status: "read",
          message_id: messageId,
        }),
      }
    );
  } catch {
    // Non-critical — ignore failures
  }
}
