import { NextResponse } from "next/server";
import { db, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { stripe, STRIPE_PRICES } from "@/lib/stripe";

const checkoutSchema = z.object({
  studioName: z.string().min(2, "Nome studio troppo corto").max(255),
  ownerName: z.string().min(2, "Nome troppo corto").max(255),
  email: z.email("Email non valida"),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
  plan: z.enum(["base", "growth", "pro", "clinic"]),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = checkoutSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      );
    }

    const { studioName, ownerName, email, password, plan } = parsed.data;

    // Check if email already exists
    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      return NextResponse.json(
        { error: "Un account con questa email esiste già." },
        { status: 409 }
      );
    }

    const priceId = STRIPE_PRICES[plan];
    if (!priceId) {
      return NextResponse.json(
        { error: `Price ID per il piano "${plan}" non configurato.` },
        { status: 500 }
      );
    }

    // Hash password now so we can store it safely in Stripe metadata.
    // The webhook will use it directly when creating the user.
    const passwordHash = await bcrypt.hash(password, 12);

    const appUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      // 15-day free trial — no charge today
      subscription_data: {
        trial_period_days: 15,
        metadata: { studioName, ownerName, email, passwordHash, plan },
      },
      customer_email: email,
      success_url: `${appUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/checkout?plan=${plan}`,
      // Pass account data as metadata on the session too (used by webhook)
      metadata: { studioName, ownerName, email, passwordHash, plan },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[POST /api/checkout]", error);
    return NextResponse.json(
      { error: "Errore interno. Riprova più tardi." },
      { status: 500 }
    );
  }
}
