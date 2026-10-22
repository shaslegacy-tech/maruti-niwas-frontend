import { Clock, Landmark, TrendingDown, Users } from "lucide-react";
import { CashFlowChart } from "@/components/cash-flow-chart";
import { RecentFeed } from "@/components/recent-feed";
import { StatCard } from "@/components/stat-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { getDashboard } from "@/lib/api.server";
import { inr } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const d = await getDashboard();
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
