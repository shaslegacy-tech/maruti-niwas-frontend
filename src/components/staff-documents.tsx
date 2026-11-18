"use client";

import { motion } from "framer-motion";
import { Eye, FileText, Lock, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";
import {
  type DocumentCategory, type StaffDocument,
  deleteDocument, getDocuments, updateDocument, uploadDocument,
} from "@/lib/api";
import { DOC_LABEL, docDate, fileSize, staffOnlyByDefault } from "./documents-shared";
import { Modal } from "./modal";

export function StaffDocuments({ initial, canFinancial = true, readOnly = false }: { initial: StaffDocument[]; canFinancial?: boolean; readOnly?: boolean }) {
  const [docs, setDocs] = useState(initial);
  const [editing, setEditing] = useState<StaffDocument | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try { setDocs(await getDocuments()); } catch (e) { setError((e as Error).message); }
  }, []);

  async function remove(d: StaffDocument) {
    if (!confirm(`Remove “${d.title}”? Residents will no longer see it.`)) return;
    setError(null);
    try { await deleteDocument(d.id); await reload(); } catch (e) { setError((e as Error).message); }
  }

  const shared = docs.filter((d) => d.sharedWithResidents).length;

  return (
    <>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
          <p className="text-sm text-muted">{shared} of {docs.length} documents are visible to residents. {canFinancial ? "Financial documents stay private unless you share them." : "Financial documents are handled by the treasurer."}</p>
        </div>
        {!readOnly && (
          <button onClick={() => setEditing("new")}
                  className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
            <Plus className="size-4" />Upload
          </button>
        )}
      </header>

      {error && <p className="mb-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}

      <section className="glass overflow-hidden">
        {docs.length === 0 && <p className="p-10 text-center text-sm text-muted">No documents yet. Use “Upload” to add minutes, rules, notices and more.</p>}
        <ul className="divide-y divide-border">
          {docs.map((d, i) => (
            <motion.li key={d.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                       className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5 sm:px-5">
              <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${d.sensitive ? "bg-expense/12 text-expense" : "bg-accent/12 text-accent"}`}>
                {d.sensitive ? <ShieldAlert className="size-5" /> : <FileText className="size-5" />}
              </span>
              <div className="min-w-0 flex-1 basis-52">
                <p className="truncate text-sm font-medium">{d.title}</p>
                <p className="truncate text-xs text-muted">
                  {DOC_LABEL[d.category]} · {docDate(d.docDate, d.createdAt)} · {fileSize(d.sizeBytes)} · by {d.uploadedBy}
                </p>
              </div>
              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                d.sharedWithResidents ? "bg-income/15 text-income" : "bg-foreground/10 text-muted"}`}>
                {d.sharedWithResidents ? <><Eye className="size-3" />Residents can see</> : <><Lock className="size-3" />Staff only</>}
              </span>
              <div className="flex items-center gap-1">
                <a href={`/api/documents/${d.id}/file`} target="_blank" rel="noopener noreferrer"
                   className="rounded-lg bg-foreground/8 px-2.5 py-1.5 text-xs transition hover:bg-foreground/12">Open</a>
                {!readOnly && (
                  <>
                    <button onClick={() => setEditing(d)} aria-label="Edit" className="grid size-8 place-items-center rounded-lg text-muted hover:text-foreground"><Pencil className="size-4" /></button>
                    <button onClick={() => remove(d)} aria-label="Remove" className="grid size-8 place-items-center rounded-lg text-muted hover:text-expense"><Trash2 className="size-4" /></button>
                  </>
                )}
              </div>
            </motion.li>
          ))}
        </ul>
      </section>

      <Modal open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Upload a document" : "Edit document"}>
        {editing !== null && <DocForm canFinancial={canFinancial} initial={editing === "new" ? null : editing} onSaved={() => { setEditing(null); reload(); }} />}
      </Modal>
    </>
  );
}

