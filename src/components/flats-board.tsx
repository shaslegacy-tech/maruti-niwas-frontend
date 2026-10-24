"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, FileText, MessageCircle, Pencil, Undo2, Wallet } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  type Flat, type FlatPaymentResult, type LineKind, type Maintenance, type OccupantType, type PaymentInfo, type PaymentMode, type PaymentPlan,
  getFlats, getMaintenance, getPaymentPlan, markReceiptShared, payFlat, resetPayment, updateFlat,
} from "@/lib/api";
import { inr, shortDate } from "@/lib/format";
import { prepareReceiptFile, shareReceipt } from "@/lib/share";
import { Modal } from "./modal";

const BADGE = {
  PAID: "bg-income/15 text-income",
  PARTIAL: "bg-warn/15 text-warn",
  PENDING: "bg-expense/15 text-expense",
} as const;
const MODE: Record<PaymentMode, string> = { UPI: "UPI", CASH: "Cash", BANK_TRANSFER: "Bank transfer" };
const todayISO = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
const monthName = (y: number, m: number) =>
  new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

interface Props {
  initialFlats: Flat[]; initialRecords: Maintenance[]; initialYear: number; initialMonth: number;
}

export function FlatsBoard({ initialFlats, initialRecords, initialYear, initialMonth }: Props) {
  const [flats, setFlats] = useState(initialFlats);
  const [records, setRecords] = useState(initialRecords);
  const [ym, setYm] = useState({ y: initialYear, m: initialMonth });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<Maintenance | null>(null);
  const [editing, setEditing] = useState<Flat | null>(null);

  const isCurrent = ym.y === initialYear && ym.m === initialMonth;

  const reload = useCallback(async (y: number, m: number) => {
    setLoading(true); setError(null);
    try {
      const [r, f] = await Promise.all([getMaintenance(y, m), getFlats()]);
      setRecords(r); setFlats(f);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  function go(delta: number) {
    const d = new Date(ym.y, ym.m - 1 + delta, 1);
    const next = { y: d.getFullYear(), m: d.getMonth() + 1 };
    setYm(next); reload(next.y, next.m);
  }

  async function undo(r: Maintenance) {
    const multi = r.payments.find((p) => p.periods.includes("–") || p.periods.includes(","));
    const question = multi
      ? `Clear receipt ${multi.receiptNumber}? It covers ${multi.periods}, so the payment for every one of those months will be cleared.`
      : `Clear all payments for Flat ${r.flatNumber}?`;
    if (!confirm(question)) return;
    try { await resetPayment(r.id); await reload(ym.y, ym.m); } catch (e) { setError((e as Error).message); }
  }

  const paid = records.filter((r) => r.status === "PAID").length;
  const partial = records.filter((r) => r.status === "PARTIAL").length;
  const due = records.reduce((s, r) => s + r.balanceDue, 0);
  const flatById = new Map(flats.map((f) => [f.id, f]));

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Flats</h1>
          <p className="text-sm text-muted">Monthly maintenance · {inr(records[0]?.amount ?? 1500)} per flat</p>
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
        <Summary label="Paid" value={`${paid}/${records.length}`} tone="text-income" />
        <Summary label="Partial" value={String(partial)} tone="text-warn" />
        <Summary label="Still to collect" value={inr(due)} tone="text-expense" />
      </div>

      {error && <p className="mb-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}

      <section className={`glass overflow-hidden transition-opacity ${loading ? "opacity-60" : ""}`}>
        {records.length === 0 && <p className="p-10 text-center text-sm text-muted">No dues for this month</p>}
        <ul className="divide-y divide-border">
          <AnimatePresence initial={false}>
            {records.map((r, i) => (
              <motion.li key={r.id} layout
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/12 text-sm font-semibold text-accent">
                  {r.flatNumber}
                </span>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate text-sm font-medium">{r.ownerName}</p>
                  <p className="truncate text-xs text-muted">{r.phoneNumber ?? "No phone saved"}</p>
                </div>
                <div className="text-right">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE[r.status]}`}>
                    {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                  </span>
                  <p className="mt-1 text-sm font-semibold tabular-nums">
                    {r.status === "PAID" ? inr(r.amount) : `${inr(r.balanceDue)} due`}
                  </p>
                </div>
                <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                  {r.status !== "PAID" ? (
                    <>
                      <button onClick={() => setPaying(r)}
                              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90">
                        <Wallet className="size-3.5" />Record payment
                      </button>
                      {r.whatsappReminderUrl ? (
                        <a href={r.whatsappReminderUrl} target="_blank" rel="noopener noreferrer"
                           className="flex items-center gap-1.5 rounded-lg bg-income/15 px-3 py-1.5 text-xs font-medium text-income transition hover:bg-income/25">
                          <MessageCircle className="size-3.5" />Remind
                        </a>
                      ) : (
                        <button disabled title="Add a phone number first"
                                className="flex items-center gap-1.5 rounded-lg bg-foreground/5 px-3 py-1.5 text-xs text-muted opacity-60">
                          <MessageCircle className="size-3.5" />Remind
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-xs text-muted">
                      {r.paymentMode && MODE[r.paymentMode]}{r.paymentDate && ` · ${shortDate(r.paymentDate)}`}
                    </span>
                  )}
                  {r.amountPaid > 0 && (
                    <button onClick={() => undo(r)} aria-label="Undo payment" title="Undo payment"
                            className="grid size-8 place-items-center rounded-lg text-muted hover:text-foreground">
                      <Undo2 className="size-4" />
                    </button>
                  )}
                  <button onClick={() => { const f = flatById.get(r.flatId); if (f) setEditing(f); }}
                          aria-label="Edit flat" title="Edit owner & phone"
                          className="grid size-8 place-items-center rounded-lg text-muted hover:text-foreground">
                    <Pencil className="size-4" />
                  </button>
                </div>
                {r.payments.length > 0 && (
                  <div className="flex w-full flex-col gap-1.5 sm:pl-[3.75rem]">
                    {r.payments.map((p) => (
                      <ReceiptChip key={p.id} p={p} onChanged={() => reload(ym.y, ym.m)} />
                    ))}
                  </div>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </section>

      <PaymentModal record={paying} onClose={() => setPaying(null)} onChanged={() => reload(ym.y, ym.m)} />
      <EditModal flat={editing} onClose={() => setEditing(null)}
                 onSaved={() => { setEditing(null); reload(ym.y, ym.m); }} />
    </>
  );
}

function Summary({ label, value, tone }: { label: string; value: string; tone: string }) {
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

const KIND: Record<LineKind, { label: string; tone: string }> = {
  ARREARS: { label: "Previous", tone: "bg-warn/15 text-warn" },
  CURRENT: { label: "This month", tone: "bg-accent/15 text-accent" },
  ADVANCE: { label: "Advance", tone: "bg-income/15 text-income" },
};

function PaymentModal({ record, onClose, onChanged }: {
  record: Maintenance | null; onClose: () => void; onChanged: () => void;
}) {
  return (
    <Modal open={!!record} onClose={onClose} title={record ? `Receive payment · Flat ${record.flatNumber}` : ""}>
      {record && <PayForm key={record.id} record={record} onClose={onClose} onChanged={onChanged} />}
    </Modal>
  );
}

/**
 * One payment, one receipt, any number of months. Oldest dues are settled first; anything above what is due
 * becomes advance payment. The preview comes from the server, so it always matches what will be saved.
 */
function PayForm({ record, onClose, onChanged }: { record: Maintenance; onClose: () => void; onChanged: () => void }) {
  const [amount, setAmount] = useState("");
  const [onlyThis, setOnlyThis] = useState(false);
  const [mode, setMode] = useState<PaymentMode>("UPI");
  const [date, setDate] = useState(todayISO());
  const [ref, setRef] = useState("");
  const [plan, setPlan] = useState<PaymentPlan | null>(null);
  const [planErr, setPlanErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<FlatPaymentResult | null>(null);
  const latest = useRef(0);
  const needDefault = useRef(true);        // fill the amount with what is due, but only the first time

  useEffect(() => {
    const call = ++latest.current;
    const wanted = amount.trim() === "" ? undefined : Number(amount);
    if (wanted === undefined && !needDefault.current) { setPlan(null); setPlanErr(null); return; }
    if (wanted !== undefined && !(wanted > 0)) { setPlan(null); setPlanErr(null); return; }

    const timer = setTimeout(async () => {
      try {
        const p = await getPaymentPlan(record.flatId, wanted, onlyThis ? record.id : undefined);
        if (call !== latest.current) return;          // a newer request is already on its way
        setPlan(p);
        setPlanErr(null);
        if (wanted === undefined) { needDefault.current = false; setAmount(String(p.amount)); }
      } catch (e) {
        if (call !== latest.current) return;
        setPlan(null);
        setPlanErr((e as Error).message);
      }
    }, wanted === undefined ? 0 : 350);
    return () => clearTimeout(timer);
  }, [amount, onlyThis, record.flatId, record.id]);

  function toggleOnly(value: boolean) {
    needDefault.current = true;
    setOnlyThis(value);
    setAmount("");
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await payFlat({
        flatId: record.flatId, amount: Number(amount), paymentMode: mode, paymentDate: date,
        transactionRef: ref.trim() || undefined, onlyRecordId: onlyThis ? record.id : undefined,
      });
      setResult(res);
      onChanged();                                     // refresh the list behind the dialog
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (result) return <PaidView result={result} onClose={onClose} />;

  const thisMonth = new Date(record.year, record.month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted">{record.ownerName}</p>

      {plan && plan.outstanding.length > 0 && (
        <div className="rounded-lg bg-foreground/5 p-3 text-xs">
          <p className="mb-1.5 text-muted">Outstanding <b className="text-foreground">{inr(plan.outstandingTotal)}</b></p>
          <div className="flex flex-wrap gap-1.5">
            {plan.outstanding.map((d) => (
              <span key={d.recordId} className="rounded-md bg-warn/10 px-2 py-0.5 tabular-nums text-warn">
                {d.label} · {inr(d.balance)}
              </span>
            ))}
          </div>
        </div>
      )}

      <Field label="Amount received (₹)">
        <input type="number" step="0.01" min="0.01" required value={amount}
               onChange={(e) => setAmount(e.target.value)} className="field" autoFocus />
      </Field>

      {(plan?.hasArrears || onlyThis) && (
        <label className="flex items-start gap-2 text-xs text-muted">
          <input type="checkbox" checked={onlyThis} onChange={(e) => toggleOnly(e.target.checked)} className="mt-0.5" />
          <span>Apply to {thisMonth} only (earlier dues stay unpaid)</span>
        </label>
      )}

      {planErr && <p className="text-sm text-expense">{planErr}</p>}

      {plan && plan.lines.length > 0 && (
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs text-muted">
            {plan.lines.length > 1 ? "One receipt will cover" : "This receipt will cover"}
          </p>
          <ul className="space-y-1.5">
            {plan.lines.map((l) => (
              <li key={`${l.year}-${l.month}`} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex flex-wrap items-center gap-1.5">
                  {l.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${KIND[l.kind].tone}`}>{KIND[l.kind].label}</span>
                  {l.balanceAfter > 0 && <span className="text-[10px] text-warn">part · {inr(l.balanceAfter)} left</span>}
                </span>
                <span className="tabular-nums">{inr(l.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex justify-between border-t border-border pt-2 text-sm font-semibold">
            <span>Total</span><span className="tabular-nums">{inr(plan.amount)}</span>
          </div>
          {plan.balanceAfter > 0 && (
            <p className="mt-1.5 text-xs text-warn">{inr(plan.balanceAfter)} will still be due after this payment</p>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Mode">
          <select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)} className="field">
            <option value="UPI">UPI</option><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option>
          </select>
        </Field>
        <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} required className="field" /></Field>
      </div>
      <Field label="Transaction reference (optional)">
        <input value={ref} onChange={(e) => setRef(e.target.value)} className="field" placeholder="UPI / cheque no." />
      </Field>

      {err && <p className="text-sm text-expense">{err}</p>}
      <button disabled={busy || !plan || plan.lines.length === 0}
              className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Saving…" : plan && plan.lines.length > 1 ? `Save payment for ${plan.lines.length} months` : "Save payment"}
      </button>
    </form>
  );
}

function PaidView({ result, onClose }: { result: FlatPaymentResult; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // download the PDF now so the share sheet can open the instant Share is tapped
  useEffect(() => { prepareReceiptFile(result.receiptPath); }, [result.receiptPath]);

  async function whatsapp() {
    setNote(null);
    setBusy(true);
    try {
      const how = await shareReceipt(result.receiptPath, result.whatsappShareUrl);
      if (how === "unavailable") { setNote("Add a phone number to this flat, or open the receipt and share the PDF yourself."); return; }
      if (how === "cancelled") return;
      await markReceiptShared(result.paymentId).catch(() => {});
      setNote(how === "shared" ? "Shared from your phone." : "WhatsApp opened with the message and receipt link. Attach the PDF too if you like.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-income">
        <Check className="size-5" /><p className="font-medium">Payment recorded</p>
      </div>
      <div className="rounded-lg bg-foreground/5 p-3 text-sm">
        <p className="font-medium">{result.receiptNumber}</p>
        <ul className="mt-2 space-y-1">
          {result.lines.map((l) => (
            <li key={`${l.year}-${l.month}`} className="flex justify-between text-xs">
              <span className="text-muted">{l.label} · {KIND[l.kind].label.toLowerCase()}{l.settled ? "" : " (part)"}</span>
              <span className="tabular-nums">{inr(l.amount)}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 flex justify-between border-t border-border pt-2 font-semibold">
          <span>Total</span><span className="tabular-nums">{inr(result.total)}</span>
        </div>
        {result.flatBalanceAfter > 0 && <p className="mt-1.5 text-xs text-warn">{inr(result.flatBalanceAfter)} still due for this flat</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <a href={result.receiptPath} target="_blank" rel="noopener noreferrer"
           className="flex items-center justify-center gap-1.5 rounded-lg bg-accent py-2.5 text-sm font-medium text-white">
          <FileText className="size-4" />Open receipt
        </a>
        <button onClick={whatsapp} disabled={busy}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-income/15 py-2.5 text-sm font-medium text-income disabled:opacity-60">
          <MessageCircle className="size-4" />{busy ? "Opening…" : "Share on WhatsApp"}
        </button>
      </div>
      {note && <p className="text-xs text-muted">{note}</p>}
      <button onClick={onClose} className="w-full rounded-lg bg-foreground/8 py-2.5 text-sm font-medium transition hover:bg-foreground/12">Done</button>
    </div>
  );
}

function EditModal({ flat, onClose, onSaved }: { flat: Flat | null; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!flat) return;
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    try {
      await updateFlat(flat.id, {
        flatNumber: flat.flatNumber,
        ownerName: String(f.get("owner")),
        phoneNumber: String(f.get("phone") || "") || undefined,
        email: String(f.get("email") || "") || undefined,
        occupantType: f.get("type") as OccupantType,
        monthlyFee: Number(f.get("fee")),
      });
      onSaved();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={!!flat} onClose={onClose} title={flat ? `Edit Flat ${flat.flatNumber}` : ""}>
      {flat && (
        <form key={flat.id} onSubmit={submit} className="space-y-3">
          <Field label="Owner name"><input name="owner" defaultValue={flat.ownerName} required className="field" /></Field>
          <Field label="WhatsApp number (with or without +91)">
            <input name="phone" defaultValue={flat.phoneNumber ?? ""} inputMode="tel" className="field" placeholder="98765 43210" />
          </Field>
          <Field label="Email (for dues reminders)">
            <input name="email" type="email" defaultValue={flat.email ?? ""} className="field" placeholder="owner@example.com" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Occupant">
              <select name="type" defaultValue={flat.occupantType} className="field">
                <option value="OWNER">Owner</option><option value="TENANT">Tenant</option><option value="VACANT">Vacant</option>
              </select>
            </Field>
            <Field label="Monthly fee (₹)">
              <input name="fee" type="number" min="1" step="0.01" defaultValue={flat.monthlyFee} required className="field" />
            </Field>
          </div>
          <p className="text-xs text-muted">A new fee applies to months generated from now on.</p>
          {err && <p className="text-sm text-expense">{err}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60">
            {busy ? "Saving…" : "Save changes"}
          </button>
        </form>
      )}
    </Modal>
  );
}


function ReceiptChip({ p, onChanged }: { p: PaymentInfo; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function share() {
    setErr(null);
    setBusy(true);
    try {
      const how = await shareReceipt(p.receiptPath, p.whatsappShareUrl);
      if (how === "unavailable") { setErr("Add a phone number to this flat first"); return; }
      if (how === "cancelled") return;
      await markReceiptShared(p.id).catch(() => {});
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const shared = p.whatsappStatus === "SHARED" || p.whatsappStatus === "SENT";
  const label = shared ? "Shared on WhatsApp" : "Share on WhatsApp";
  const warm = () => { prepareReceiptFile(p.receiptPath); };

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <a href={p.receiptPath} target="_blank" rel="noopener noreferrer"
         className="flex items-center gap-1.5 rounded-lg bg-foreground/6 px-2.5 py-1 transition hover:bg-foreground/10">
        <FileText className="size-3.5" />{p.receiptNumber} · {inr(p.amount)}
        {(p.periods.includes("–") || p.periods.includes(",")) && <span className="text-muted">· {p.periods}</span>}
      </a>
      <button onClick={share} disabled={busy} onPointerEnter={warm} onFocus={warm} onTouchStart={warm}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition disabled:opacity-60 ${
                shared ? "bg-income/15 text-income" : "bg-income/10 text-income hover:bg-income/20"}`}>
        {shared ? <Check className="size-3.5" /> : <MessageCircle className="size-3.5" />}
        {busy ? "Opening…" : label}
      </button>
      {err && <span className="text-expense">{err}</span>}
    </div>
  );
}
