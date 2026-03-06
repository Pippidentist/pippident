import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY environment variable is required.");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-02-25.clover",
});

// Price IDs created in your Stripe dashboard (test mode).
// One-time setup: create 4 Products + Prices there, then paste the IDs.
export const STRIPE_PRICES = {
  base:   process.env.STRIPE_PRICE_BASE   ?? "",
  growth: process.env.STRIPE_PRICE_GROWTH ?? "",
  pro:    process.env.STRIPE_PRICE_PRO    ?? "",
  clinic: process.env.STRIPE_PRICE_CLINIC ?? "",
} as const;
