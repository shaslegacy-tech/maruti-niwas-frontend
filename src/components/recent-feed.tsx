import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { FeedItem } from "@/lib/api";
import { inr, shortDate } from "@/lib/format";

const BADGE: Record<string, string> = {
  PAID: "bg-income/15 text-income",
  PARTIAL: "bg-warn/15 text-warn",
  PENDING: "bg-expense/15 text-expense",
  COMPLETED: "bg-foreground/10 text-muted",
};

export function RecentFeed({ items }: { items: FeedItem[] }) {
  return (
    <section className="glass p-5">
      <h2 className="mb-1 text-sm font-medium">Recent transactions</h2>
      <p className="mb-3 text-xs text-muted">Latest income and expense entries</p>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">No transactions yet</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((t, i) => {
            const income = t.type === "INCOME";
            const Icon = income ? ArrowDownLeft : ArrowUpRight;
            return (
              <li key={i} className="flex items-center gap-3 py-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-full ${income ? "bg-income/15 text-income" : "bg-expense/15 text-expense"}`}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{t.title}</p>
                  <p className="text-xs text-muted">{shortDate(t.date)} · {t.category}</p>
                </div>
                <span className={`hidden rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline ${BADGE[t.status] ?? BADGE.COMPLETED}`}>
                  {t.status === "COMPLETED" ? "Recorded" : t.status.charAt(0) + t.status.slice(1).toLowerCase()}
                </span>
                <span className={`w-24 text-right text-sm font-semibold tabular-nums ${income ? "text-income" : "text-expense"}`}>
                  {income ? "+" : "−"}{inr(t.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
