"use client";

import { motion } from "framer-motion";
import { CalendarDays, MapPin, MessageCircle, Pencil, Pin, Plus, Trash2 } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";
import { type Notice, type NoticeInput, type NoticeKind, createNotice, deleteNotice, getNotices, updateNotice } from "@/lib/api";
import { when } from "./resident-shared";
import { Modal } from "./modal";

const KINDS: Record<NoticeKind, { label: string; tone: string }> = {
  NOTICE: { label: "Notice", tone: "bg-warn/15 text-warn" },
  ANNOUNCEMENT: { label: "Announcement", tone: "bg-accent/15 text-accent" },
  MEETING: { label: "Meeting", tone: "bg-income/15 text-income" },
};

const pad = (n: number) => String(n).padStart(2, "0");
/** ISO instant -> value for <input type="datetime-local"> in the browser's own time zone */
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const toIso = (local: string) => (local ? new Date(local).toISOString() : undefined);

function state(n: Notice) {
  if (n.live) return { label: n.kind === "MEETING" ? "Upcoming" : "Live", tone: "bg-income/15 text-income" };
  if (new Date(n.publishAt).getTime() > Date.now()) return { label: "Scheduled", tone: "bg-accent/15 text-accent" };
  return { label: n.kind === "MEETING" ? "Past" : "Expired", tone: "bg-foreground/10 text-muted" };
}

export function NoticesBoard({ initial }: { initial: Notice[] }) {
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<Notice | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try { setItems(await getNotices()); } catch (e) { setError((e as Error).message); }
  }, []);

  async function remove(n: Notice) {
    if (!confirm(`Remove “${n.title}”? Residents will stop seeing it.`)) return;
    setError(null);
    try { await deleteNotice(n.id); await reload(); } catch (e) { setError((e as Error).message); }
  }

  return (
    <>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notices</h1>
          <p className="text-sm text-muted">Notices, announcements and meetings that residents see on their home screen</p>
        </div>
        <button onClick={() => setEditing("new")}
                className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
          <Plus className="size-4" />New
        </button>
      </header>

      {error && <p className="mb-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}

      <section className="glass overflow-hidden">
        {items.length === 0 && <p className="p-10 text-center text-sm text-muted">Nothing posted yet. Use “New” to add a notice, announcement or meeting.</p>}
        <ul className="divide-y divide-border">
          {items.map((n, i) => {
            const st = state(n);
            return (
              <motion.li key={n.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                         className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${KINDS[n.kind].tone}`}>{KINDS[n.kind].label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.tone}`}>{st.label}</span>
                  {n.pinned && <span className="flex items-center gap-1 text-[11px] text-accent"><Pin className="size-3" />Pinned</span>}
                  <div className="ml-auto flex items-center gap-1">
                    <a href={n.whatsappShareUrl} target="_blank" rel="noopener noreferrer" title="Share in the society WhatsApp group"
                       className="flex items-center gap-1 rounded-lg bg-income/12 px-2.5 py-1.5 text-xs font-medium text-income transition hover:bg-income/20">
                      <MessageCircle className="size-3.5" />Share
                    </a>
                    <button onClick={() => setEditing(n)} aria-label="Edit" className="grid size-8 place-items-center rounded-lg text-muted hover:text-foreground"><Pencil className="size-4" /></button>
                    <button onClick={() => remove(n)} aria-label="Remove" className="grid size-8 place-items-center rounded-lg text-muted hover:text-expense"><Trash2 className="size-4" /></button>
                  </div>
                </div>
                <p className="mt-2 text-sm font-medium">{n.title}</p>
                <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted">{n.body}</p>
                {n.kind === "MEETING" && n.meetingAt && (
                  <p className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                    <span className="flex items-center gap-1"><CalendarDays className="size-3" />{when(n.meetingAt)}</span>
                    {n.venue && <span className="flex items-center gap-1"><MapPin className="size-3" />{n.venue}</span>}
                  </p>
                )}
                <p className="mt-2 text-[11px] text-muted">
                  Posted by {n.createdBy} · visible from {when(n.publishAt)}{n.expiresAt ? ` until ${when(n.expiresAt)}` : ""}
                </p>
              </motion.li>
            );
          })}
        </ul>
      </section>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New post" : "Edit post"}>
        {editing !== null && (
          <NoticeForm initial={editing === "new" ? null : editing} onSaved={() => { setEditing(null); reload(); }} />
        )}
      </Modal>
    </>
  );
}

function NoticeForm({ initial, onSaved }: { initial: Notice | null; onSaved: () => void }) {
  const [kind, setKind] = useState<NoticeKind>(initial?.kind ?? "NOTICE");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: NoticeInput = {
      kind,
      title: String(f.get("title")),
      body: String(f.get("body")),
      pinned: f.get("pinned") === "on",
      publishAt: toIso(String(f.get("publishAt") ?? "")),
      expiresAt: kind === "MEETING" ? undefined : toIso(String(f.get("expiresAt") ?? "")),
      meetingAt: kind === "MEETING" ? toIso(String(f.get("meetingAt") ?? "")) : undefined,
      venue: kind === "MEETING" ? String(f.get("venue") ?? "") : undefined,
    };
    setBusy(true); setErr(null);
    try {
      if (initial) await updateNotice(initial.id, body); else await createNotice(body);
      onSaved();
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-foreground/6 p-1">
        {(Object.keys(KINDS) as NoticeKind[]).map((k) => (
          <button type="button" key={k} onClick={() => setKind(k)}
                  className={`rounded-lg py-1.5 text-xs font-medium transition ${kind === k ? "bg-accent text-white" : "text-muted"}`}>
            {KINDS[k].label}
          </button>
        ))}
      </div>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Title</span>
        <input name="title" required maxLength={160} defaultValue={initial?.title} className="field" autoFocus />
      </label>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Details</span>
        <textarea name="body" required maxLength={4000} rows={5} defaultValue={initial?.body} className="field resize-y" />
      </label>
      {kind === "MEETING" ? (
        <>
          <label className="block text-xs text-muted">
            <span className="mb-1 block">Meeting date and time</span>
            <input name="meetingAt" type="datetime-local" required defaultValue={toLocalInput(initial?.meetingAt ?? null)} className="field" />
          </label>
          <label className="block text-xs text-muted">
            <span className="mb-1 block">Venue</span>
            <input name="venue" maxLength={160} defaultValue={initial?.venue ?? ""} className="field" placeholder="e.g. Society clubhouse" />
          </label>
        </>
      ) : (
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Hide after (optional)</span>
          <input name="expiresAt" type="datetime-local" defaultValue={toLocalInput(initial?.expiresAt ?? null)} className="field" />
        </label>
      )}
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Show from (leave empty for now)</span>
        <input name="publishAt" type="datetime-local" defaultValue={toLocalInput(initial?.publishAt ?? null)} className="field" />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input name="pinned" type="checkbox" defaultChecked={initial?.pinned} />Pin to the top
      </label>
      {err && <p className="text-sm text-expense">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Saving…" : initial ? "Save changes" : "Post"}
      </button>
    </form>
  );
}
