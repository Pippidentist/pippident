import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="app-shell">
      <div className="app-bg-mesh" />
      <div className="app-bg-grid" />
      <div className="app-content">{children}</div>
    </div>
  );
}
