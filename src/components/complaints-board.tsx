"use client";

import { motion } from "framer-motion";
import { Plus, Send } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";
import {
  type ComplaintCategory, type ComplaintDetail, type ComplaintStatus, type ComplaintSummary,
  commentOnComplaint, confirmComplaint, createComplaint, getComplaintDetail, getComplaints,
  getMyComplaint, getMyComplaints, reopenComplaint, replyToComplaint, setComplaintStatus,
} from "@/lib/api";
import { prepareProof } from "@/lib/image";
import { CATEGORY_LABEL, ComplaintThread, PhotoPicker, STATUS_UI } from "./complaint-shared";
import { Modal } from "./modal";
import { when } from "./resident-shared";

type Mode = "RESIDENT" | "STAFF";
type Tab = "ACTIVE" | "DONE" | "ALL";

const ACTIVE: ComplaintStatus[] = ["OPEN", "IN_PROGRESS"];

export function ComplaintsBoard({ mode, initial }: { mode: Mode; initial: ComplaintSummary[] }) {
  const resident = mode === "RESIDENT";
  const [items, setItems] = useState(initial);
  const [tab, setTab] = useState<Tab>("ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ComplaintDetail | null>(null);

  const reload = useCallback(async () => {
    try { setItems(await (resident ? getMyComplaints() : getComplaints())); } catch (e) { setError((e as Error).message); }
  }, [resident]);

  async function open(id: number) {
    setOpenId(id); setDetail(null); setError(null);
    try { setDetail(await (resident ? getMyComplaint(id) : getComplaintDetail(id))); }
    catch (e) { setError((e as Error).message); setOpenId(null); }
  }

  const shown = items.filter((c) =>
    tab === "ALL" ? true : tab === "ACTIVE" ? ACTIVE.includes(c.status) : !ACTIVE.includes(c.status));
  const activeCount = items.filter((c) => ACTIVE.includes(c.status)).length;

  return (
    <>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Complaints</h1>
          <p className="text-sm text-muted">
            {resident ? "Raise a problem, follow its progress and talk to the committee" : "Complaints raised by residents"}
          </p>
        </div>
        {resident && (
          <button onClick={() => setCreating(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
            <Plus className="size-4" />New complaint
          </button>
        )}
      </header>

      <div className="mb-3 flex gap-1.5">
        {([["ACTIVE", `Active (${activeCount})`], ["DONE", resident ? "History" : "Resolved"], ["ALL", "All"]] as const).map(([key, label]) => (
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
          <p className="p-10 text-center text-sm text-muted">
            {tab === "ACTIVE" ? (resident ? "No active complaints. Use “New complaint” if something needs attention." : "No active complaints 🎉") : "Nothing here"}
          </p>
        )}
        <ul className="divide-y divide-border">
          {shown.map((c, i) => (
            <motion.li key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <button onClick={() => open(c.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3.5 text-left transition hover:bg-foreground/4 sm:px-5">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="truncate text-xs text-muted">
                    {resident ? CATEGORY_LABEL[c.category] : `Flat ${c.flatNumber} · ${c.ownerName} · ${CATEGORY_LABEL[c.category]}`}
                    {" · "}{c.replies} repl{c.replies === 1 ? "y" : "ies"} · {when(c.lastActivityAt)}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_UI[c.status].tone}`}>{STATUS_UI[c.status].label}</span>
              </button>
            </motion.li>
          ))}
        </ul>
      </section>

      <Modal open={creating} onClose={() => setCreating(false)} title="New complaint">
        {creating && (
          <NewComplaintForm onCreated={(d) => { setCreating(false); setItems((prev) => [d.summary, ...prev]); setOpenId(d.summary.id); setDetail(d); }} />
        )}
      </Modal>

      <Modal wide open={openId !== null} onClose={() => { setOpenId(null); setDetail(null); reload(); }}
             title={detail ? `Complaint #${detail.summary.id}` : "Complaint"}>
        {detail ? (
          <DetailPanel key={detail.summary.id} mode={mode} detail={detail} onUpdated={setDetail} />
        ) : (
          <p className="py-8 text-center text-sm text-muted">Loading…</p>
        )}
      </Modal>
    </>
  );
}

function NewComplaintForm({ onCreated }: { onCreated: (d: ComplaintDetail) => void }) {
  const [category, setCategory] = useState<ComplaintCategory>("PLUMBING");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    try {
      const body = new FormData();
      body.set("category", category);
      body.set("title", String(f.get("title")));
      body.set("description", String(f.get("description")));
      for (const p of files) body.append("photos", await prepareProof(p));
      onCreated(await createComplaint(body));
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs text-muted">
        <span className="mb-1 block">What is it about?</span>
        <select value={category} onChange={(e) => setCategory(e.target.value as ComplaintCategory)} className="field">
          {(Object.keys(CATEGORY_LABEL) as ComplaintCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
        </select>
      </label>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Short title</span>
        <input name="title" required maxLength={120} className="field" placeholder="e.g. Water leaking from the bathroom ceiling" autoFocus />
      </label>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Describe the problem</span>
        <textarea name="description" required maxLength={2000} rows={5} className="field resize-y"
                  placeholder="Where is it, since when, and how is it affecting you?" />
      </label>
      <PhotoPicker files={files} onChange={setFiles} />
      {err && <p className="text-sm text-expense">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Sending…" : "Send complaint"}
      </button>
    </form>
  );
}

function DetailPanel({ mode, detail, onUpdated }: { mode: Mode; detail: ComplaintDetail; onUpdated: (d: ComplaintDetail) => void }) {
  const s = detail.summary;
  const resident = mode === "RESIDENT";
  const base = resident ? `/api/me/complaints/${s.id}/attachments/` : `/api/complaints/${s.id}/attachments/`;
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<ComplaintDetail>) {
    setBusy(true); setErr(null);
    try { onUpdated(await fn()); setNote(""); }
    catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    await run(async () => {
      const f = new FormData();
      f.set("body", text);
      for (const p of files) f.append("photos", await prepareProof(p));
      const d = await (resident ? commentOnComplaint(s.id, f) : replyToComplaint(s.id, f));
      setText(""); setFiles([]);
      return d;
    });
  }

  const canWrite = !(resident && s.status === "CLOSED");

  return (
    <div>
      <ComplaintThread detail={detail} photoUrl={(id) => base + id} />

      {resident && s.status === "RESOLVED" && (
        <div className="mt-4 rounded-xl border border-income/30 bg-income/8 p-3">
          <p className="text-sm font-medium text-income">The committee marked this as resolved. Is it solved for you?</p>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="field mt-2" placeholder="If not, tell us what is still wrong (optional)" />
          <div className="mt-2 flex gap-2">
            <button disabled={busy} onClick={() => run(() => confirmComplaint(s.id))}
                    className="rounded-lg bg-income px-3 py-2 text-sm font-medium text-white disabled:opacity-60">Yes, it is solved</button>
            <button disabled={busy} onClick={() => run(() => reopenComplaint(s.id, note))}
                    className="rounded-lg bg-foreground/8 px-3 py-2 text-sm disabled:opacity-60">Not solved yet</button>
          </div>
        </div>
      )}

      {!resident && (
        <div className="mt-4 rounded-xl bg-foreground/5 p-3">
          <p className="mb-2 text-xs text-muted">Change the status (the resident sees it, with your note)</p>
          <input value={note} onChange={(e) => setNote(e.target.value)} className="field" placeholder="Note for the resident (optional)" />
          <div className="mt-2 flex flex-wrap gap-2">
            {(["IN_PROGRESS", "RESOLVED", "CLOSED", "OPEN"] as ComplaintStatus[]).filter((x) => x !== s.status).map((x) => (
              <button key={x} disabled={busy} onClick={() => run(() => setComplaintStatus(s.id, x, note))}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${STATUS_UI[x].tone}`}>
                {x === "OPEN" ? "Reopen" : `Mark ${STATUS_UI[x].label.toLowerCase()}`}
              </button>
            ))}
          </div>
        </div>
      )}

      {canWrite ? (
        <form onSubmit={send} className="mt-4 space-y-2 border-t border-border pt-4">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} className="field resize-y"
                    placeholder={resident ? "Write a message to the committee…" : "Reply to the resident…"} />
          <PhotoPicker files={files} onChange={setFiles} />
          <button disabled={busy || (!text.trim() && files.length === 0)}
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
            <Send className="size-4" />{busy ? "Sending…" : "Send"}
          </button>
        </form>
      ) : (
        <p className="mt-4 border-t border-border pt-4 text-center text-xs text-muted">
          This complaint is closed. If the problem comes back, please raise a new complaint.
        </p>
      )}
      {err && <p className="mt-2 text-sm text-expense">{err}</p>}
    </div>
  );
}
