import { BadgeCheck, Clock, Inbox, Landmark, MessageSquareWarning, TrendingDown, Users } from "lucide-react";
import Link from "next/link";
import { CashFlowChart } from "@/components/cash-flow-chart";
import { RecentFeed } from "@/components/recent-feed";
import { StatCard } from "@/components/stat-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { getApprovalsSummary, getClaimsSummary, getComplaintsSummary, getDashboard, getReviewSummary } from "@/lib/api.server";
import { inr } from "@/lib/format";

export async function DashboardView({ showClaims = true, showApprovals = false }: { showClaims?: boolean; showApprovals?: boolean } = {}) {
  const d = await getDashboard();
  const claims = showClaims ? await getClaimsSummary() : { pending: 0 };
  const complaints = await getComplaintsSummary();
  const approvals = showApprovals ? await getApprovalsSummary() : { pending: 0 };
  const review = showClaims ? await getReviewSummary() : null;      // the treasurer sees where the Chairman stands on larger entries
  const rate = d.totalFlats ? d.flatsPaid / d.totalFlats : 0;

  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted">{d.monthLabel}</p>
        </div>
        <ThemeToggle />
      </header>

      {approvals.pending > 0 && (
        <Link href="/approvals"
              className="mb-4 flex items-center gap-3 rounded-xl bg-accent/12 px-4 py-3 text-sm text-accent transition hover:bg-accent/20">
          <BadgeCheck className="size-4" />
          <span><b>{approvals.pending}</b> item{approvals.pending > 1 ? "s" : ""} waiting for your approval</span>
          <span className="ml-auto text-xs underline">Review</span>
        </Link>
      )}

      {complaints.active > 0 && (
        <Link href="/complaints"
              className="mb-4 flex items-center gap-3 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense transition hover:bg-expense/15">
          <MessageSquareWarning className="size-4" />
          <span><b>{complaints.active}</b> open complaint{complaints.active > 1 ? "s" : ""} from residents</span>
          <span className="ml-auto text-xs underline">Open</span>
        </Link>
      )}

      {review && review.rejected > 0 && (
        <Link href="/ledger"
              className="mb-4 flex items-center gap-3 rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense transition hover:bg-expense/15">
          <BadgeCheck className="size-4" />
          <span><b>{review.rejected}</b> ledger entr{review.rejected > 1 ? "ies were" : "y was"} rejected by the Chairman. Please review {review.rejected > 1 ? "them" : "it"}.</span>
          <span className="ml-auto text-xs underline">Open ledger</span>
        </Link>
      )}

      {review && review.pending > 0 && (
        <Link href="/ledger"
              className="mb-4 flex items-center gap-3 rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn transition hover:bg-warn/15">
          <BadgeCheck className="size-4" />
          <span><b>{review.pending}</b> ledger entr{review.pending > 1 ? "ies are" : "y is"} waiting for the Chairman&apos;s approval</span>
          <span className="ml-auto text-xs underline">Open ledger</span>
        </Link>
      )}

      {claims.pending > 0 && (
        <Link href="/claims"
              className="mb-4 flex items-center gap-3 rounded-xl bg-warn/10 px-4 py-3 text-sm text-warn transition hover:bg-warn/15">
          <Inbox className="size-4" />
          <span><b>{claims.pending}</b> resident payment{claims.pending > 1 ? "s" : ""} waiting for your review</span>
          <span className="ml-auto text-xs underline">Review</span>
        </Link>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label="Total balance" value={d.totalBalance} icon={<Landmark className="size-4" />}
                  hint={`Cash ${inr(d.cashBalance)} · Bank ${inr(d.bankBalance)}`} />
        <StatCard index={1} label="Collection rate" kind="plain" value={d.flatsPaid} suffix={`/ ${d.totalFlats} flats`}
                  tone="income" progress={rate} icon={<Users className="size-4" />} />
        <StatCard index={2} label="Expenses this month" value={d.monthExpenses} tone="expense"
                  icon={<TrendingDown className="size-4" />} />
        <StatCard index={3} label="Pending dues" value={d.pendingDues} tone="warn"
                  icon={<Clock className="size-4" />} hint="All unpaid maintenance" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3"><CashFlowChart data={d.chart} /></div>
        <div className="lg:col-span-2"><RecentFeed items={d.recent} /></div>
      </div>
    </>
  );
}
