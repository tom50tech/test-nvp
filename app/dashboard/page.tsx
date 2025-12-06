import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import DashboardClient from "@/components/DashboardClient";

export default function DashboardPage() {
  const cookieStore = cookies();
  const userCookie = cookieStore.get("user");

  if (!userCookie) {
    redirect("/");
  }

  const email = decodeURIComponent(userCookie.value || "");

  return (
    <main style={{ width: "100%", maxWidth: 1000, padding: 16 }}>
      <DashboardClient email={email} />
    </main>
  );
}
