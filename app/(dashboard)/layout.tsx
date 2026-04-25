import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { MobileNavProvider } from "@/components/layout/mobile-nav-context";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="app-shell" style={{ minHeight: "100vh" }}>
      <div className="app-bg-mesh" />
      <div className="app-bg-grid" />
      <MobileNavProvider>
        <Sidebar />
        <Header />
        <main className="dashboard-main">
          <div className="dashboard-main-inner">{children}</div>
        </main>
      </MobileNavProvider>
    </div>
  );
}
