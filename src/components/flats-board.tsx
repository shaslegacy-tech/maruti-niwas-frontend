"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, FileText, MessageCircle, Pencil, Undo2, Wallet } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";
import {
  type Flat, type Maintenance, type OccupantType, type PaymentInfo, type PaymentMode,
  getFlats, getMaintenance, recordPayment, resetPayment, sendReceipt, updateFlat,
} from "@/lib/api";
import { inr, shortDate } from "@/lib/format";
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
    if (!confirm(`Clear all payments for Flat ${r.flatNumber}?`)) return;
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

      <PaymentModal record={paying} onClose={() => setPaying(null)}
                    onSaved={() => { setPaying(null); reload(ym.y, ym.m); }} />
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

function PaymentModal({ record, onClose, onSaved }: { record: Maintenance | null; onClose: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!record) return;
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    try {
      await recordPayment(record.id, {
        amount: Number(f.get("amount")),
        paymentMode: f.get("mode") as PaymentMode,
        paymentDate: String(f.get("date")),
        transactionRef: String(f.get("ref") || "") || undefined,
      });
      onSaved();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <Modal open={!!record} onClose={onClose} title={record ? `Record payment · Flat ${record.flatNumber}` : ""}>
      {record && (
        <form key={record.id} onSubmit={submit} className="space-y-3">
          <p className="text-sm text-muted">{record.ownerName} · balance due <b className="text-foreground">{inr(record.balanceDue)}</b></p>
          <Field label="Amount received (₹)">
            <input name="amount" type="number" step="0.01" min="0.01" max={record.balanceDue}
                   defaultValue={record.balanceDue} required className="field" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mode">
              <select name="mode" className="field" defaultValue="UPI">
                <option value="UPI">UPI</option><option value="CASH">Cash</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
              </select>
            </Field>
            <Field label="Date"><input name="date" type="date" defaultValue={todayISO()} required className="field" /></Field>
          </div>
          <Field label="Transaction reference (optional)"><input name="ref" className="field" placeholder="UPI / cheque no." /></Field>
          {err && <p className="text-sm text-expense">{err}</p>}
          <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60">
            {busy ? "Saving…" : "Save payment"}
          </button>
        </form>
      )}
    </Modal>
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
    if (!p.whatsappShareUrl) { setErr("Add a phone number to this flat first"); return; }
    // No credentials configured: open WhatsApp with the message and receipt link already filled in.
    if (!p.whatsappAutomatic) { window.open(p.whatsappShareUrl, "_blank", "noopener"); return; }
    setBusy(true);
    try { await sendReceipt(p.id); onChanged(); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  const sent = p.whatsappStatus === "SENT";
  const label = sent ? "Sent on WhatsApp"
    : p.whatsappStatus === "FAILED" ? "Retry WhatsApp"
    : p.whatsappAutomatic ? "Send on WhatsApp" : "Share on WhatsApp";

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      <a href={p.receiptPath} target="_blank" rel="noopener noreferrer"
         className="flex items-center gap-1.5 rounded-lg bg-foreground/6 px-2.5 py-1 transition hover:bg-foreground/10">
        <FileText className="size-3.5" />{p.receiptNumber} · {inr(p.amount)}
      </a>
      <button onClick={share} disabled={busy}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition disabled:opacity-60 ${
                sent ? "bg-income/15 text-income" : "bg-income/10 text-income hover:bg-income/20"}`}>
        {sent ? <Check className="size-3.5" /> : <MessageCircle className="size-3.5" />}
        {busy ? "Sending…" : label}
      </button>
      {p.whatsappStatus === "FAILED" && p.whatsappError && <span className="text-expense">{p.whatsappError}</span>}
      {err && <span className="text-expense">{err}</span>}
    </div>
  );
}
