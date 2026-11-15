import { getMe } from "@/lib/api.server";
import { BalancesBoard } from "@/components/balances-board";
import { getBalanceOverview, getReconciliation } from "@/lib/api.server";

export const dynamic = "force-dynamic";

export default async function BalancesPage() {
  const me = await getMe();
  const readOnly = !me.roles.includes("TREASURER");   // Secretary and Chairman look, but cannot change
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [y, m] = today.split("-").map(Number);
  const [overview, rec] = await Promise.all([getBalanceOverview(), getReconciliation(y, m)]);
  return <BalancesBoard initialOverview={overview} initialRec={rec} initialYear={y} initialMonth={m} readOnly={readOnly} />;
}
