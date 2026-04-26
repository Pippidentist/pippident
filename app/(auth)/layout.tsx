import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

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
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 50,
        }}
      >
        <ThemeToggle />
      </div>
      <div className="app-content">{children}</div>
    </div>
  );
}
