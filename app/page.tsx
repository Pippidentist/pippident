import { redirect } from "next/navigation";

export default function Home() {
  // Redirect unauthenticated users to login
  // Authenticated redirect to dashboard happens in dashboard layout
  redirect("/dashboard");
}
