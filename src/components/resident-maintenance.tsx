"use client";

import { motion } from "framer-motion";
import { FileText, Paperclip } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { type PaymentMode, type ResidentClaim, type ResidentHome, cancelMyClaim, submitPaymentProof } from "@/lib/api";
import { inr, shortDate } from "@/lib/format";
import { prepareProof } from "@/lib/image";
import { Modal } from "./modal";
import { CLAIM_STATUS, MODE, PayCard, STATUS } from "./resident-shared";

const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export function ResidentMaintenance({ home: initial }: { home: ResidentHome }) {
  const [home, setHome] = useState(initial);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const owing = home.outstandingTotal > 0;
  const late = home.overdueAmount > 0;
  const pendingMonths = home.months.filter((m) => m.balance > 0);

  async function cancel(c: ResidentClaim) {
    if (!confirm(`Withdraw your ${inr(c.amount)} payment details?`)) return;
    setError(null);
    try {
      await cancelMyClaim(c.id);
      setHome({ ...home, claims: home.claims.map((x) => (x.id === c.id ? { ...x, status: "CANCELLED" } : x)) });
    } catch (e) { setError((e as Error).message); }
  }

  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Maintenance</h1>
          <p className="text-sm text-muted">Flat {home.flat.flatNumber} · {inr(home.flat.monthlyFee)} a month, due by the {home.dueDay}th</p>
        </div>
        <ThemeToggle />
      </header>

      {notice && <p className="mb-3 rounded-lg bg-income/10 px-3 py-2 text-sm text-income">{notice}</p>}
      {error && <p className="mb-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Pending amount" value={inr(home.outstandingTotal)} tone={late ? "text-expense" : owing ? "text-warn" : "text-income"}
              hint={late ? `${inr(home.overdueAmount)} is overdue` : owing ? "Not yet overdue" : "You are all paid up"} />
        <Tile label="Pending months" value={String(pendingMonths.length)}
              hint={pendingMonths.length ? `Oldest: ${pendingMonths[pendingMonths.length - 1].label}` : "None"} />
        <Tile label={`Paid ${home.yearLabel}`} value={inr(home.paidThisYear)} tone="text-income" hint="Recorded by the treasurer" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <section className="glass overflow-hidden">
            <h2 className="px-5 pt-5 text-sm font-medium">Your months</h2>
            <p className="px-5 pb-3 text-xs text-muted">Latest first</p>
            {home.months.length === 0 && <p className="p-8 text-center text-sm text-muted">Nothing here yet</p>}
            <ul className="divide-y divide-border">
              {home.months.map((m) => {
                const st = m.overdue ? { label: "Overdue", tone: "bg-expense/15 text-expense" } : STATUS[m.status];
                return (
                  <li key={`${m.year}-${m.month}`} className="flex items-center gap-3 px-5 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{m.label}</p>
                      <p className="text-xs text-muted">
                        {m.status === "PAID" && m.paymentDate ? `Paid on ${shortDate(m.paymentDate)}` : `Due by ${shortDate(m.dueDate)}`}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.tone}`}>{st.label}</span>
                    <span className="w-24 text-right text-sm font-semibold tabular-nums">{m.status === "PAID" ? inr(m.amount) : inr(m.balance)}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="glass p-5">
            <h2 className="mb-3 text-sm font-medium">Your receipts</h2>
            {home.receipts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Receipts appear here once your payment is recorded</p>
            ) : (
              <ul className="divide-y divide-border">
                {home.receipts.map((r) => (
                  <li key={r.receiptNumber} className="flex items-center gap-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.receiptNumber} · {inr(r.amount)}</p>
                      <p className="truncate text-xs text-muted">{r.periods} · {shortDate(r.date)} · {r.mode}</p>
                    </div>
                    <a href={r.receiptPath} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1.5 rounded-lg bg-accent/12 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20">
                      <FileText className="size-3.5" />PDF
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <PayCard payTo={home.payTo} />

          <section className="glass p-5">
            <h2 className="mb-1 text-sm font-medium">Already paid?</h2>
            <p className="mb-3 text-xs text-muted">
              Send your transaction reference and a screenshot. The treasurer checks it against the bank and issues your receipt.
              Nothing changes in your account until then.
            </p>
            <button onClick={() => { setNotice(null); setSending(true); }}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition hover:opacity-90">
              I have paid
            </button>
          </section>

          {home.claims.length > 0 && (
            <section className="glass p-5">
              <h2 className="mb-3 text-sm font-medium">Your payment details sent</h2>
              <ul className="divide-y divide-border">
                {home.claims.map((c) => (
                  <li key={c.id} className="py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium tabular-nums">{inr(c.amount)} · {MODE[c.mode] ?? c.mode}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${CLAIM_STATUS[c.status].tone}`}>{CLAIM_STATUS[c.status].label}</span>
                    </div>
                    <p className="text-xs text-muted">
                      Paid {shortDate(c.paidOn)}{c.reference ? ` · ${c.reference}` : ""}{c.hasProof ? " · screenshot attached" : ""}
                    </p>
                    {c.status === "APPROVED" && c.receiptNumber && <p className="mt-1 text-xs text-income">Receipt {c.receiptNumber} issued</p>}
                    {c.status === "REJECTED" && c.reviewNote && <p className="mt-1 text-xs text-expense">Reason: {c.reviewNote}</p>}
                    {c.status === "PENDING" && (
                      <button onClick={() => cancel(c)} className="mt-1 text-xs text-muted underline hover:text-foreground">Withdraw</button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>

      <Modal open={sending} onClose={() => setSending(false)} title="I have paid">
        {sending && (
          <ProofForm defaultAmount={home.outstandingTotal}
                     onSent={(c) => {
                       setHome({ ...home, claims: [c, ...home.claims] });
                       setSending(false);
                       setNotice("Sent. The treasurer will check it against the bank and your receipt will appear here.");
                     }} />
        )}
      </Modal>
    </>
  );
}

function Tile({ label, value, tone = "", hint }: { label: string; value: string; tone?: string; hint: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-[11px] text-muted">{hint}</p>
    </motion.div>
  );
}

function ProofForm({ defaultAmount, onSent }: { defaultAmount: number; onSent: (c: ResidentClaim) => void }) {
  const [mode, setMode] = useState<PaymentMode>("UPI");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    try {
      const body = new FormData();
      body.set("amount", String(f.get("amount")));
      body.set("paidOn", String(f.get("paidOn")));
      body.set("mode", mode);
      body.set("reference", String(f.get("reference") ?? ""));
      body.set("note", String(f.get("note") ?? ""));
      if (file) body.set("proof", await prepareProof(file));
      onSent(await submitPaymentProof(body));
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Amount you paid (₹)</span>
          <input name="amount" type="number" step="0.01" min="1" required defaultValue={defaultAmount > 0 ? defaultAmount : undefined} className="field" />
        </label>
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Date paid</span>
          <input name="paidOn" type="date" required max={todayISO()} defaultValue={todayISO()} className="field" />
        </label>
      </div>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">How did you pay?</span>
        <select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)} className="field">
          <option value="UPI">UPI</option><option value="BANK_TRANSFER">Bank transfer</option><option value="CASH">Cash (handed to the treasurer)</option>
        </select>
      </label>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">{mode === "CASH" ? "Reference (optional)" : "Transaction reference (UTR / transaction ID)"}</span>
        <input name="reference" required={mode !== "CASH"} minLength={mode === "CASH" ? undefined : 4} className="field" placeholder="e.g. 412345678901" />
      </label>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Screenshot or PDF (optional)</span>
        <span className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2.5 text-sm">
          <Paperclip className="size-4 shrink-0" />
          <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                 className="min-w-0 flex-1 text-xs" />
        </span>
      </label>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Note for the treasurer (optional)</span>
        <input name="note" maxLength={300} className="field" placeholder="e.g. includes September" />
      </label>
      {err && <p className="text-sm text-expense">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Sending…" : "Send to treasurer"}
      </button>
    </form>
  );
}
