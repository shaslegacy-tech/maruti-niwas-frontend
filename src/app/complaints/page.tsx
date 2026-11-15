import { redirect } from "next/navigation";
import { ComplaintsBoard } from "@/components/complaints-board";
import { getComplaints, getMe, getMyComplaints } from "@/lib/api.server";

export const dynamic = "force-dynamic";

/** Same address for everyone; residents see their own complaints, staff see them all. */
export default async function ComplaintsPage() {
  const me = await getMe();
  if (me.mustChangePassword) redirect("/change-password");
  if (me.roles.includes("RESIDENT")) return <ComplaintsBoard mode="RESIDENT" initial={await getMyComplaints()} />;
  return <ComplaintsBoard mode="STAFF" initial={await getComplaints()} />;
}
