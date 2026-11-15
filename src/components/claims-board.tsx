"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Check, Paperclip } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  type PaymentMode, type PaymentPlan, type StaffClaim,
  approveClaim, getClaims, getPaymentPlan, rejectClaim,
} from "@/lib/api";
import { inr, shortDate } from "@/lib/format";
import { Modal } from "./modal";
import { CLAIM_STATUS, MODE, when } from "./resident-shared";

export function ClaimsBoard({ initial }: { initial: StaffClaim[] }) {
  const [claims, setClaims] = useState(initial);
  const pendingCount = claims.filter((c) => c.status === "PENDING").length;
  const [tab, setTab] = useState<"PENDING" | "ALL">(pendingCount > 0 ? "PENDING" : "ALL");
  const [approving, setApproving] = useState<StaffClaim | null>(null);
  const [rejecting, setRejecting] = useState<StaffClaim | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try { setClaims(await getClaims()); } catch (e) { setError((e as Error).message); }
  }, []);

  const shown = tab === "PENDING" ? claims.filter((c) => c.status === "PENDING") : claims;

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Payment proofs</h1>
        <p className="text-sm text-muted">
          What residents say they have paid. Check each one against your bank statement, then approve it to record the payment and issue the receipt.
        </p>
      </header>

      <div className="mb-3 flex gap-1.5">
        {([["PENDING", `Waiting (${pendingCount})`], ["ALL", "All recent"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                    tab === key ? "bg-accent text-white" : "glass text-muted hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}

      <section className="glass overflow-hidden">
        {shown.length === 0 && (
          <p className="p-10 text-center text-sm text-muted">{tab === "PENDING" ? "Nothing is waiting for review 🎉" : "No payment proofs yet"}</p>
        )}
        <ul className="divide-y divide-border">
          {shown.map((c, i) => {
            const st = CLAIM_STATUS[c.status];
            return (
              <motion.li key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                         className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/12 text-sm font-semibold text-accent">{c.flatNumber}</span>
                  <div className="min-w-0 flex-1 basis-44">
                    <p className="truncate text-sm font-medium">{c.ownerName}</p>
                    <p className="text-xs text-muted">Sent {when(c.submittedAt)} · flat owes {inr(c.flatOutstanding)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold tabular-nums">{inr(c.amount)}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.tone}`}>{st.label}</span>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted sm:pl-[3.75rem]">
                  <span>{MODE[c.mode] ?? c.mode}</span><span>·</span><span>paid {shortDate(c.paidOn)}</span>
                  {c.reference && <><span>·</span><span className="font-medium text-foreground">{c.reference}</span></>}
                  {c.duplicateReference && (
                    <span className="flex items-center gap-1 rounded-full bg-expense/15 px-2 py-0.5 text-[11px] font-medium text-expense">
                      <AlertTriangle className="size-3" />Reference already used
                    </span>
                  )}
                  {c.proofPath && (
                    <a href={c.proofPath} target="_blank" rel="noopener noreferrer"
                       className="flex items-center gap-1 rounded-lg bg-foreground/8 px-2.5 py-1 text-foreground transition hover:bg-foreground/12">
                      <Paperclip className="size-3" />View proof
                    </a>
                  )}
                </div>
                {c.note && <p className="mt-2 text-sm text-muted sm:pl-[3.75rem]">“{c.note}”</p>}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 sm:pl-[3.75rem]">
                  <p className="text-xs text-muted">
                    {c.status === "APPROVED" && `Approved by ${c.reviewedBy} · receipt ${c.receiptNumber}`}
                    {c.status === "REJECTED" && `Rejected by ${c.reviewedBy}: ${c.reviewNote}`}
                    {c.status === "CANCELLED" && "Withdrawn by the resident"}
                  </p>
                  {c.status === "PENDING" && (
                    <div className="flex gap-2">
                      <button onClick={() => setRejecting(c)} className="rounded-lg bg-foreground/8 px-3 py-1.5 text-xs transition hover:bg-foreground/12">Reject</button>
                      <button onClick={() => setApproving(c)} className="rounded-lg bg-income px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90">
                        Approve &amp; record
                      </button>
                    </div>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ul>
      </section>

      <Modal open={approving !== null} onClose={() => setApproving(null)} title={approving ? `Approve · Flat ${approving.flatNumber}` : ""}>
        {approving && <ApproveForm claim={approving} onChanged={reload} onClose={() => setApproving(null)} />}
      </Modal>
      <Modal open={rejecting !== null} onClose={() => setRejecting(null)} title={rejecting ? `Reject · Flat ${rejecting.flatNumber}` : ""}>
        {rejecting && <RejectForm claim={rejecting} onDone={() => { setRejecting(null); reload(); }} />}
      </Modal>
    </>
  );
}

/** Records the payment through the normal receiving flow: oldest dues first, one receipt, any months. */
function ApproveForm({ claim, onChanged, onClose }: { claim: StaffClaim; onChanged: () => void; onClose: () => void }) {
  const [amount, setAmount] = useState(String(claim.amount));
  const [mode, setMode] = useState<PaymentMode>(claim.mode as PaymentMode);
  const [date, setDate] = useState(claim.paidOn);
  const [ref, setRef] = useState(claim.reference ?? "");
  const [plan, setPlan] = useState<PaymentPlan | null>(null);
  const [planErr, setPlanErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<StaffClaim | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const call = ++latest.current;
    const n = Number(amount);
    if (!(n > 0)) { setPlan(null); return; }
    const timer = setTimeout(async () => {
      try {
        const p = await getPaymentPlan(claim.flatId, n);
        if (call === latest.current) { setPlan(p); setPlanErr(null); }
      } catch (e) {
        if (call === latest.current) { setPlan(null); setPlanErr((e as Error).message); }
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [amount, claim.flatId]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      setDone(await approveClaim(claim.id, { amount: Number(amount), mode, paymentDate: date, reference: ref.trim() || undefined }));
      onChanged();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="space-y-4">
        <p className="flex items-center gap-2 font-medium text-income"><Check className="size-5" />Payment recorded</p>
        <p className="text-sm text-muted">Receipt <b className="text-foreground">{done.receiptNumber}</b> has been issued. The resident can download it from their Maintenance page.</p>
        <div className="grid grid-cols-2 gap-2">
          <Link href="/flats" className="rounded-lg bg-foreground/8 py-2.5 text-center text-sm font-medium">Open Flats</Link>
          <button onClick={onClose} className="rounded-lg bg-accent py-2.5 text-sm font-medium text-white">Done</button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted">{claim.ownerName} says they paid {inr(claim.amount)}. Change anything that differs from your bank statement.</p>
      {claim.duplicateReference && (
        <p className="flex items-center gap-2 rounded-lg bg-expense/10 px-3 py-2 text-xs text-expense">
          <AlertTriangle className="size-4 shrink-0" />This reference is already on another claim or a recorded payment. Please check before approving.
        </p>
      )}
      {claim.proofPath && (
        <a href={claim.proofPath} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-accent underline">
          <Paperclip className="size-3.5" />Open the screenshot
        </a>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Amount received (₹)</span>
          <input type="number" step="0.01" min="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} className="field" />
        </label>
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Date</span>
          <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="field" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value as PaymentMode)} className="field">
            <option value="UPI">UPI</option><option value="CASH">Cash</option><option value="BANK_TRANSFER">Bank transfer</option>
          </select>
        </label>
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Reference</span>
          <input value={ref} onChange={(e) => setRef(e.target.value)} className="field" />
        </label>
      </div>

      {planErr && <p className="text-sm text-expense">{planErr}</p>}
      {plan && plan.lines.length > 0 && (
        <div className="rounded-lg border border-border p-3">
          <p className="mb-2 text-xs text-muted">{plan.lines.length > 1 ? "One receipt will cover" : "This receipt will cover"}</p>
          <ul className="space-y-1">
            {plan.lines.map((l) => (
              <li key={`${l.year}-${l.month}`} className="flex justify-between text-sm">
                <span>{l.label}{l.balanceAfter > 0 && <span className="ml-1.5 text-[10px] text-warn">part</span>}</span>
                <span className="tabular-nums">{inr(l.amount)}</span>
              </li>
            ))}
          </ul>
          {plan.balanceAfter > 0 && <p className="mt-2 text-xs text-warn">{inr(plan.balanceAfter)} will still be due afterwards</p>}
        </div>
      )}
      {err && <p className="text-sm text-expense">{err}</p>}
      <button disabled={busy || !plan} className="w-full rounded-lg bg-income py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Recording…" : "Approve and issue receipt"}
      </button>
    </form>
  );
}

function RejectForm({ claim, onDone }: { claim: StaffClaim; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    try { await rejectClaim(claim.id, String(f.get("reason"))); onDone(); }
    catch (e2) { setErr((e2 as Error).message); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted">The resident will see your reason, so keep it clear and polite.</p>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Reason</span>
        <textarea name="reason" required maxLength={300} rows={3} className="field resize-y" autoFocus
                  placeholder="e.g. We could not find this transaction in the bank statement" />
      </label>
      {err && <p className="text-sm text-expense">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-expense py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Rejecting…" : "Reject payment proof"}
      </button>
    </form>
  );
}
