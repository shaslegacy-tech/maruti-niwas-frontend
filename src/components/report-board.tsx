"use client";

import { motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Copy, Lock, LockOpen, MessageCircle } from "lucide-react";
import { Fragment, type ReactNode, useCallback, useState } from "react";
import { type Summary, closeMonth, getSummary, getSummaryHistory, reopenMonth } from "@/lib/api";
import { inr } from "@/lib/format";

const monthName = (y: number, m: number, style: "long" | "short" = "long") =>
  new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: style, year: "numeric" });

/** Renders WhatsApp-style *bold* and _italic_ so the preview matches what the group will see. */
function renderLine(line: string): ReactNode {
  return line.split(/(\*[^*]+\*|_[^_]+_)/g).map((part, i) => {
    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <strong key={i}>{part.slice(1, -1)}</strong>;
    if (part.length > 2 && part.startsWith("_") && part.endsWith("_")) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

interface Props { initialSummary: Summary; initialHistory: Summary[]; initialYear: number; initialMonth: number }

export function ReportBoard({ initialSummary, initialHistory, initialYear, initialMonth }: Props) {
  const [summary, setSummary] = useState(initialSummary);
  const [history, setHistory] = useState(initialHistory);
  const [ym, setYm] = useState({ y: initialYear, m: initialMonth });
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isCurrent = ym.y === initialYear && ym.m === initialMonth;

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true); setError(null);
    try {
      const [s, h] = await Promise.all([getSummary(y, m), getSummaryHistory()]);
      setSummary(s); setHistory(h);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  function go(delta: number) {
    const d = new Date(ym.y, ym.m - 1 + delta, 1);
    const next = { y: d.getFullYear(), m: d.getMonth() + 1 };
    setYm(next); load(next.y, next.m);
  }

  function open(y: number, m: number) {
    setYm({ y, m }); load(y, m);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function toggleClose() {
    const label = monthName(ym.y, ym.m);
    const msg = summary.closed
      ? `Reopen ${label}? Payments and entries can be changed again.`
      : `Close ${label}? Payments and ledger entries for this month will be locked and the report archived.`;
    if (!confirm(msg)) return;
    setError(null);
    try {
      if (summary.closed) await reopenMonth(ym.y, ym.m); else await closeMonth(ym.y, ym.m);
      await load(ym.y, ym.m);
    } catch (e) { setError((e as Error).message); }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary.reportText);
      setCopied(true); setTimeout(() => setCopied(false), 1800);
    } catch { setError("Couldn’t copy automatically. Select the text and copy it manually."); }
  }

  const tiles = [
    { label: "Opening balance", value: summary.openingBalance, tone: "" },
    { label: "Total income", value: summary.totalIncome, tone: "text-income",
      hint: `${inr(summary.maintenanceIncome)} maintenance + ${inr(summary.otherIncome)} other` },
    { label: "Total expenses", value: summary.totalExpenses, tone: "text-expense" },
    { label: "Closing balance", value: summary.closingBalance, tone: "text-accent", strong: true,
      hint: `Cash ${inr(summary.closingCash)} · Bank ${inr(summary.closingBank)}` },
  ];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Monthly report</h1>
          <p className="text-sm text-muted">Statement for the society WhatsApp group</p>
        </div>
        <div className="glass flex items-center gap-1 p-1">
          <button onClick={() => go(-1)} aria-label="Previous month" className="grid size-8 place-items-center rounded-lg text-muted hover:text-foreground">
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-36 text-center text-sm font-medium">{monthName(ym.y, ym.m)}</span>
          <button onClick={() => go(1)} disabled={isCurrent} aria-label="Next month"
                  className="grid size-8 place-items-center rounded-lg text-muted hover:text-foreground disabled:opacity-30">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {error && <p className="mb-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}

      <div className={`transition-opacity ${loading ? "opacity-60" : ""}`}>
        <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          {tiles.map((t, i) => (
            <motion.div key={t.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className={`glass p-4 ${t.strong ? "ring-1 ring-accent/40" : ""}`}>
              <p className="text-xs text-muted">{t.label}</p>
              <p className={`mt-1 text-xl font-semibold tabular-nums ${t.tone}`}>{inr(t.value)}</p>
              {t.hint && <p className="mt-1 text-[11px] text-muted">{t.hint}</p>}
            </motion.div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-5">
          <section className="glass p-5 lg:col-span-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-medium">WhatsApp report</h2>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  summary.closed ? "bg-income/15 text-income" : "bg-warn/15 text-warn"}`}>
                  {summary.closed ? "Closed" : "Live preview"}
                </span>
              </div>
              <div className="flex gap-2">
                <button onClick={copy}
                        className="flex items-center gap-1.5 rounded-lg bg-foreground/8 px-3 py-1.5 text-xs font-medium transition hover:bg-foreground/12">
                  {copied ? <Check className="size-3.5 text-income" /> : <Copy className="size-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
                <a href={summary.whatsappShareUrl} target="_blank" rel="noopener noreferrer"
                   className="flex items-center gap-1.5 rounded-lg bg-income px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90">
                  <MessageCircle className="size-3.5" />Send to WhatsApp
                </a>
              </div>
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-income/20 bg-income/10 p-4 text-sm leading-relaxed">
              {summary.reportText.split("\n").map((line, i) => (
                <div key={i} className="min-h-[1.25em]">{renderLine(line)}</div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted">
              “Send to WhatsApp” opens WhatsApp with this text ready. Pick the society group and send.
            </p>
          </section>

          <div className="space-y-4 lg:col-span-2">
            <section className="glass p-5">
              <h2 className="mb-1 text-sm font-medium">Month-end close</h2>
              <p className="mb-4 text-xs text-muted">
                {summary.closed
                  ? `Closed${summary.closedAt ? " on " + new Date(summary.closedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : ""}. Figures are archived and locked.`
                  : "Closing archives this statement and locks payments and ledger entries for the month."}
              </p>
              <button onClick={toggleClose}
                      className={`flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition ${
                        summary.closed ? "bg-foreground/8 hover:bg-foreground/12" : "bg-accent text-white hover:opacity-90"}`}>
                {summary.closed ? <><LockOpen className="size-4" />Reopen month</> : <><Lock className="size-4" />Close {monthName(ym.y, ym.m)}</>}
              </button>
            </section>

            <section className="glass p-5">
              <h2 className="mb-3 text-sm font-medium">Archive</h2>
              {history.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">No closed months yet</p>
              ) : (
                <ul className="divide-y divide-border">
                  {history.map((h) => (
                    <li key={`${h.year}-${h.month}`}>
                      <button onClick={() => open(h.year, h.month)}
                              className="flex w-full items-center justify-between py-2.5 text-left text-sm transition hover:text-accent">
                        <span>
                          {monthName(h.year, h.month, "short")}
                          {h.closed && <Lock className="ml-1.5 inline size-3 text-income" />}
                        </span>
                        <span className="tabular-nums text-muted">{inr(h.closingBalance)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
