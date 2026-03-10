import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db, users, twoFactorCodes } from "@/lib/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { sendOtpEmail } from "@/lib/email";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user || !user.isActive) return null;

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) return null;

        // Generate OTP and send via email
        const code = generateOtp();
        const codeHash = await bcrypt.hash(code, 10);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min

        await db.insert(twoFactorCodes).values({ userId: user.id, codeHash, expiresAt });

        if (process.env.NODE_ENV === "development") {
          console.log(`[2FA DEV] OTP code for ${user.email}: ${code}`);
        }

        await sendOtpEmail(user.email, code).catch((err) =>
          console.error("[2FA] Failed to send OTP email:", err)
        );

        // Update last login
        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, user.id));

        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          twoFactorPending: true,
          studioId: user.studioId,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id ?? "";
        token.twoFactorPending = (user as { twoFactorPending?: boolean }).twoFactorPending ?? false;
        token.studioId = (user as { studioId: string }).studioId;
        token.role = (user as { role: string }).role;
      }
      if (trigger === "update" && session?.twoFactorPending === false) {
        token.twoFactorPending = false;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as unknown as { twoFactorPending: boolean }).twoFactorPending =
          (token.twoFactorPending as boolean) ?? false;
        if (!token.twoFactorPending) {
          (session.user as { studioId: string }).studioId = token.studioId as string;
          (session.user as { role: string }).role = token.role as string;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 ore
  },
});
