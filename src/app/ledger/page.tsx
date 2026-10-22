import { LedgerBoard } from "@/components/ledger-board";
import { getCategories, getTransactions } from "@/lib/api.server";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  // Current date in India, regardless of where this server runs
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [y, m] = today.split("-").map(Number);
  const [txns, categories] = await Promise.all([getTransactions(y, m), getCategories()]);
  return <LedgerBoard initialTxns={txns} categories={categories} initialYear={y} initialMonth={m} today={today} />;
}
