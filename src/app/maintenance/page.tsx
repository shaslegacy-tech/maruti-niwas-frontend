import { redirect } from "next/navigation";
import { ResidentMaintenance } from "@/components/resident-maintenance";
import { getMe, getResidentHome } from "@/lib/api.server";

export const dynamic = "force-dynamic";

export default async function MaintenancePage() {
  const me = await getMe();
  if (me.mustChangePassword) redirect("/change-password");
  if (!me.roles.includes("RESIDENT")) redirect("/");        // staff manage maintenance from the Flats screen
  return <ResidentMaintenance home={await getResidentHome()} />;
}
