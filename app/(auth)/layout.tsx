import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Redirect authenticated users away from auth pages
  if (session?.user) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
