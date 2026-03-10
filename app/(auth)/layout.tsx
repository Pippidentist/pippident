import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Redirect fully authenticated users away from auth pages
  // (but NOT users with twoFactorPending, they need to access /verify-otp)
  const twoFactorPending = (session?.user as { twoFactorPending?: boolean })?.twoFactorPending;
  if (session?.user && !twoFactorPending) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
