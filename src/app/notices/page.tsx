import { redirect } from "next/navigation";
import { NoticesBoard } from "@/components/notices-board";
import { getMe, getNotices } from "@/lib/api.server";

export const dynamic = "force-dynamic";

export default async function NoticesPage() {
  const me = await getMe();
  if (me.mustChangePassword) redirect("/change-password");
  if (me.roles.includes("RESIDENT")) redirect("/");
  // Treasurer and Secretary write notices; the Chairman supervises and approves the important ones.
  const readOnly = !(me.roles.includes("TREASURER") || me.roles.includes("SECRETARY"));
  return <NoticesBoard initial={await getNotices()} readOnly={readOnly} />;
}
