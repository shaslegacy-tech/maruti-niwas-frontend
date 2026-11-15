import { redirect } from "next/navigation";
import { ResidentDocuments } from "@/components/resident-documents";
import { StaffDocuments } from "@/components/staff-documents";
import { getDocuments, getMe, getMyDocuments } from "@/lib/api.server";

export const dynamic = "force-dynamic";

/** Residents see only what was shared with them; staff manage everything. */
export default async function DocumentsPage() {
  const me = await getMe();
  if (me.mustChangePassword) redirect("/change-password");
  if (me.roles.includes("RESIDENT")) return <ResidentDocuments docs={await getMyDocuments()} />;
  return <StaffDocuments initial={await getDocuments()} />;
}
