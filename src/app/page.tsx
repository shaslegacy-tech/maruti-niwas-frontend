import { redirect } from "next/navigation";
import { DashboardView } from "@/components/dashboard-view";
import { ResidentDashboard } from "@/components/resident-dashboard";
import { getMe, getResidentHome } from "@/lib/api.server";

export const dynamic = "force-dynamic";

/** Same address for everyone; what you see depends on your role. */
export default async function HomePage() {
  const me = await getMe();
  if (me.mustChangePassword) redirect("/change-password");
  if (me.roles.includes("RESIDENT")) return <ResidentDashboard home={await getResidentHome()} />;
  return <DashboardView showClaims={me.roles.includes("TREASURER")} showApprovals={me.roles.includes("CHAIRMAN")} />;
}
