import { redirect } from "next/navigation";
import { CommitteeBoard } from "@/components/committee-board";
import { getCommittee, getMe } from "@/lib/api.server";

export const dynamic = "force-dynamic";

/** Treasurer only: create and manage the Secretary and Chairman logins. */
export default async function CommitteePage() {
  const me = await getMe();
  if (me.mustChangePassword) redirect("/change-password");
  if (!me.roles.includes("TREASURER")) redirect("/");
  return <CommitteeBoard initial={await getCommittee()} />;
}
