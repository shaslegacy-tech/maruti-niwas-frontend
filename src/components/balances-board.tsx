"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Landmark, Lock, Pencil, Wallet } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import {
  type AccountBalance, type BalanceOverview, type OpeningBalance, type Reconciliation,
  getBalanceOverview, getReconciliation, reconcile, saveOpeningBalance,
} from "@/lib/api";
import { inr, shortDate } from "@/lib/format";

const monthName = (y: number, m: number) =>
  new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
/** Indian financial year starts on 1 April. */
const fyStart = (y: number, m: number) => (m >= 4 ? `${y}-04` : `${y - 1}-04`);

interface Props { initialOverview: BalanceOverview; initialRec: Reconciliation; initialYear: number; initialMonth: number }

export function BalancesBoard({ initialOverview, initialRec, initialYear, initialMonth }: Props) {
  const [overview, setOverview] = useState(initialOverview);
  const [rec, setRec] = useState(initialRec);
  const [ym, setYm] = useState({ y: initialYear, m: initialMonth });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // verification form
  const seed = (r: Reconciliation) => ({
    cash: String(r.verification?.actualCash ?? r.statement.closing.cash),
    bank: String(r.verification?.actualBank ?? r.statement.closing.bank),
  });
  const [actual, setActual] = useState(seed(initialRec));
  const [note, setNote] = useState(initialRec.verification?.note ?? "");
  const [reason, setReason] = useState("");

  // opening balance form
  const [open, setOpen] = useState({ month: fyStart(initialYear, initialMonth), cash: "", bank: "", note: "" });

  const isCurrent = ym.y === initialYear && ym.m === initialMonth;

  const load = useCallback(async (y: number, m: number) => {
    setLoading(true); setError(null);
    try {
      const [o, r] = await Promise.all([getBalanceOverview(), getReconciliation(y, m)]);
      setOverview(o); setRec(r);
      setActual(seed(r)); setNote(r.verification?.note ?? ""); setReason("");
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  function go(delta: number) {
    const d = new Date(ym.y, ym.m - 1 + delta, 1);
    const next = { y: d.getFullYear(), m: d.getMonth() + 1 };
    setYm(next); setNotice(null); load(next.y, next.m);
  }

  async function verify(postAdjustments: boolean) {
    setLoading(true); setError(null); setNotice(null);
    try {
      await reconcile(ym.y, ym.m, {
        actualCash: Number(actual.cash), actualBank: Number(actual.bank),
        note: note || undefined, postAdjustments, reason: reason || undefined,
      });
      await load(ym.y, ym.m);
      setNotice(postAdjustments ? "Verified and books adjusted" : "Verified");
    } catch (e) { setError((e as Error).message); setLoading(false); }
  }

  async function saveOpening() {
    setLoading(true); setError(null); setNotice(null);
    try {
      await saveOpeningBalance({
        asOf: `${open.month}-01`, cash: Number(open.cash || 0), bank: Number(open.bank || 0), note: open.note || undefined,
      });
      await load(ym.y, ym.m);
      setNotice("Opening balance saved");
    } catch (e) { setError((e as Error).message); setLoading(false); }
  }

  const st = rec.statement;
  const dCash = round2(Number(actual.cash) - st.closing.cash);
  const dBank = round2(Number(actual.bank) - st.closing.bank);
  const differs = dCash !== 0 || dBank !== 0;
  const v = rec.verification;

  const rows: [string, AccountBalance, boolean][] = [
    ["Opening balance", st.opening, false],
    ["+ Maintenance received", st.maintenance, false],
    ["+ Other income", st.otherIncome, false],
    ["− Expenses", st.expenses, false],
    ["± Adjustments", st.adjustments, false],
    ["Expected closing", st.closing, true],
  ];

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Balances</h1>
          <p className="text-sm text-muted">Cash in hand and bank, opening balances and month-end reconciliation</p>
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

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Tile icon={<Wallet className="size-4" />} label="Cash in hand" value={overview.current.cash} />
        <Tile icon={<Landmark className="size-4" />} label="Bank account" value={overview.current.bank} />
        <Tile label="Total now" value={overview.current.total} strong />
      </div>

      {error && <p className="mb-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}
      {notice && <p className="mb-3 rounded-lg bg-income/10 px-3 py-2 text-sm text-income">{notice}</p>}

      <div className={`grid gap-4 lg:grid-cols-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
        <div className="space-y-4 lg:col-span-3">
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass p-5">
            <h2 className="mb-3 text-sm font-medium">{monthName(ym.y, ym.m)} statement</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="pb-2 font-normal" /><th className="pb-2 text-right font-normal">Cash</th>
                    <th className="pb-2 text-right font-normal">Bank</th><th className="pb-2 text-right font-normal">Total</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {rows.map(([label, b, strong]) => (
                    <tr key={label} className={strong ? "border-t border-border font-semibold" : ""}>
                      <td className="py-1.5 pr-2">{label}</td>
                      <td className="py-1.5 text-right">{inr(b.cash)}</td>
                      <td className="py-1.5 text-right">{inr(b.bank)}</td>
                      <td className="py-1.5 text-right">{inr(b.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="glass p-5">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h2 className="text-sm font-medium">Verify closing balance</h2>
              {rec.monthClosed && (
                <span className="flex items-center gap-1 rounded-full bg-income/15 px-2 py-0.5 text-[11px] font-medium text-income">
                  <Lock className="size-3" />Month closed
                </span>
              )}
            </div>
            <p className="mb-4 text-xs text-muted">
              Count the cash and read the bank balance from your passbook or app, then compare with the books.
            </p>

            {v && (
              <div className={`mb-4 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                v.status === "VARIANCE" ? "bg-warn/10 text-warn" : "bg-income/10 text-income"}`}>
                {v.status === "VARIANCE" ? <AlertTriangle className="mt-0.5 size-3.5 shrink-0" /> : <Check className="mt-0.5 size-3.5 shrink-0" />}
                <span>
                  {v.status === "MATCHED" && "Books matched the counted balances. "}
                  {v.status === "ADJUSTED" && "Books were adjusted to match. "}
                  {v.status === "VARIANCE" && `A difference was left open (cash ${inr(v.differenceCash)}, bank ${inr(v.differenceBank)}). `}
                  Verified by {v.verifiedBy} on {new Date(v.verifiedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-muted">
                <span className="mb-1 block">Cash counted (₹)</span>
                <input type="number" step="0.01" value={actual.cash} disabled={rec.monthClosed}
                       onChange={(e) => setActual({ ...actual, cash: e.target.value })} className="field" />
              </label>
              <label className="block text-xs text-muted">
                <span className="mb-1 block">Bank balance (₹)</span>
                <input type="number" step="0.01" value={actual.bank} disabled={rec.monthClosed}
                       onChange={(e) => setActual({ ...actual, bank: e.target.value })} className="field" />
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Diff label="Cash" d={dCash} /><Diff label="Bank" d={dBank} />
            </div>

            <label className="mt-3 block text-xs text-muted">
              <span className="mb-1 block">Note (optional)</span>
              <input value={note} disabled={rec.monthClosed} onChange={(e) => setNote(e.target.value)} className="field" />
            </label>

            {differs && !rec.monthClosed && (
              <label className="mt-3 block text-xs text-muted">
                <span className="mb-1 block">Reason for the difference (required to adjust the books)</span>
                <input value={reason} onChange={(e) => setReason(e.target.value)} className="field"
                       placeholder="e.g. Petty cash spent without a bill" />
              </label>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              <button disabled={rec.monthClosed || loading} onClick={() => verify(false)}
                      className="rounded-lg bg-foreground/8 px-4 py-2 text-sm font-medium transition hover:bg-foreground/12 disabled:opacity-50">
                {differs ? "Verify, leave difference open" : "Mark as verified"}
              </button>
              {differs && (
                <button disabled={rec.monthClosed || loading || !reason.trim()} onClick={() => verify(true)}
                        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50">
                  Verify &amp; adjust books
                </button>
              )}
            </div>
            {rec.adjustments.length > 0 && (
              <p className="mt-3 text-[11px] text-muted">{rec.adjustments.length} adjustment(s) already posted for this month (see Audit log).</p>
            )}
          </motion.section>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="glass p-5">
            <h2 className="mb-1 text-sm font-medium">Opening balances</h2>
            <p className="mb-3 text-xs text-muted">
              Cash and bank on the 1st of a month, usually the start of the financial year (1 April). Balances are counted forward from the latest one.
            </p>

            {overview.openings.length > 0 && (
              <ul className="mb-4 divide-y divide-border">
                {overview.openings.map((o: OpeningBalance) => (
                  <li key={o.id} className="flex items-center gap-2 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{monthName(Number(o.asOf.slice(0, 4)), Number(o.asOf.slice(5, 7)))}</p>
                      <p className="text-xs text-muted">Cash {inr(o.cash)} · Bank {inr(o.bank)}</p>
                    </div>
                    <button aria-label="Edit" title="Edit"
                            onClick={() => setOpen({ month: o.asOf.slice(0, 7), cash: String(o.cash), bank: String(o.bank), note: o.note ?? "" })}
                            className="grid size-8 place-items-center rounded-lg text-muted hover:text-foreground">
                      <Pencil className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="space-y-3">
              <label className="block text-xs text-muted">
                <span className="mb-1 block">Month (1st)</span>
                <input type="month" value={open.month} onChange={(e) => setOpen({ ...open, month: e.target.value })} className="field" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-muted">
                  <span className="mb-1 block">Cash in hand (₹)</span>
                  <input type="number" step="0.01" value={open.cash} onChange={(e) => setOpen({ ...open, cash: e.target.value })} className="field" />
                </label>
                <label className="block text-xs text-muted">
                  <span className="mb-1 block">Bank balance (₹)</span>
                  <input type="number" step="0.01" value={open.bank} onChange={(e) => setOpen({ ...open, bank: e.target.value })} className="field" />
                </label>
              </div>
              <label className="block text-xs text-muted">
                <span className="mb-1 block">Note (optional)</span>
                <input value={open.note} onChange={(e) => setOpen({ ...open, note: e.target.value })} className="field" placeholder="e.g. Carried forward from FY 2025-26" />
              </label>
              <button onClick={saveOpening} disabled={loading || !open.month}
                      className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50">
                Save opening balance
              </button>
            </div>
          </motion.section>

          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className="glass p-5">
            <h2 className="mb-3 text-sm font-medium">Recent adjustments</h2>
            {overview.adjustments.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted">None. The books have never needed correcting.</p>
            ) : (
              <ul className="divide-y divide-border">
                {overview.adjustments.map((a) => (
                  <li key={a.id} className="py-2.5 text-sm">
                    <div className="flex items-center justify-between">
                      <span>{a.account === "CASH" ? "Cash" : "Bank"} · {shortDate(a.date)}</span>
                      <span className={`font-semibold tabular-nums ${a.amount < 0 ? "text-expense" : "text-income"}`}>
                        {a.amount < 0 ? "−" : "+"}{inr(Math.abs(a.amount))}
                      </span>
                    </div>
                    <p className="text-xs text-muted">{a.reason} · {a.createdBy}</p>
                  </li>
                ))}
              </ul>
            )}
          </motion.section>
        </div>
      </div>
    </>
  );
}

function Tile({ label, value, icon, strong }: { label: string; value: number; icon?: ReactNode; strong?: boolean }) {
  return (
    <div className={`glass px-4 py-3 ${strong ? "ring-1 ring-accent/40" : ""}`}>
      <p className="flex items-center gap-1.5 text-xs text-muted">{icon}{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${strong ? "text-accent" : ""}`}>{inr(value)}</p>
    </div>
  );
}

function Diff({ label, d }: { label: string; d: number }) {
  const tone = d === 0 ? "bg-income/10 text-income" : "bg-warn/10 text-warn";
  return (
    <span className={`rounded-full px-2.5 py-1 font-medium ${tone}`}>
      {label}: {d === 0 ? "matches" : `${d > 0 ? "+" : "−"}${inr(Math.abs(d))} vs books`}
    </span>
  );
}
