"use client";

import { ArrowLeft, CalendarDays, ChevronDown, ChevronUp, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import {
  type AttendanceStatus, type DocumentCategory, type MeetingDetail, type MeetingKind, type ResolutionInput,
  type ResolutionOutcome, type ResolutionView,
  addResolution, cancelMeeting, deleteMeeting, deleteResolution, getMeeting, markMeetingHeld,
  saveAgenda, saveAttendance, saveMinutes, scheduleMeeting, updateMeeting, updateResolution, uploadMeetingDocument,
} from "@/lib/api";
import { DOC_LABEL, fileSize, staffOnlyByDefault } from "./documents-shared";
import { APPROVAL_UI, KIND_LABEL, OUTCOME_UI, STATUS_UI, type Tab, dayTime, toIso, toLocalInput, votesLine } from "./meeting-shared";
import { Modal } from "./modal";

type Run = (fn: () => Promise<MeetingDetail>) => Promise<boolean>;

export function MeetingDetailView({ initial, readOnly, initialTab = "overview" }: { initial: MeetingDetail; readOnly: boolean; initialTab?: Tab }) {
  const router = useRouter();
  const [d, setD] = useState(initial);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const s = d.summary;
  const editable = !readOnly && s.status !== "CANCELLED";
  const recordable = editable && (s.status === "SCHEDULED" || s.status === "HELD");

  const run: Run = async (fn) => {
    setBusy(true); setError(null);
    try { setD(await fn()); return true; }
    catch (e) { setError((e as Error).message); return false; }
    finally { setBusy(false); }
  };

  async function remove() {
    if (!confirm(`Remove “${s.title}”? Its agenda, attendance and decisions will be removed from every screen.`)) return;
    setBusy(true); setError(null);
    try { await deleteMeeting(s.id); router.push("/meetings"); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }

  const tabs: [Tab, string][] = [
    ["overview", "Overview"], ["agenda", `Agenda (${d.agenda.length})`], ["attendance", "Attendance"],
    ["minutes", "Minutes"], ["decisions", `Decisions (${d.resolutions.length})`], ["documents", `Documents (${d.documents.length})`],
  ];

  return (
    <>
      <Link href="/meetings" className="mb-3 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground"><ArrowLeft className="size-3.5" />All meetings</Link>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{s.title}</h1>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_UI[s.status].tone}`}>{STATUS_UI[s.status].label}</span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted">
            <span>{KIND_LABEL[s.kind]}</span>
            <span className="flex items-center gap-1"><CalendarDays className="size-3.5" />{dayTime(s.scheduledAt)}</span>
            {s.venue && <span className="flex items-center gap-1"><MapPin className="size-3.5" />{s.venue}</span>}
          </p>
        </div>
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            {s.status === "DRAFT" && (
              <button disabled={busy} onClick={() => run(() => scheduleMeeting(s.id))}
                      className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60">Schedule</button>
            )}
            {(s.status === "DRAFT" || s.status === "SCHEDULED") && (
              <>
                <button disabled={busy} onClick={() => run(() => markMeetingHeld(s.id))}
                        className="rounded-lg bg-income/15 px-3 py-2 text-sm font-medium text-income transition hover:bg-income/25 disabled:opacity-60">Mark as held</button>
                <button disabled={busy} onClick={() => setCancelling(true)}
                        className="rounded-lg bg-foreground/8 px-3 py-2 text-sm transition hover:bg-expense/15 hover:text-expense disabled:opacity-60">Cancel meeting</button>
              </>
            )}
            {editable && <button onClick={() => setEditing(true)} aria-label="Edit details" className="grid size-9 place-items-center rounded-lg text-muted hover:text-foreground"><Pencil className="size-4" /></button>}
            <button onClick={remove} aria-label="Remove meeting" className="grid size-9 place-items-center rounded-lg text-muted hover:text-expense"><Trash2 className="size-4" /></button>
          </div>
        )}
      </header>

      {error && <p className="mb-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}

      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {tabs.map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${tab === key ? "bg-accent text-white" : "glass text-muted hover:text-foreground"}`}>
            {label}
          </button>
        ))}
      </div>

      <section className="glass p-5">
        {tab === "overview" && <Overview d={d} />}
        {tab === "agenda" && <AgendaPanel key={d.agenda.map((a) => a.id).join()} d={d} canEdit={editable} busy={busy} run={run} />}
        {tab === "attendance" && <AttendancePanel d={d} canEdit={recordable} busy={busy} run={run} />}
        {tab === "minutes" && <MinutesPanel d={d} canEdit={recordable} busy={busy} run={run} />}
        {tab === "decisions" && <DecisionsPanel d={d} canEdit={recordable} busy={busy} run={run} />}
        {tab === "documents" && <DocumentsPanel d={d} canEdit={editable} onChanged={async () => { await run(() => getMeeting(s.id)); }} />}
      </section>

      <Modal open={editing} onClose={() => setEditing(false)} title="Edit meeting details">
        {editing && <DetailsForm d={d} onSaved={(nd) => { setD(nd); setEditing(false); }} />}
      </Modal>
      <Modal open={cancelling} onClose={() => setCancelling(false)} title="Cancel this meeting">
        {cancelling && <CancelForm d={d} onDone={(nd) => { setD(nd); setCancelling(false); }} />}
      </Modal>
    </>
  );
}

