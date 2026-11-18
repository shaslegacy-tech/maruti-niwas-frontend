import { getMe } from "@/lib/api.server";
import { LedgerBoard } from "@/components/ledger-board";
import { getCategories, getReviewSummary, getTransactions } from "@/lib/api.server";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const me = await getMe();
  const readOnly = !me.roles.includes("TREASURER");   // Secretary and Chairman look, but cannot change
  // Current date in India, regardless of where this server runs
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [y, m] = today.split("-").map(Number);
  const [txns, categories, review] = await Promise.all([
    getTransactions(y, m), getCategories(),
    me.roles.includes("TREASURER") ? getReviewSummary() : Promise.resolve(null),   // only the treasurer needs the limit
  ]);
  return <LedgerBoard initialTxns={txns} categories={categories} initialYear={y} initialMonth={m} today={today} readOnly={readOnly} threshold={review?.threshold ?? null} />;
}
