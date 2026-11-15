"use client";

import { motion } from "framer-motion";
import { Check, Copy, FileText, Pencil } from "lucide-react";
import { type FormEvent, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { type ResidentHome, updateMyContact } from "@/lib/api";
import { inr, shortDate } from "@/lib/format";
import { Modal } from "./modal";

const STATUS = {
  PAID: { label: "Paid", tone: "bg-income/15 text-income" },
  PARTIAL: { label: "Part paid", tone: "bg-warn/15 text-warn" },
  PENDING: { label: "Due", tone: "bg-foreground/10 text-muted" },
} as const;

export function ResidentHomeView({ home: initial }: { home: ResidentHome }) {
  const [home, setHome] = useState(initial);
  const [editing, setEditing] = useState(false);
  const { flat, payTo } = home;
  const owing = home.outstandingTotal > 0;
  const late = home.overdueAmount > 0;
  const last = home.receipts[0];

  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flat {flat.flatNumber}</h1>
          <p className="text-sm text-muted">{flat.ownerName} · {flat.societyName}</p>
        </div>
        <ThemeToggle />
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    className={`glass p-5 ${late ? "ring-1 ring-expense/40" : ""}`}>
          <p className="text-sm text-muted">You owe</p>
          <p className={`mt-2 text-3xl font-semibold tabular-nums ${late ? "text-expense" : owing ? "text-warn" : "text-income"}`}>
            {inr(home.outstandingTotal)}
          </p>
          <p className="mt-1 text-xs text-muted">
            {late ? `${inr(home.overdueAmount)} is overdue` : owing ? `Please pay by the ${home.dueDay}th` : "You are all paid up"}
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }} className="glass p-5">
          <p className="text-sm text-muted">Monthly maintenance</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{inr(flat.monthlyFee)}</p>
          <p className="mt-1 text-xs text-muted">Due by the {home.dueDay}th of each month</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="glass p-5">
          <p className="text-sm text-muted">Last payment</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{last ? inr(last.amount) : "–"}</p>
          <p className="mt-1 text-xs text-muted">{last ? `${shortDate(last.date)} · ${last.mode}` : "No payments recorded yet"}</p>
        </motion.div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <section className="glass overflow-hidden lg:col-span-3">
          <h2 className="px-5 pt-5 text-sm font-medium">Your maintenance</h2>
          <p className="px-5 pb-3 text-xs text-muted">Latest months first</p>
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
                  <span className="w-24 text-right text-sm font-semibold tabular-nums">
                    {m.status === "PAID" ? inr(m.amount) : inr(m.balance)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <div className="space-y-4 lg:col-span-2">
          <section className="glass p-5">
            <h2 className="mb-3 text-sm font-medium">Your receipts</h2>
            {home.receipts.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">Receipts appear here once the treasurer records a payment</p>
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

          <PayCard payTo={payTo} />

          <section className="glass p-5">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-medium">Your contact details</h2>
              <button onClick={() => setEditing(true)} aria-label="Edit contact details"
                      className="grid size-8 place-items-center rounded-lg text-muted hover:text-foreground">
                <Pencil className="size-4" />
              </button>
            </div>
            <p className="text-sm">{flat.phoneNumber ?? <span className="text-muted">No phone saved</span>}</p>
            <p className="text-sm">{flat.email ?? <span className="text-muted">No email saved</span>}</p>
            <p className="mt-2 text-xs text-muted">The treasurer uses these to send your receipts and reminders.</p>
          </section>
        </div>
      </div>

      <Modal open={editing} onClose={() => setEditing(false)} title="Update contact details">
        {editing && <ContactForm flat={flat} onSaved={(f) => { setHome({ ...home, flat: f }); setEditing(false); }} />}
      </Modal>
    </>
  );
}

function PayCard({ payTo }: { payTo: ResidentHome["payTo"] }) {
  const rows: [string, string | null][] = [
    ["UPI ID", payTo.upiId], ["Pay to", payTo.payeeName ?? payTo.accountName], ["Bank", payTo.bankName],
    ["Account number", payTo.accountNumber], ["IFSC", payTo.ifsc], ["Branch", payTo.branch],
  ];
  const shown = rows.filter(([, v]) => v);
  return (
    <section className="glass p-5">
      <h2 className="mb-3 text-sm font-medium">How to pay</h2>
      {shown.length === 0 ? (
        <p className="text-sm text-muted">Please ask the treasurer for the payment details.</p>
      ) : (
        <dl className="space-y-2">
          {shown.map(([label, value]) => (
            <div key={label} className="flex items-center gap-2 text-sm">
              <dt className="w-28 shrink-0 text-xs text-muted">{label}</dt>
              <dd className="min-w-0 flex-1 truncate font-medium">{value}</dd>
              {["UPI ID", "Account number", "IFSC"].includes(label) && <CopyButton value={value!} />}
            </div>
          ))}
        </dl>
      )}
      <p className="mt-3 text-xs text-muted">After paying, tell the treasurer your transaction reference so your receipt can be issued.</p>
    </section>
  );
}

function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button aria-label="Copy" title="Copy"
            onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ } }}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:text-foreground">
      {done ? <Check className="size-3.5 text-income" /> : <Copy className="size-3.5" />}
    </button>
  );
}

function ContactForm({ flat, onSaved }: { flat: ResidentHome["flat"]; onSaved: (f: ResidentHome["flat"]) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    try {
      onSaved(await updateMyContact(String(f.get("phone") ?? ""), String(f.get("email") ?? "")));
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Mobile number (WhatsApp)</span>
        <input name="phone" defaultValue={flat.phoneNumber ?? ""} inputMode="tel" className="field" placeholder="98765 43210" />
      </label>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Email</span>
        <input name="email" type="email" defaultValue={flat.email ?? ""} className="field" placeholder="you@example.com" />
      </label>
      {err && <p className="text-sm text-expense">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