/* ---------------------------------------------------------------- overview */

function Overview({ d }: { d: MeetingDetail }) {
  const s = d.summary;
  return (
    <div className="space-y-4">
      {s.status === "CANCELLED" && (
        <p className="rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">Cancelled{d.cancelledReason ? `: ${d.cancelledReason}` : ""}</p>
      )}
      <div>
        <h2 className="mb-1 text-xs font-medium text-muted">Note for residents</h2>
        <p className="whitespace-pre-wrap text-sm">{d.description ?? <span className="text-muted">None</span>}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        {([
          ["Agenda items", String(s.agendaCount)], ["Decisions", String(s.resolutionCount)],
          ["Present", `${d.attendance.filter((a) => a.status === "PRESENT").length} of ${d.attendance.length} flats`],
          ["Minutes", s.minutesPublished ? "Shared with residents" : d.minutes ? "Saved, not shared" : "Not written"],
        ] as const).map(([label, value]) => (
          <div key={label} className="rounded-xl bg-foreground/5 p-3"><dt className="text-xs text-muted">{label}</dt><dd className="mt-0.5 font-medium">{value}</dd></div>
        ))}
      </dl>
      <p className="text-xs text-muted">
        {s.status === "DRAFT" && "This is a draft: residents cannot see it yet. Schedule it to send the invitation and agenda to residents' screens."}
        {s.status === "SCHEDULED" && "Residents can see the invitation and the agenda. Attendance is never shown to residents."}
        {s.status === "HELD" && "Residents see the minutes and the approved decisions only after you share the minutes."}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ agenda */

function AgendaPanel({ d, canEdit, busy, run }: { d: MeetingDetail; canEdit: boolean; busy: boolean; run: Run }) {
  const [rows, setRows] = useState(d.agenda.map((a) => ({ title: a.title, notes: a.notes ?? "" })));
  const move = (i: number, by: number) => setRows((r) => {
    const j = i + by; if (j < 0 || j >= r.length) return r;
    const c = [...r]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });

  if (!canEdit) {
    return rows.length === 0 ? <p className="py-6 text-center text-sm text-muted">No agenda yet.</p> : (
      <ol className="space-y-3">
        {d.agenda.map((a) => (
          <li key={a.id} className="flex gap-3"><span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent/12 text-xs font-medium text-accent">{a.position}</span>
            <div><p className="text-sm font-medium">{a.title}</p>{a.notes && <p className="text-xs text-muted">{a.notes}</p>}</div></li>
        ))}
      </ol>
    );
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 && <p className="py-2 text-sm text-muted">No agenda items yet. Add the points to be discussed, in order.</p>}
      {rows.map((r, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="mt-2 grid size-6 shrink-0 place-items-center rounded-full bg-accent/12 text-xs font-medium text-accent">{i + 1}</span>
          <div className="min-w-0 flex-1 space-y-1.5">
            <input value={r.title} onChange={(e) => setRows((x) => x.map((y, k) => (k === i ? { ...y, title: e.target.value } : y)))} maxLength={160} className="field" placeholder="Agenda item" />
            <input value={r.notes} onChange={(e) => setRows((x) => x.map((y, k) => (k === i ? { ...y, notes: e.target.value } : y)))} maxLength={500} className="field" placeholder="Notes (optional)" />
          </div>
          <div className="flex flex-col">
            <button type="button" onClick={() => move(i, -1)} aria-label="Move up" className="grid size-6 place-items-center text-muted hover:text-foreground"><ChevronUp className="size-4" /></button>
            <button type="button" onClick={() => move(i, 1)} aria-label="Move down" className="grid size-6 place-items-center text-muted hover:text-foreground"><ChevronDown className="size-4" /></button>
          </div>
          <button type="button" onClick={() => setRows((x) => x.filter((_, k) => k !== i))} aria-label="Remove item" className="mt-1.5 grid size-7 place-items-center rounded-md text-muted hover:text-expense"><Trash2 className="size-4" /></button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={() => setRows((x) => [...x, { title: "", notes: "" }])} className="flex items-center gap-1.5 rounded-lg bg-foreground/8 px-3 py-2 text-sm"><Plus className="size-4" />Add item</button>
        <button disabled={busy} onClick={() => run(() => saveAgenda(d.summary.id, rows.filter((r) => r.title.trim()).map((r) => ({ title: r.title.trim(), notes: r.notes.trim() || undefined }))))}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? "Saving…" : "Save agenda"}</button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- attendance */

const ATT: [AttendanceStatus, string][] = [["PRESENT", "Present"], ["ABSENT", "Absent"], ["APOLOGY", "Apology"]];

function AttendancePanel({ d, canEdit, busy, run }: { d: MeetingDetail; canEdit: boolean; busy: boolean; run: Run }) {
  const [rows, setRows] = useState(() => d.attendance.map((a) => ({ ...a, attendeeName: a.attendeeName ?? "", note: a.note ?? "" })));
  const present = rows.filter((r) => r.status === "PRESENT").length;
  const set = (flatId: number, patch: Partial<(typeof rows)[number]>) => setRows((x) => x.map((r) => (r.flatId === flatId ? { ...r, ...patch } : r)));

  return (
    <div>
      <p className="mb-3 text-sm"><b>{present}</b> of {rows.length} flats present
        {!canEdit && d.summary.status !== "CANCELLED" && <span className="ml-2 text-xs text-muted">{d.summary.status === "DRAFT" ? "Schedule the meeting (or mark it held) to record attendance." : ""}</span>}
      </p>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.flatId} className="py-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="min-w-0 flex-1 basis-40"><p className="text-sm font-medium">Flat {r.flatNumber}</p><p className="truncate text-xs text-muted">{r.ownerName}</p></div>
              <div className="flex gap-1">
                {ATT.map(([value, label]) => (
                  <button key={value} type="button" disabled={!canEdit}
                          onClick={() => set(r.flatId, { status: r.status === value ? null : value })}
                          className={`rounded-lg px-2.5 py-1 text-xs transition ${r.status === value
                            ? value === "PRESENT" ? "bg-income text-white" : value === "ABSENT" ? "bg-expense text-white" : "bg-warn text-white"
                            : "bg-foreground/8 text-muted"} ${canEdit ? "hover:text-foreground" : "cursor-default"}`}>{label}</button>
                ))}
              </div>
            </div>
            {canEdit && r.status === "PRESENT" && (
              <input value={r.attendeeName} onChange={(e) => set(r.flatId, { attendeeName: e.target.value })} maxLength={120} className="field mt-2" placeholder="Who attended from this flat? (optional)" />
            )}
            {!canEdit && r.status === "PRESENT" && r.attendeeName && <p className="mt-1 text-xs text-muted">Attended: {r.attendeeName}</p>}
          </li>
        ))}
      </ul>
      {canEdit && (
        <button disabled={busy} className="mt-3 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                onClick={() => run(() => saveAttendance(d.summary.id, rows.filter((r) => r.status !== null).map((r) => ({
                  flatId: r.flatId, status: r.status as AttendanceStatus, attendeeName: r.attendeeName.trim() || undefined, note: r.note.trim() || undefined }))))}>
          {busy ? "Saving…" : "Save attendance"}
        </button>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- minutes */

