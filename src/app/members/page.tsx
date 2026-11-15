import { redirect } from "next/navigation";
import { MembersBoard } from "@/components/members-board";
import { getMe, getMembers } from "@/lib/api.server";

export const dynamic = "force-dynamic";

/** Treasurer and Secretary maintain members; the Chairman can look but not change. */
export default async function MembersPage() {
  const me = await getMe();
  if (me.mustChangePassword) redirect("/change-password");
  if (me.roles.includes("RESIDENT")) redirect("/");
  const canEdit = me.roles.includes("TREASURER") || me.roles.includes("SECRETARY");
  return <MembersBoard initial={await getMembers()} readOnly={!canEdit} />;
}
