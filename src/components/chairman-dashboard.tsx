import { BadgeCheck, Clock, Landmark, TrendingDown, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { CashFlowChart } from "@/components/cash-flow-chart";
import { RecentFeed } from "@/components/recent-feed";
import { StatCard } from "@/components/stat-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { getApprovals, getComplaintsSummary, getDashboard } from "@/lib/api.server";
import { inr } from "@/lib/format";

const TYPE_LABEL = { NOTICE: "Important notice", RESOLUTION: "Important decision", TRANSACTION: "Ledger entry" } as const;

/** The Chairman's view: the society at a glance, and what needs his decision. He supervises; he does not edit. */
export async function ChairmanDashboard() {
  const [d, approvals, complaints] = await Promise.all([getDashboard(), getApprovals(), getComplaintsSummary()]);
  const month = d.monthLabel.split(" ")[0];
  const pendingFlats = d.totalFlats - d.flatsPaid;
  const rate = d.totalFlats ? d.flatsPaid / d.totalFlats : 0;

  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Chairman&apos;s dashboard</h1>
          <p className="text-sm text-muted">{d.monthLabel}</p>
        </div>
        <ThemeToggle />
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard index={0} label="Society balance" value={d.totalBalance} icon={<Landmark className="size-4" />}
                  hint={`Cash ${inr(d.cashBalance)} · Bank ${inr(d.bankBalance)}`} />
        <StatCard index={1} label={`${month} collection`} value={d.maintenanceCollected} tone="income" icon={<Wallet className="size-4" />} />
        <StatCard index={2} label="Outstanding" value={d.pendingDues} tone="warn" icon={<Clock className="size-4" />} hint="All unpaid maintenance" />
        <StatCard index={3} label={`${month} expenses`} value={d.monthExpenses} tone="expense" icon={<TrendingDown className="size-4" />} />
        <Link href="/approvals" className="block">
          <StatCard index={4} label="Pending approvals" kind="plain" value={approvals.length} tone={approvals.length > 0 ? "warn" : "income"}
                    icon={<BadgeCheck className="size-4" />} hint={approvals.length > 0 ? "Tap to review" : "All clear"} />
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard index={5} label="Members" kind="plain" value={d.totalFlats} suffix="flats" icon={<Users className="size-4" />} />
        <StatCard index={6} label="Paid flats" kind="plain" value={d.flatsPaid} suffix={`/ ${d.totalFlats}`} tone="income" progress={rate} icon={<Users className="size-4" />} />
        <StatCard index={7} label="Pending flats" kind="plain" value={pendingFlats} suffix={pendingFlats === 1 ? "flat" : "flats"} tone={pendingFlats > 0 ? "warn" : "income"} icon={<Users className="size-4" />} />
      </div>

      <section className="glass mt-4 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-medium">Waiting for your decision</h2>
          {approvals.length > 0 && <Link href="/approvals" className="text-xs text-accent hover:underline">Review all</Link>}
        </div>
        {approvals.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted">Nothing is waiting for your approval 🎉</p>
        ) : (
          <ul className="divide-y divide-border">
            {approvals.slice(0, 5).map((a) => (
              <li key={`${a.type}:${a.id}`}>
                <Link href="/approvals" className="flex items-center gap-3 py-2.5 transition hover:opacity-80">
                  <span className="shrink-0 rounded-full bg-expense/12 px-2 py-0.5 text-[11px] font-medium text-expense">{TYPE_LABEL[a.type]}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{a.title}</span>
                  <span className="hidden truncate text-xs text-muted sm:block sm:max-w-[40%]">{a.meta}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {complaints.active > 0 && (
          <Link href="/complaints" className="mt-3 block text-xs text-muted hover:text-foreground">
            {complaints.active} open resident complaint{complaints.active > 1 ? "s" : ""} →
          </Link>
        )}
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3"><CashFlowChart data={d.chart} /></div>
        <div className="lg:col-span-2"><RecentFeed items={d.recent} /></div>
      </div>
    </>
  );
}
