import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { db, studios, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

// Next.js must receive the raw body to verify Stripe's signature.
export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook secret missing" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const meta = session.metadata;

    if (!meta?.email || !meta?.studioName || !meta?.passwordHash) {
      console.error("Missing metadata in checkout session", session.id);
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const { studioName, ownerName, email, passwordHash, plan } = meta;

    // Idempotency guard: skip if user already exists
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      console.log(`[webhook] User for ${email} already exists, skipping`);
    } else {
      // Studio may already exist if a previous webhook attempt created it but
      // crashed before inserting the user. Upsert to handle both cases.
      const [studio] = await db
        .insert(studios)
        .values({
          name: studioName,
          email,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          settings: { plan, stripeSubscriptionId: session.subscription } as any,
        })
        .onConflictDoUpdate({
          target: studios.email,
          set: { settings: { plan, stripeSubscriptionId: session.subscription } as any },
        })
        .returning({ id: studios.id });

      await db.insert(users).values({
        studioId: studio.id,
        email,
        passwordHash,
        fullName: ownerName ?? studioName,
        role: "admin",
      });

      console.log(`[webhook] Studio + user created for ${email} (plan: ${plan})`);
    }
  }

  return NextResponse.json({ received: true });
}
