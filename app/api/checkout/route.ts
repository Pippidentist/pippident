import { NextResponse } from "next/server";
import { db, studios, users } from "@/lib/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";

const checkoutSchema = z.object({
  studioName: z.string().min(2, "Nome studio troppo corto").max(255),
  ownerName: z.string().min(2, "Nome troppo corto").max(255),
  email: z.email("Email non valida"),
  password: z.string().min(8, "La password deve avere almeno 8 caratteri"),
  plan: z.enum(["essenziale", "completo"]),
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

    const passwordHash = await bcrypt.hash(password, 12);

    // Create studio (store plan in settings JSONB)
    const [studio] = await db
      .insert(studios)
      .values({
        name: studioName,
        email,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        settings: { plan } as any,
      })
      .returning({ id: studios.id });

    // Create admin user
    await db.insert(users).values({
      studioId: studio.id,
      email,
      passwordHash,
      fullName: ownerName,
      role: "admin",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[POST /api/checkout]", error);
    return NextResponse.json(
      { error: "Errore interno. Riprova più tardi." },
      { status: 500 }
    );
  }
}
