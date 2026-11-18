"use client";

import { motion } from "framer-motion";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { type MeetingKind, type MeetingSummary, createMeeting } from "@/lib/api";
import { KIND_LABEL, STATUS_UI, dayTime, toIso } from "./meeting-shared";
import { Modal } from "./modal";

type Tab = "UPCOMING" | "PAST" | "ALL";

export function MeetingsBoard({ initial, readOnly }: { initial: MeetingSummary[]; readOnly: boolean }) {
  const [tab, setTab] = useState<Tab>("UPCOMING");
  const [creating, setCreating] = useState(false);

  const upcoming = initial.filter((m) => m.status === "DRAFT" || m.status === "SCHEDULED")
    .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const past = initial.filter((m) => m.status === "HELD" || m.status === "CANCELLED");
  const shown = tab === "UPCOMING" ? upcoming : tab === "PAST" ? past : initial;

  return (
    <>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
          <p className="text-sm text-muted">
            {readOnly ? "Meeting records: agenda, attendance, minutes and decisions." : "Plan meetings, keep the agenda, attendance, minutes and decisions, and attach documents."}
          </p>
        </div>
        {!readOnly && (
          <button onClick={() => setCreating(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
            <Plus className="size-4" />New meeting
          </button>
        )}
      </header>

      <div className="mb-3 flex gap-1.5">
        {([["UPCOMING", `Upcoming (${upcoming.length})`], ["PAST", "Past"], ["ALL", "All"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${tab === key ? "bg-accent text-white" : "glass text-muted hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      <section className="glass overflow-hidden">
        {shown.length === 0 && <p className="p-10 text-center text-sm text-muted">{tab === "UPCOMING" ? "No upcoming meetings." : "Nothing here."}</p>}
        <ul className="divide-y divide-border">
          {shown.map((m, i) => (
            <motion.li key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Link href={`/meetings/${m.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 transition hover:bg-foreground/4 sm:px-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent"><CalendarDays className="size-5" /></span>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate text-sm font-medium">{m.title}</p>
                  <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                    <span>{KIND_LABEL[m.kind]}</span>
                    <span>{dayTime(m.scheduledAt)}</span>
                    {m.venue && <span className="flex items-center gap-1"><MapPin className="size-3" />{m.venue}</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {m.agendaCount} agenda item{m.agendaCount === 1 ? "" : "s"} · {m.resolutionCount} decision{m.resolutionCount === 1 ? "" : "s"}
                    {m.minutesPublished ? " · minutes shared" : ""}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_UI[m.status].tone}`}>{STATUS_UI[m.status].label}</span>
              </Link>
            </motion.li>
          ))}
        </ul>
      </section>

      <Modal open={creating} onClose={() => setCreating(false)} title="New meeting">
        {creating && <NewMeetingForm />}
      </Modal>
    </>
  );
}

function NewMeetingForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    try {
      const d = await createMeeting({
        kind: String(f.get("kind")) as MeetingKind, title: String(f.get("title")).trim(),
        scheduledAt: toIso(String(f.get("scheduledAt"))), venue: String(f.get("venue") ?? "").trim() || undefined,
        description: String(f.get("description") ?? "").trim() || undefined,
      });
      router.push(`/meetings/${d.summary.id}`);
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Type of meeting</span>
        <select name="kind" defaultValue="COMMITTEE" className="field">
          {(Object.keys(KIND_LABEL) as MeetingKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
        </select>
      </label>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Title</span>
        <input name="title" required maxLength={160} className="field" placeholder="e.g. October Society Meeting" autoFocus />
      </label>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Date and time</span>
        <input name="scheduledAt" type="datetime-local" required className="field" />
      </label>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Venue</span>
        <input name="venue" maxLength={160} className="field" placeholder="e.g. Society clubhouse" />
      </label>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Note for residents (optional)</span>
        <textarea name="description" maxLength={4000} rows={3} className="field resize-y" />
      </label>
      <p className="text-xs text-muted">It starts as a draft. Residents see it only after you schedule it.</p>
      {err && <p className="text-sm text-expense">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Creating…" : "Create meeting"}
      </button>
    </form>
  );
}
