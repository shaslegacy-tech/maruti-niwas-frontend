"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";
import {
  type Account, type Categories, type Transaction, type TxType,
  createTransaction, deleteTransaction, getTransactions, updateTransaction,
} from "@/lib/api";
import { inr, shortDate } from "@/lib/format";
import { Modal } from "./modal";

const monthName = (y: number, m: number) =>
  new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
const pad = (n: number) => String(n).padStart(2, "0");

interface Props {
  initialTxns: Transaction[]; categories: Categories; initialYear: number; initialMonth: number; today: string;
}

export function LedgerBoard({ initialTxns, categories, initialYear, initialMonth, today }: Props) {
  const [txns, setTxns] = useState(initialTxns);
  const [ym, setYm] = useState({ y: initialYear, m: initialMonth });
  const [filter, setFilter] = useState<"ALL" | TxType>("ALL");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | "new" | null>(null);

  const isCurrent = ym.y === initialYear && ym.m === initialMonth;

  const reload = useCallback(async (y: number, m: number) => {
    setLoading(true); setError(null);
    try { setTxns(await getTransactions(y, m)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  function go(delta: number) {
    const d = new Date(ym.y, ym.m - 1 + delta, 1);
    const next = { y: d.getFullYear(), m: d.getMonth() + 1 };
    setYm(next); reload(next.y, next.m);
  }

  async function remove(t: Transaction) {
    if (!confirm(`Delete ${t.category} · ${inr(t.amount)}?`)) return;
    try { await deleteTransaction(t.id); await reload(ym.y, ym.m); }
    catch (e) { setError((e as Error).message); }
  }

  const income = txns.filter((t) => t.type === "INCOME").reduce((s, t) => s + t.amount, 0);
  const expense = txns.filter((t) => t.type === "EXPENSE").reduce((s, t) => s + t.amount, 0);
  const shown = filter === "ALL" ? txns : txns.filter((t) => t.type === filter);
  const defaultDate = isCurrent ? today : `${ym.y}-${pad(ym.m)}-${pad(new Date(ym.y, ym.m, 0).getDate())}`;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ledger</h1>
          <p className="text-sm text-muted">Expenses and other income · flat maintenance is on the Flats page</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="glass flex items-center gap-1 p-1">
            <button onClick={() => go(-1)} aria-label="Previous month" className="grid size-8 place-items-center rounded-lg text-muted hover:text-foreground">
              <ChevronLeft className="size-4" />
            </button>
            <span className="min-w-32 text-center text-sm font-medium">{monthName(ym.y, ym.m)}</span>
            <button onClick={() => go(1)} disabled={isCurrent} aria-label="Next month"
                    className="grid size-8 place-items-center rounded-lg text-muted hover:text-foreground disabled:opacity-30">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <button onClick={() => setEditing("new")}
                  className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
            <Plus className="size-4" />Add entry
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Stat label="Other income" value={inr(income)} tone="text-income" />
        <Stat label="Expenses" value={inr(expense)} tone="text-expense" />
        <Stat label="Net" value={inr(income - expense)} tone={income - expense < 0 ? "text-expense" : ""} />
      </div>

      <div className="mb-3 flex gap-1.5">
        {(["ALL", "EXPENSE", "INCOME"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                    filter === f ? "bg-accent text-white" : "glass text-muted hover:text-foreground"}`}>
            {f === "ALL" ? "All" : f === "EXPENSE" ? "Expenses" : "Income"}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}

      <section className={`glass overflow-hidden transition-opacity ${loading ? "opacity-60" : ""}`}>
        {shown.length === 0 && <p className="p-10 text-center text-sm text-muted">No entries for this month</p>}
        <ul className="divide-y divide-border">
          <AnimatePresence initial={false}>
            {shown.map((t) => {
              const inc = t.type === "INCOME";
              const Icon = inc ? ArrowDownLeft : ArrowUpRight;
              const who = inc ? t.paidBy : t.paidTo;
              return (
                <motion.li key={t.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                           exit={{ opacity: 0, x: -20 }} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                  <span className={`grid size-10 shrink-0 place-items-center rounded-full ${inc ? "bg-income/15 text-income" : "bg-expense/15 text-expense"}`}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.category}{who && <span className="font-normal text-muted"> · {who}</span>}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      <span>{shortDate(t.date)} · {t.account === "CASH" ? "Cash" : "Bank"}</span>
                      {t.description && <span className="truncate">{t.description}</span>}
                      {t.receiptRef && (
                        <span className="inline-flex items-center gap-1 rounded bg-foreground/8 px-1.5 py-0.5">
                          <FileText className="size-3" />{t.receiptRef}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className={`text-sm font-semibold tabular-nums ${inc ? "text-income" : "text-expense"}`}>
                    {inc ? "+" : "−"}{inr(t.amount)}
                  </span>
                  <button onClick={() => setEditing(t)} aria-label="Edit" className="grid size-8 place-items-center rounded-lg text-muted hover:text-foreground">
                    <Pencil className="size-4" />
                  </button>
                  <button onClick={() => remove(t)} aria-label="Delete" className="grid size-8 place-items-center rounded-lg text-muted hover:text-expense">
                    <Trash2 className="size-4" />
                  </button>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </section>

      <Modal open={editing !== null} onClose={() => setEditing(null)}
             title={editing === "new" ? "Add entry" : "Edit entry"}>
        {editing !== null && (
          <TxForm initial={editing === "new" ? null : editing} categories={categories} defaultDate={defaultDate}
                  onSaved={() => { setEditing(null); reload(ym.y, ym.m); }} />
        )}
      </Modal>
    </>
  );
}

function Stat({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="glass px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs text-muted"><span className="mb-1 block">{label}</span>{children}</label>;
}

function TxForm({ initial, categories, defaultDate, onSaved }: {
  initial: Transaction | null; categories: Categories; defaultDate: string; onSaved: () => void;
}) {
  const [type, setType] = useState<TxType>(initial?.type ?? "EXPENSE");
  const [account, setAccount] = useState<Account>(initial?.account ?? "BANK");
  const list = type === "EXPENSE" ? categories.expense : categories.income;
  const known = !initial || list.includes(initial.category);
  const [cat, setCat] = useState(initial ? (known ? initial.category : "Others") : list[0]);
  const [custom, setCustom] = useState(initial && !known ? initial.category : "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function switchType(t: TxType) {
    setType(t);
    setCat((t === "EXPENSE" ? categories.expense : categories.income)[0]);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const who = String(f.get("who") || "");
    const body = {
      type,
      account,
      category: cat === "Others" && custom.trim() ? custom.trim() : cat,
      amount: Number(f.get("amount")),
      date: String(f.get("date")),
      paidTo: type === "EXPENSE" ? who : undefined,
      paidBy: type === "INCOME" ? who : undefined,
      description: String(f.get("desc") || ""),
      receiptRef: String(f.get("receipt") || ""),
    };
    setBusy(true); setErr(null);
    try {
      if (initial) await updateTransaction(initial.id, body); else await createTransaction(body);
      onSaved();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-foreground/6 p-1">
        {(["EXPENSE", "INCOME"] as const).map((t) => (
          <button type="button" key={t} onClick={() => switchType(t)}
                  className={`rounded-lg py-1.5 text-sm font-medium transition ${
                    type === t ? (t === "EXPENSE" ? "bg-expense text-white" : "bg-income text-white") : "text-muted"}`}>
            {t === "EXPENSE" ? "Expense" : "Income"}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (₹)"><input name="amount" type="number" step="0.01" min="0.01" defaultValue={initial?.amount} required className="field" autoFocus /></Field>
        <Field label="Date"><input name="date" type="date" defaultValue={initial?.date ?? defaultDate} required className="field" /></Field>
      </div>
      <Field label={type === "EXPENSE" ? "Paid from" : "Received in"}>
        <select value={account} onChange={(e) => setAccount(e.target.value as Account)} className="field">
          <option value="BANK">Bank (UPI, transfer, cheque)</option>
          <option value="CASH">Cash in hand</option>
        </select>
      </Field>
      <Field label="Category">
        <select value={cat} onChange={(e) => setCat(e.target.value)} className="field">
          {list.map((c) => <option key={c}>{c}</option>)}
        </select>
      </Field>
      {cat === "Others" && (
        <Field label="Custom category (optional)">
          <input value={custom} onChange={(e) => setCustom(e.target.value)} className="field" placeholder="e.g. Painting, Plumber" />
        </Field>
      )}
      <Field label={type === "EXPENSE" ? "Paid to" : "Received from"}>
        <input name="who" defaultValue={(type === "EXPENSE" ? initial?.paidTo : initial?.paidBy) ?? ""} className="field" />
      </Field>
      <Field label="Description"><input name="desc" defaultValue={initial?.description ?? ""} className="field" /></Field>
      <Field label="Bill / receipt reference"><input name="receipt" defaultValue={initial?.receiptRef ?? ""} className="field" placeholder="Bill no. or link" /></Field>
      {err && <p className="text-sm text-expense">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Saving…" : initial ? "Save changes" : "Add entry"}
      </button>
    </form>
  );
}