function MinutesPanel({ d, canEdit, busy, run }: { d: MeetingDetail; canEdit: boolean; busy: boolean; run: Run }) {
  const [text, setText] = useState(d.minutes ?? "");
  const [shared, setShared] = useState(d.summary.minutesPublished);
  const held = d.summary.status === "HELD";

  if (!canEdit) {
    return d.minutes ? <p className="whitespace-pre-wrap text-sm">{d.minutes}</p>
      : <p className="py-6 text-center text-sm text-muted">{d.summary.status === "DRAFT" ? "Minutes can be written once the meeting is scheduled or held." : "No minutes yet."}</p>;
  }
  return (
    <div className="space-y-3">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={14} maxLength={30000} className="field resize-y"
                placeholder="Write the minutes: who chaired, what was discussed, what was agreed." />
      <label className={`flex items-start gap-2 rounded-xl border border-border p-3 text-sm ${held ? "" : "opacity-60"}`}>
        <input type="checkbox" checked={shared} disabled={!held} onChange={(e) => setShared(e.target.checked)} className="mt-0.5" />
        <span>Share the minutes with residents
          <span className="block text-xs text-muted">{held ? "Residents will also see the decisions the Chairman has approved. Attendance is never shown." : "Mark the meeting as held first."}</span>
        </span>
      </label>
      <button disabled={busy} onClick={() => run(() => saveMinutes(d.summary.id, text, shared))}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{busy ? "Saving…" : "Save minutes"}</button>
    </div>
  );
}

