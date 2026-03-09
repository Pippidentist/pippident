import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, twoFactorCodes } from "@/lib/db";
import { eq, and, gt } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const schema = z.object({ code: z.string().length(6) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Codice non valido" }, { status: 400 });
  }

  const { code } = parsed.data;
  const userId = session.user.id;

  // Find latest unused, non-expired code for this user
  const [record] = await db
    .select()
    .from(twoFactorCodes)
    .where(
      and(
        eq(twoFactorCodes.userId, userId),
        eq(twoFactorCodes.used, false),
        gt(twoFactorCodes.expiresAt, new Date())
      )
    )
    .orderBy(twoFactorCodes.createdAt)
    .limit(1);

  if (!record) {
    return NextResponse.json({ error: "Codice scaduto. Effettua nuovamente il login." }, { status: 400 });
  }

  const valid = await bcrypt.compare(code, record.codeHash);
  if (!valid) {
    return NextResponse.json({ error: "Codice errato." }, { status: 400 });
  }

  // Mark code as used
  await db
    .update(twoFactorCodes)
    .set({ used: true })
    .where(eq(twoFactorCodes.id, record.id));

  return NextResponse.json({ ok: true });
}
