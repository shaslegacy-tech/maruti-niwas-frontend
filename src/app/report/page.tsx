import { ReportBoard } from "@/components/report-board";
import { getSummary, getSummaryHistory } from "@/lib/api.server";

export const dynamic = "force-dynamic";

export default async function ReportPage() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [y, m] = today.split("-").map(Number);
  const [summary, history] = await Promise.all([getSummary(y, m), getSummaryHistory()]);
  return <ReportBoard initialSummary={summary} initialHistory={history} initialYear={y} initialMonth={m} />;
}
