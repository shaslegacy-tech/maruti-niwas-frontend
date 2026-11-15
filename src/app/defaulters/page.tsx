import { getMe } from "@/lib/api.server";
import { DefaultersBoard } from "@/components/defaulters-board";
import { getDefaulters, getRecentReminders } from "@/lib/api.server";

export const dynamic = "force-dynamic";

export default async function DefaultersPage() {
  const me = await getMe();
  const readOnly = !me.roles.includes("TREASURER");   // Secretary and Chairman look, but cannot change
  const [overview, recent] = await Promise.all([getDefaulters(), getRecentReminders()]);
  return <DefaultersBoard initial={overview} initialRecent={recent} readOnly={readOnly} />;
}