/* --------------------------------------------------------------- decisions */

function DecisionsPanel({ d, canEdit, busy, run }: { d: MeetingDetail; canEdit: boolean; busy: boolean; run: Run }) {
  const [form, setForm] = useState<ResolutionView | "new" | null>(null);

  return (
    <div>
      {canEdit && (
        <button onClick={() => setForm("new")} className="mb-3 flex items-center gap-1.5 rounded-lg bg-accent/12 px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent/20">
          <Plus className="size-4" />Add a decision
        </button>
      )}
      {d.resolutions.length === 0 && <p className="py-6 text-center text-sm text-muted">No decisions recorded yet.</p>}
      <ul className="space-y-3">
        {d.resolutions.map((r) => {
          const ap = APPROVAL_UI[r.approvalStatus];
          const votes = votesLine(r.votesFor, r.votesAgainst, r.abstained);
          return (
            <li key={r.id} className="rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-muted">Resolution {r.number}</span>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${OUTCOME_UI[r.outcome].tone}`}>{OUTCOME_UI[r.outcome].label}</span>
                {r.important && <span className="rounded-full bg-expense/12 px-2 py-0.5 text-[11px] font-medium text-expense">Important</span>}
                {ap && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${ap.tone}`}>{ap.label}</span>}
                {canEdit && (
                  <div className="ml-auto flex items-center">
                    <button onClick={() => setForm(r)} aria-label="Edit decision" className="grid size-7 place-items-center rounded-md text-muted hover:text-foreground"><Pencil className="size-3.5" /></button>
                    <button onClick={() => { if (confirm(`Remove resolution ${r.number}?`)) run(() => deleteResolution(r.id)); }} aria-label="Remove decision"
                            className="grid size-7 place-items-center rounded-md text-muted hover:text-expense"><Trash2 className="size-3.5" /></button>
                  </div>
                )}
              </div>
              <p className="mt-2 text-sm font-medium">{r.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{r.text}</p>
              {votes && <p className="mt-2 text-xs text-muted">{votes}</p>}
              {r.approvalStatus === "REJECTED" && r.reviewNote && (
                <p className="mt-2 rounded-lg bg-expense/8 px-3 py-2 text-xs text-expense">Rejected{r.reviewedBy ? ` by ${r.reviewedBy}` : ""}: {r.reviewNote}</p>
              )}
              {r.approvalStatus === "PENDING" && <p className="mt-2 text-xs text-muted">Residents will see this only after the Chairman approves it.</p>}
            </li>
          );
        })}
      </ul>
      <Modal open={form !== null} onClose={() => setForm(null)} title={form === "new" ? "Add a decision" : "Edit decision"}>
        {form !== null && (
          <ResolutionForm initial={form === "new" ? null : form} busy={busy}
                          onSave={async (input) => {
                            const ok = await run(() => (form === "new" ? addResolution(d.summary.id, input) : updateResolution(form.id, input)));
                            if (ok) setForm(null);
                          }} />
        )}
      </Modal>
    </div>
  );
}

