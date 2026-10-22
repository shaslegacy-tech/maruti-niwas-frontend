import { DefaultersBoard } from "@/components/defaulters-board";
import { getDefaulters, getRecentReminders } from "@/lib/api.server";

export const dynamic = "force-dynamic";

export default async function DefaultersPage() {
  const [overview, recent] = await Promise.all([getDefaulters(), getRecentReminders()]);
  return <DefaultersBoard initial={overview} initialRecent={recent} />;
}