function DocForm({ initial, onSaved, canFinancial }: { initial: StaffDocument | null; onSaved: () => void; canFinancial: boolean }) {
  const [category, setCategory] = useState<DocumentCategory>(initial?.category ?? "MINUTES");
  const [visibility, setVisibility] = useState<"RESIDENTS" | "STAFF">(initial?.visibility ?? "RESIDENTS");
  const [touched, setTouched] = useState(initial !== null);
  const [confirm, setConfirm] = useState(Boolean(initial?.sharedWithResidents && initial.sensitive));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const needsConfirm = category === "FINANCIAL" && visibility === "RESIDENTS";

  function pickCategory(c: DocumentCategory) {
    setCategory(c);
    if (!touched) setVisibility(staffOnlyByDefault(c) ? "STAFF" : "RESIDENTS");   // the category decides until you choose
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setErr(null);
    try {
      if (initial) {
        await updateDocument(initial.id, {
          title: String(f.get("title")), category, description: String(f.get("description") ?? "") || undefined,
          docDate: String(f.get("docDate") ?? "") || undefined, visibility, confirmSensitive: needsConfirm && confirm,
        });
      } else {
        const body = new FormData();
        body.set("title", String(f.get("title")));
        body.set("category", category);
        body.set("description", String(f.get("description") ?? ""));
        const date = String(f.get("docDate") ?? "");
        if (date) body.set("docDate", date);
        body.set("visibility", visibility);
        body.set("confirmSensitive", String(needsConfirm && confirm));
        body.set("file", f.get("file") as File);
        await uploadDocument(body);
      }
      onSaved();
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Title</span>
        <input name="title" required maxLength={160} defaultValue={initial?.title} className="field" autoFocus placeholder="e.g. AGM minutes, 12 Oct 2026" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Type</span>
          <select value={category} onChange={(e) => pickCategory(e.target.value as DocumentCategory)} className="field">
            {(Object.keys(DOC_LABEL) as DocumentCategory[]).filter((c) => canFinancial || c !== "FINANCIAL").map((c) => <option key={c} value={c}>{DOC_LABEL[c]}</option>)}
          </select>
        </label>
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Document date (optional)</span>
          <input name="docDate" type="date" defaultValue={initial?.docDate ?? ""} className="field" />
        </label>
      </div>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Short description (optional)</span>
        <input name="description" maxLength={300} defaultValue={initial?.description ?? ""} className="field" />
      </label>
      {!initial && (
        <label className="block text-xs text-muted">
          <span className="mb-1 block">File (PDF or photo, up to 10 MB)</span>
          <input name="file" type="file" required accept="application/pdf,image/*" className="field" />
        </label>
      )}

      <fieldset className="rounded-xl border border-border p-3">
        <legend className="px-1 text-xs text-muted">Who can see it?</legend>
        <div className="grid grid-cols-2 gap-2">
          {([["RESIDENTS", "Residents", Eye], ["STAFF", "Staff only", Lock]] as const).map(([value, label, Icon]) => (
            <button type="button" key={value} onClick={() => { setTouched(true); setVisibility(value); }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm transition ${
                      visibility === value ? "bg-accent text-white" : "bg-foreground/6 text-muted hover:text-foreground"}`}>
              <Icon className="size-4" />{label}
            </button>
          ))}
        </div>
        {category === "FINANCIAL" && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-expense">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
            Bank statements and complete financial reports are private by default.
          </p>
        )}
        {needsConfirm && (
          <label className="mt-2 flex items-start gap-2 text-xs">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5" />
            <span>I understand every resident will be able to see this financial document.</span>
          </label>
        )}
      </fieldset>

      {err && <p className="text-sm text-expense">{err}</p>}
      <button disabled={busy || (needsConfirm && !confirm)} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Saving…" : initial ? "Save changes" : "Upload"}
      </button>
    </form>
  );
}
