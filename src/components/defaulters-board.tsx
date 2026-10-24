"use client";

import { motion } from "framer-motion";
import { Check, Mail, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import {
  type Defaulter, type DefaultersOverview, type RecentReminder, type ReminderChannel,
  getDefaulters, getRecentReminders, remindAll, remindFlat,
} from "@/lib/api";
import { inr } from "@/lib/format";

const shortMonth = (year: number, month: number) =>
  new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });

function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return days <= 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`;
}

const STATUS_TONE = { SENT: "text-income", PREPARED: "text-muted", FAILED: "text-expense" } as const;

export function DefaultersBoard({ initial, initialRecent }: { initial: DefaultersOverview; initialRecent: RecentReminder[] }) {
  const [data, setData] = useState(initial);
  const [recent, setRecent] = useState(initialRecent);
  const [tab, setTab] = useState<"overdue" | "all">(initial.summary.overdueFlats > 0 ? "overdue" : "all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [queue, setQueue] = useState<Defaulter[] | null>(null);
  const [pos, setPos] = useState(0);

  const reload = useCallback(async () => {
    try {
      const [o, r] = await Promise.all([getDefaulters(), getRecentReminders()]);
      setData(o); setRecent(r);
    } catch (e) { setError((e as Error).message); }
  }, []);

  async function remind(d: Defaulter, channel: ReminderChannel) {
    setError(null); setNotice(null);
    const url = channel === "WHATSAPP" ? d.whatsappUrl : d.mailtoUrl;
    if (!url) {
      setError(channel === "WHATSAPP"
        ? `Flat ${d.flatNumber} has no phone number saved. Add it on the Flats page.`
        : `Flat ${d.flatNumber} has no email address saved. Add it on the Flats page.`);
      return;
    }
    // WhatsApp is always opened by the treasurer (a wa.me link). Email is sent by the server when SMTP is set up.
    const bySever = channel === "EMAIL" && data.emailAutomatic;
    if (!bySever) {
      if (channel === "WHATSAPP") window.open(url, "_blank", "noopener");
      else window.location.href = url;
    }
    setBusy(`${d.flatId}:${channel}`);
    try {
      const out = await remindFlat(d.flatId, channel, !bySever);
      if (out.status === "FAILED") setError(`Flat ${d.flatNumber}: ${out.detail ?? "the reminder could not be sent"}`);
      else setNotice(out.status === "SENT" ? `Email sent to Flat ${d.flatNumber}` : `Flat ${d.flatNumber}: message opened. Press send in your app.`);
      await reload();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  /** Emails every overdue flat that has an address (only when SMTP is configured). */
  async function emailAll() {
    if (!confirm("Email a reminder to every overdue flat that has an email address and wasn’t reminded in the last 24 hours?")) return;
    setError(null); setNotice(null); setBusy("all");
    try {
      const r = await remindAll();
      setNotice(`Emailed ${r.sent} · failed ${r.failed} · skipped ${r.skipped}` + (r.notes.length ? ` (${r.notes.slice(0, 2).join("; ")}${r.notes.length > 2 ? "…" : ""})` : ""));
      await reload();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  // ---- WhatsApp, one flat at a time: links cannot be sent in bulk, so each is opened with a tap ----
  async function openCurrent() {
    if (!queue || pos >= queue.length) return;
    const d = queue[pos];
    window.open(d.whatsappUrl!, "_blank", "noopener");        // must happen inside the tap
    setPos((n) => n + 1);
    try { await remindFlat(d.flatId, "WHATSAPP", true); } catch { /* the message is already open; logging can fail quietly */ }
    reload();
  }

  const { summary } = data;
  const dayAgo = Date.now() - 86_400_000;
  const waList = data.defaulters.filter((d) =>
    d.overdueAmount > 0 && d.whatsappUrl && (!d.lastReminder || new Date(d.lastReminder.at).getTime() < dayAgo));
  const emailList = data.defaulters.filter((d) => d.overdueAmount > 0 && d.email);
  const shown = tab === "overdue" ? data.defaulters.filter((d) => d.overdueAmount > 0) : data.defaulters;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Defaulters</h1>
          <p className="text-sm text-muted">Flats with unpaid maintenance · overdue after the {data.dueDay}th of the month</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.emailAutomatic && emailList.length > 0 && (
            <button onClick={emailAll} disabled={busy === "all"}
                    className="flex items-center gap-1.5 rounded-xl bg-accent/12 px-4 py-2.5 text-sm font-medium text-accent transition hover:bg-accent/20 disabled:opacity-60">
              <Mail className="size-4" />{busy === "all" ? "Sending…" : `Email all overdue (${emailList.length})`}
            </button>
          )}
          <button onClick={() => { setQueue(waList); setPos(0); }} disabled={waList.length === 0}
                  className="flex items-center gap-1.5 rounded-xl bg-income px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                  title={waList.length === 0 ? "No overdue flat with a phone number is waiting for a reminder" : ""}>
            <MessageCircle className="size-4" />Remind overdue on WhatsApp ({waList.length})
          </button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile label="Overdue flats" value={`${summary.overdueFlats} of ${summary.flats}`} tone="text-expense" />
        <Tile label="Overdue amount" value={inr(summary.overdueAmount)} tone="text-expense" />
        <Tile label="Total outstanding" value={inr(summary.totalOutstanding)} tone="text-warn" />
        <Tile label="Longest overdue" value={summary.oldestDaysOverdue > 0 ? `${summary.oldestDaysOverdue} days` : "None"} />
      </div>

      {queue && (
        <div className="glass mb-4 p-5">
          {pos < queue.length ? (
            <>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">WhatsApp reminders · {pos + 1} of {queue.length}</p>
                <button onClick={() => setQueue(null)} className="text-xs text-muted hover:text-foreground">Stop</button>
              </div>
              <p className="text-sm">
                <b>Flat {queue[pos].flatNumber}</b> · {queue[pos].ownerName} · <span className="text-expense">{inr(queue[pos].totalOutstanding)}</span>
              </p>
              <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-foreground/5 p-3 text-xs font-sans text-muted">
                {new URL(queue[pos].whatsappUrl!).searchParams.get("text")}
              </pre>
              <div className="mt-3 flex gap-2">
                <button onClick={openCurrent}
                        className="flex items-center gap-1.5 rounded-lg bg-income px-4 py-2 text-sm font-medium text-white">
                  <MessageCircle className="size-4" />Open WhatsApp
                </button>
                <button onClick={() => setPos((n) => n + 1)} className="rounded-lg bg-foreground/8 px-4 py-2 text-sm">Skip</button>
              </div>
              <p className="mt-2 text-xs text-muted">WhatsApp opens with this message ready. Press send there, then come back for the next flat.</p>
            </>
          ) : (
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm text-income"><Check className="size-4" />All {queue.length} reminders opened</p>
              <button onClick={() => setQueue(null)} className="rounded-lg bg-foreground/8 px-4 py-2 text-sm">Close</button>
            </div>
          )}
        </div>
      )}

      <div className="mb-3 flex gap-1.5">
        {([["overdue", "Overdue"], ["all", "All pending"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                    tab === key ? "bg-accent text-white" : "glass text-muted hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}
      {notice && <p className="mb-3 rounded-lg bg-income/10 px-3 py-2 text-sm text-income">{notice}</p>}

      <section className="glass overflow-hidden">
        {shown.length === 0 && (
          <p className="p-10 text-center text-sm text-muted">
            {tab === "overdue" ? "No overdue flats. Everyone is up to date 🎉" : "No pending dues"}
          </p>
        )}
        <ul className="divide-y divide-border">
          {shown.map((d, i) => (
            <motion.li key={d.flatId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                       transition={{ delay: i * 0.03 }} className="px-4 py-4 sm:px-5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/12 text-sm font-semibold text-accent">
                  {d.flatNumber}
                </span>
                <div className="min-w-0 flex-1 basis-44">
                  <p className="truncate text-sm font-medium">{d.ownerName}</p>
                  <p className="truncate text-xs text-muted">
                    {d.phoneNumber ?? "No phone"} · {d.email ?? "No email"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-semibold tabular-nums">{inr(d.totalOutstanding)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    d.overdueAmount > 0 ? "bg-expense/15 text-expense" : "bg-warn/15 text-warn"}`}>
                    {d.overdueAmount > 0 ? `${d.daysOverdue} days overdue` : `Due by ${data.dueDay}th`}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:pl-[3.75rem]">
                {d.months.map((m) => (
                  <span key={`${m.year}-${m.month}`}
                        className={`rounded-md px-2 py-0.5 text-[11px] tabular-nums ${
                          m.overdue ? "bg-expense/10 text-expense" : "bg-warn/10 text-warn"}`}>
                    {shortMonth(m.year, m.month)} · {inr(m.balance)}
                  </span>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 sm:pl-[3.75rem]">
                <p className="text-xs text-muted">
                  {d.lastReminder ? (
                    <>
                      Last: {d.lastReminder.channel === "WHATSAPP" ? "WhatsApp" : "Email"} ·{" "}
                      <span className={STATUS_TONE[d.lastReminder.status]}>{d.lastReminder.status.toLowerCase()}</span>{" "}
                      · {ago(d.lastReminder.at)} · {d.reminderCount} total
                    </>
                  ) : "Never reminded"}
                </p>
                <div className="flex gap-2">
                  <Link href="/flats" className="rounded-lg bg-foreground/6 px-3 py-1.5 text-xs transition hover:bg-foreground/10">
                    Record payment
                  </Link>
                  <button onClick={() => remind(d, "EMAIL")} disabled={busy === `${d.flatId}:EMAIL`}
                          title={d.email ? "Send an email reminder" : "No email saved"}
                          className="flex items-center gap-1.5 rounded-lg bg-accent/12 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20 disabled:opacity-60">
                    <Mail className="size-3.5" />Email
                  </button>
                  <button onClick={() => remind(d, "WHATSAPP")} disabled={busy === `${d.flatId}:WHATSAPP`}
                          title={d.phoneNumber ? "Send a WhatsApp reminder" : "No phone number saved"}
                          className="flex items-center gap-1.5 rounded-lg bg-income/12 px-3 py-1.5 text-xs font-medium text-income transition hover:bg-income/20 disabled:opacity-60">
                    <MessageCircle className="size-3.5" />WhatsApp
                  </button>
                </div>
              </div>
            </motion.li>
          ))}
        </ul>
      </section>

      <p className="mt-3 text-xs text-muted">
        WhatsApp reminders open in your own WhatsApp with the message already written; press send there.
        {data.emailAutomatic
          ? ` Emails are sent from the server. ${data.autoRemindersEnabled ? "A daily job (10:00) also emails overdue flats automatically." : "Turn on app.reminders.auto-enabled to email overdue flats every day automatically."}`
          : " Email also opens in your mail app. To send emails from the server, add SMTP settings (spring.mail.*)."}
      </p>

      <section className="glass mt-6 p-5">
        <h2 className="mb-3 text-sm font-medium">Recent reminders</h2>
        {recent.length === 0 ? (
          <p className="py-3 text-center text-sm text-muted">No reminders yet</p>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
                {r.channel === "WHATSAPP" ? <MessageCircle className="size-4 text-income" /> : <Mail className="size-4 text-accent" />}
                <span className="font-medium">Flat {r.flatNumber}</span>
                <span className="text-muted">{r.ownerName}</span>
                <span className="tabular-nums">{inr(r.amountDue)}</span>
                <span className={`flex items-center gap-1 text-xs ${STATUS_TONE[r.status]}`}>
                  {r.status === "SENT" && <Check className="size-3" />}{r.status.toLowerCase()}
                </span>
                <span className="ml-auto text-xs text-muted">{r.triggeredBy} · {ago(r.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Tile({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return (
    <div className="glass px-4 py-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
