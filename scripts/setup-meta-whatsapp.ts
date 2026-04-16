/**
 * One-time script: set whatsappPhoneNumberId for Studio Roversi.
 * Run with: npx tsx scripts/setup-meta-whatsapp.ts
 */
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from "../lib/db";
import { studios } from "../lib/db/schema";
import { eq } from "drizzle-orm";

const PHONE_NUMBER_ID = process.env.META_PHONE_NUMBER_ID!;
const STUDIO_EMAIL = "studio@roversi.it"; // email dello studio

async function main() {
  if (!PHONE_NUMBER_ID) {
    console.error("META_PHONE_NUMBER_ID non trovato in .env.local");
    process.exit(1);
  }

  const [updated] = await db
    .update(studios)
    .set({ whatsappPhoneNumberId: PHONE_NUMBER_ID })
    .where(eq(studios.email, STUDIO_EMAIL))
    .returning({ id: studios.id, name: studios.name, whatsappPhoneNumberId: studios.whatsappPhoneNumberId });

  if (!updated) {
    // Try by name if email doesn't match
    const all = await db.select({ id: studios.id, name: studios.name, email: studios.email }).from(studios);
    console.log("Studios disponibili:", all);
    console.error(`Studio con email "${STUDIO_EMAIL}" non trovato. Aggiorna STUDIO_EMAIL nello script.`);
    process.exit(1);
  }

  console.log("✅ Studio aggiornato:", updated);
}

main().catch(console.error).finally(() => process.exit(0));
