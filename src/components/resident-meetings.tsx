"use client";

import { motion } from "framer-motion";
import { CalendarDays, FileText, MapPin } from "lucide-react";
import { useState } from "react";
import { type ResidentMeeting, type ResidentMeetingLine, getMyMeeting } from "@/lib/api";
import { fileSize } from "./documents-shared";
import { KIND_LABEL, OUTCOME_UI, STATUS_UI, dayTime, votesLine } from "./meeting-shared";
import { Modal } from "./modal";

export function ResidentMeetings({ lines }: { lines: ResidentMeetingLine[] }) {
  const [open, setOpen] = useState<ResidentMeeting | null>(null);
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upcoming = lines.filter((m) => m.status === "SCHEDULED").sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
  const past = lines.filter((m) => m.status !== "SCHEDULED");

  async function show(id: number) {
    setLoading(id); setError(null);
    try { setOpen(await getMyMeeting(id)); } catch (e) { setError((e as Error).message); } finally { setLoading(null); }
  }

  const group = (title: string, items: ResidentMeetingLine[], empty: string) => (
    <section className="glass overflow-hidden">
      <h2 className="px-5 pb-2 pt-4 text-sm font-medium">{title}</h2>
      {items.length === 0 && <p className="px-5 pb-5 text-sm text-muted">{empty}</p>}
      <ul className="divide-y divide-border">
        {items.map((m, i) => (
          <motion.li key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
            <button onClick={() => show(m.id)} disabled={loading === m.id} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 text-left transition hover:bg-foreground/4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent"><CalendarDays className="size-5" /></span>
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium">{m.title}</p>
                <p className="truncate text-xs text-muted">{KIND_LABEL[m.kind]} · {dayTime(m.scheduledAt)}{m.venue ? ` · ${m.venue}` : ""}</p>
              </div>
              {m.status !== "SCHEDULED" && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_UI[m.status].tone}`}>{STATUS_UI[m.status].label}</span>}
              {m.hasMinutes && <span className="rounded-full bg-income/12 px-2 py-0.5 text-[11px] font-medium text-income">Minutes</span>}
            </button>
          </motion.li>
        ))}
      </ul>
    </section>
  );

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Meetings</h1>
        <p className="text-sm text-muted">Upcoming meetings with their agenda, and the minutes and decisions of past meetings.</p>
      </header>
      {error && <p className="mb-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}
      <div className="space-y-4">
        {group("Upcoming", upcoming, "No meetings are scheduled right now.")}
        {past.length > 0 && group("Past meetings", past, "")}
      </div>

      <Modal wide open={open !== null} onClose={() => setOpen(null)} title={open?.title ?? ""}>
        {open && <MeetingView m={open} />}
      </Modal>
    </>
  );
}

function MeetingView({ m }: { m: ResidentMeeting }) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-foreground/8 px-2 py-0.5 text-[11px]">{KIND_LABEL[m.kind]}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_UI[m.status].tone}`}>{STATUS_UI[m.status].label}</span>
        </div>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 text-sm">
          <span className="flex items-center gap-1.5"><CalendarDays className="size-4 text-muted" />{dayTime(m.scheduledAt)}</span>
          {m.venue && <span className="flex items-center gap-1.5"><MapPin className="size-4 text-muted" />{m.venue}</span>}
        </p>
        {m.status === "CANCELLED" && <p className="mt-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">This meeting was cancelled{m.cancelledReason ? `: ${m.cancelledReason}` : "."}</p>}
        {m.description && <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{m.description}</p>}
      </div>

      {m.agenda.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Agenda</h3>
          <ol className="space-y-2">
            {m.agenda.map((a) => (
              <li key={a.id} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/12 text-xs font-medium text-accent">{a.position}</span>
                <div><p className="text-sm">{a.title}</p>{a.notes && <p className="text-xs text-muted">{a.notes}</p>}</div></li>
            ))}
          </ol>
        </div>
      )}

      {m.minutes && (<div><h3 className="mb-2 text-sm font-medium">Minutes</h3><p className="whitespace-pre-wrap text-sm text-muted">{m.minutes}</p></div>)}

      {m.decisions.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Decisions</h3>
          <ul className="space-y-3">
            {m.decisions.map((r) => {
              const votes = votesLine(r.votesFor, r.votesAgainst, r.abstained);
              return (
                <li key={r.number} className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2"><span className="text-xs text-muted">Resolution {r.number}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${OUTCOME_UI[r.outcome].tone}`}>{OUTCOME_UI[r.outcome].label}</span></div>
                  <p className="mt-1 text-sm font-medium">{r.title}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{r.text}</p>
                  {votes && <p className="mt-1 text-xs text-muted">{votes}</p>}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {m.documents.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-medium">Documents</h3>
          <ul className="divide-y divide-border">
            {m.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 py-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/12 text-accent"><FileText className="size-4" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm">{d.title}</p><p className="text-xs text-muted">{fileSize(d.sizeBytes)}</p></div>
                <a href={`/api/me/documents/${d.id}/file`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-accent/12 px-3 py-1.5 text-xs font-medium text-accent">Open</a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
