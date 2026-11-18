import { redirect } from "next/navigation";
import { ApprovalsBoard } from "@/components/approvals-board";
import { getApprovals, getMe } from "@/lib/api.server";

export const dynamic = "force-dynamic";

/** The Chairman's queue. Nobody else can open it. */
export default async function ApprovalsPage() {
  const me = await getMe();
  if (me.mustChangePassword) redirect("/change-password");
  if (!me.roles.includes("CHAIRMAN")) redirect("/");
  return <ApprovalsBoard initial={await getApprovals()} />;
}
