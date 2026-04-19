import { db } from "../lib/db";
import { whatsappMessages } from "../lib/db/schema";
import { desc } from "drizzle-orm";

async function main() {
  console.log(`── Now: ${new Date().toISOString()} ──`);
  const msgs = await db
    .select()
    .from(whatsappMessages)
    .orderBy(desc(whatsappMessages.sentAt))
    .limit(15);

  for (const m of msgs) {
    console.log(
      `[${m.sentAt?.toISOString()}] dir=${m.direction} type=${m.messageType} status=${m.status} body="${(m.body ?? "").substring(0, 90).replace(/\n/g, " ")}"`
    );
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