function ResolutionForm({ initial, busy, onSave }: { initial: ResolutionView | null; busy: boolean; onSave: (r: ResolutionInput) => void }) {
  const [important, setImportant] = useState(initial?.important ?? false);
  const num = (v: FormDataEntryValue | null) => (String(v ?? "").trim() === "" ? undefined : Number(v));

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSave({
      title: String(f.get("title")).trim(), text: String(f.get("text")).trim(), outcome: String(f.get("outcome")) as ResolutionOutcome,
      votesFor: num(f.get("votesFor")), votesAgainst: num(f.get("votesAgainst")), abstained: num(f.get("abstained")), important,
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs text-muted"><span className="mb-1 block">Title</span>
        <input name="title" required maxLength={160} defaultValue={initial?.title} className="field" autoFocus placeholder="e.g. Appoint an auditor for 2026-27" /></label>
      <label className="block text-xs text-muted"><span className="mb-1 block">Resolution text</span>
        <textarea name="text" required maxLength={4000} rows={5} defaultValue={initial?.text} className="field resize-y" /></label>
      <label className="block text-xs text-muted"><span className="mb-1 block">Outcome</span>
        <select name="outcome" defaultValue={initial?.outcome ?? "PASSED"} className="field">
          <option value="PASSED">Passed</option><option value="REJECTED">Not passed</option><option value="DEFERRED">Deferred</option></select></label>
      <div className="grid grid-cols-3 gap-3">
        {([["votesFor", "For", initial?.votesFor], ["votesAgainst", "Against", initial?.votesAgainst], ["abstained", "Abstained", initial?.abstained]] as const).map(([name, label, value]) => (
          <label key={name} className="block text-xs text-muted"><span className="mb-1 block">{label} (optional)</span>
            <input name={name} type="number" min={0} max={10000} defaultValue={value ?? ""} className="field" /></label>
        ))}
      </div>
      <label className="flex items-start gap-2 rounded-xl border border-border p-3 text-sm">
        <input type="checkbox" checked={important} onChange={(e) => setImportant(e.target.checked)} className="mt-0.5" />
        <span>Important decision<span className="block text-xs text-muted">Residents see it only after the Chairman approves it.</span></span>
      </label>
      {initial?.important && initial.approvalStatus === "APPROVED" && <p className="text-xs text-warn">Saving changes sends this decision back to the Chairman for approval.</p>}
      <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Saving…" : important ? "Save and submit for approval" : "Save decision"}
      </button>
    </form>
  );
}

/* --------------------------------------------------------------- documents */

const MEETING_DOC_TYPES: DocumentCategory[] = ["MINUTES", "RESOLUTION", "NOTICE", "CIRCULAR", "IMPORTANT", "REGISTRATION", "RULES", "OTHER"];

function DocumentsPanel({ d, canEdit, onChanged }: { d: MeetingDetail; canEdit: boolean; onChanged: () => Promise<void> }) {
  const [uploading, setUploading] = useState(false);
  return (
    <div>
      {canEdit && (
        <button onClick={() => setUploading(true)} className="mb-3 flex items-center gap-1.5 rounded-lg bg-accent/12 px-3 py-2 text-sm font-medium text-accent transition hover:bg-accent/20">
          <Plus className="size-4" />Attach a document
        </button>
      )}
      {d.documents.length === 0 && <p className="py-6 text-center text-sm text-muted">No documents attached.</p>}
      <ul className="divide-y divide-border">
        {d.documents.map((doc) => (
          <li key={doc.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
            <div className="min-w-0 flex-1 basis-48">
              <p className="truncate text-sm font-medium">{doc.title}</p>
              <p className="text-xs text-muted">{DOC_LABEL[doc.category]} · {fileSize(doc.sizeBytes)} · {doc.sharedWithResidents ? "visible to residents" : "staff only"}</p>
            </div>
            <a href={`/api/documents/${doc.id}/file`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-foreground/8 px-3 py-1.5 text-xs transition hover:bg-foreground/12">Open</a>
          </li>
        ))}
      </ul>
      <Modal open={uploading} onClose={() => setUploading(false)} title="Attach a document">
        {uploading && <UploadForm meetingId={d.summary.id} onDone={async () => { setUploading(false); await onChanged(); }} />}
      </Modal>
    </div>
  );
}

function UploadForm({ meetingId, onDone }: { meetingId: number; onDone: () => void }) {
  const [category, setCategory] = useState<DocumentCategory>("MINUTES");
  const [shared, setShared] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    try {
      const body = new FormData();
      body.set("title", String(f.get("title")));
      body.set("category", category);
      body.set("description", String(f.get("description") ?? ""));
      body.set("visibility", shared ? "RESIDENTS" : "STAFF");
      body.set("file", f.get("file") as File);
      await uploadMeetingDocument(meetingId, body);
      onDone();
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs text-muted"><span className="mb-1 block">Title</span><input name="title" required maxLength={160} className="field" autoFocus placeholder="e.g. Signed minutes" /></label>
      <label className="block text-xs text-muted"><span className="mb-1 block">Type</span>
        <select value={category} onChange={(e) => { const c = e.target.value as DocumentCategory; setCategory(c); setShared(!staffOnlyByDefault(c)); }} className="field">
          {MEETING_DOC_TYPES.map((c) => <option key={c} value={c}>{DOC_LABEL[c]}</option>)}</select></label>
      <label className="block text-xs text-muted"><span className="mb-1 block">Short description (optional)</span><input name="description" maxLength={300} className="field" /></label>
      <label className="block text-xs text-muted"><span className="mb-1 block">File (PDF or photo, up to 10 MB)</span>
        <input name="file" type="file" required accept="application/pdf,image/*" className="field" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />Residents can see this document</label>
      <p className="text-xs text-muted">Bank statements and financial reports are kept on the Documents screen, under the treasurer's control.</p>
      {err && <p className="text-sm text-expense">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60">{busy ? "Uploading…" : "Attach"}</button>
    </form>
  );
}

/* ------------------------------------------------------------------ dialogs */

function DetailsForm({ d, onSaved }: { d: MeetingDetail; onSaved: (d: MeetingDetail) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    try {
      onSaved(await updateMeeting(d.summary.id, {
        kind: String(f.get("kind")) as MeetingKind, title: String(f.get("title")).trim(), scheduledAt: toIso(String(f.get("scheduledAt"))),
        venue: String(f.get("venue") ?? "").trim() || undefined, description: String(f.get("description") ?? "").trim() || undefined,
      }));
    } catch (e2) { setErr((e2 as Error).message); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs text-muted"><span className="mb-1 block">Type of meeting</span>
        <select name="kind" defaultValue={d.summary.kind} className="field">{(Object.keys(KIND_LABEL) as MeetingKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
      <label className="block text-xs text-muted"><span className="mb-1 block">Title</span><input name="title" required maxLength={160} defaultValue={d.summary.title} className="field" /></label>
      <label className="block text-xs text-muted"><span className="mb-1 block">Date and time</span><input name="scheduledAt" type="datetime-local" required defaultValue={toLocalInput(d.summary.scheduledAt)} className="field" /></label>
      <label className="block text-xs text-muted"><span className="mb-1 block">Venue</span><input name="venue" maxLength={160} defaultValue={d.summary.venue ?? ""} className="field" /></label>
      <label className="block text-xs text-muted"><span className="mb-1 block">Note for residents</span><textarea name="description" maxLength={4000} rows={3} defaultValue={d.description ?? ""} className="field resize-y" /></label>
      {err && <p className="text-sm text-expense">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
    </form>
  );
}

function CancelForm({ d, onDone }: { d: MeetingDetail; onDone: (d: MeetingDetail) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    try { onDone(await cancelMeeting(d.summary.id, String(f.get("reason")))); }
    catch (e2) { setErr((e2 as Error).message); setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted">{d.summary.status === "SCHEDULED" ? "Residents who can see this meeting will see that it was cancelled, with your reason." : "This draft will be marked as cancelled."}</p>
      <label className="block text-xs text-muted"><span className="mb-1 block">Reason</span>
        <textarea name="reason" required maxLength={300} rows={3} className="field resize-y" autoFocus placeholder="e.g. Quorum could not be arranged; new date to follow" /></label>
      {err && <p className="text-sm text-expense">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-expense py-2.5 text-sm font-medium text-white disabled:opacity-60">{busy ? "Cancelling…" : "Cancel the meeting"}</button>
    </form>
  );
}
