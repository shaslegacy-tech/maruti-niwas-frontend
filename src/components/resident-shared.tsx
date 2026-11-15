"use client";

import { Check, Copy } from "lucide-react";
import { type FormEvent, useState } from "react";
import { type ResidentHome, updateMyContact } from "@/lib/api";

export const STATUS = {
  PAID: { label: "Paid", tone: "bg-income/15 text-income" },
  PARTIAL: { label: "Part paid", tone: "bg-warn/15 text-warn" },
  PENDING: { label: "Due", tone: "bg-foreground/10 text-muted" },
} as const;

export const MODE: Record<string, string> = { UPI: "UPI", CASH: "Cash", BANK_TRANSFER: "Bank transfer" };

export const CLAIM_STATUS = {
  PENDING: { label: "Waiting for the treasurer", tone: "bg-warn/15 text-warn" },
  APPROVED: { label: "Approved", tone: "bg-income/15 text-income" },
  REJECTED: { label: "Not accepted", tone: "bg-expense/15 text-expense" },
  CANCELLED: { label: "Withdrawn", tone: "bg-foreground/10 text-muted" },
} as const;

export const when = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function CopyButton({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  return (
    <button aria-label="Copy" title="Copy"
            onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ } }}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:text-foreground">
      {done ? <Check className="size-3.5 text-income" /> : <Copy className="size-3.5" />}
    </button>
  );
}

export function PayCard({ payTo }: { payTo: ResidentHome["payTo"] }) {
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
      <p className="mt-3 text-xs text-muted">
        After paying, use <b>I have paid</b> to send the treasurer your transaction reference, so your receipt can be issued.
      </p>
    </section>
  );
}

export function ContactForm({ flat, onSaved }: { flat: ResidentHome["flat"]; onSaved: (f: ResidentHome["flat"]) => void }) {
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
