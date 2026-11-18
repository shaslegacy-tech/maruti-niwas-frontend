"use client";

import { motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";
import { type ApprovalItem, approveNotice, getApprovals, rejectNotice } from "@/lib/api";
import { Modal } from "./modal";
import { when } from "./resident-shared";

const TYPE_LABEL: Record<ApprovalItem["type"], string> = { NOTICE: "Important notice" };

export function ApprovalsBoard({ initial }: { initial: ApprovalItem[] }) {
  const [items, setItems] = useState(initial);
  const [rejecting, setRejecting] = useState<ApprovalItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try { setItems(await getApprovals()); } catch (e) { setError((e as Error).message); }
  }, []);

  const key = (a: ApprovalItem) => `${a.type}:${a.id}`;

  async function approve(a: ApprovalItem) {
    setError(null); setBusy(key(a));
    try { await approveNotice(a.id); await reload(); }
    catch (e) { setError((e as Error).message); await reload(); }
    finally { setBusy(null); }
  }

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Approvals</h1>
        <p className="text-sm text-muted">
          Things that need your decision. You approve or reject; the item itself is not edited, so what you see is what gets published.
        </p>
      </header>

      {error && <p className="mb-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}

      <section className="glass overflow-hidden">
        {items.length === 0 && <p className="p-10 text-center text-sm text-muted">Nothing is waiting for your approval 🎉</p>}
        <ul className="divide-y divide-border">
          {items.map((a, i) => (
            <motion.li key={key(a)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                       className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-expense/12 px-2 py-0.5 text-[11px] font-medium text-expense">{TYPE_LABEL[a.type]}</span>
                <span className="text-[11px] text-muted">{a.meta}</span>
              </div>
              <p className="mt-2 text-sm font-medium">{a.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{a.summary}</p>
              <p className="mt-2 text-[11px] text-muted">Submitted by {a.submittedBy}{a.submittedAt ? ` · ${when(a.submittedAt)}` : ""}</p>
              <div className="mt-3 flex gap-2">
                <button onClick={() => setRejecting(a)} disabled={busy === key(a)}
                        className="flex items-center gap-1.5 rounded-lg bg-foreground/8 px-3.5 py-2 text-sm transition hover:bg-expense/15 hover:text-expense disabled:opacity-60">
                  <X className="size-4" />Reject
                </button>
                <button onClick={() => approve(a)} disabled={busy === key(a)}
                        className="flex items-center gap-1.5 rounded-lg bg-income px-3.5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60">
                  <Check className="size-4" />{busy === key(a) ? "Approving…" : "Approve"}
                </button>
              </div>
            </motion.li>
          ))}
        </ul>
      </section>

      <Modal open={rejecting !== null} onClose={() => setRejecting(null)} title={rejecting ? `Reject: ${rejecting.title}` : ""}>
        {rejecting && <RejectForm item={rejecting} onDone={() => { setRejecting(null); reload(); }} />}
      </Modal>
    </>
  );
}

function RejectForm({ item, onDone }: { item: ApprovalItem; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    try { await rejectNotice(item.id, String(f.get("reason"))); onDone(); }
    catch (e2) { setErr((e2 as Error).message); setBusy(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted">The Secretary will see your reason and can change the notice and submit it again.</p>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Reason</span>
        <textarea name="reason" required maxLength={300} rows={3} className="field resize-y" autoFocus
                  placeholder="e.g. Please get the committee's vote on this first" />
      </label>
      {err && <p className="text-sm text-expense">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-expense py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Rejecting…" : "Reject"}
      </button>
    </form>
  );
}
