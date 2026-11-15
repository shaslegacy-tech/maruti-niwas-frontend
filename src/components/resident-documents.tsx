"use client";

import { Download, FileText, Search } from "lucide-react";
import { useState } from "react";
import type { DocumentCategory, ResidentDocument } from "@/lib/api";
import { docDate, fileSize } from "./documents-shared";

const GROUPS: { key: DocumentCategory; title: string }[] = [
  { key: "NOTICE", title: "Society notices" },
  { key: "MINUTES", title: "Meeting minutes" },
  { key: "RULES", title: "Rules & bylaws" },
  { key: "IMPORTANT", title: "Important documents" },
  { key: "OTHER", title: "Other documents" },
  { key: "FINANCIAL", title: "Financial documents" },
];

export function ResidentDocuments({ docs }: { docs: ResidentDocument[] }) {
  const [q, setQ] = useState("");
  const match = (d: ResidentDocument) => `${d.title} ${d.description ?? ""}`.toLowerCase().includes(q.trim().toLowerCase());
  const filtered = docs.filter(match);

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        <p className="text-sm text-muted">Notices, meeting minutes, rules and other documents shared by the committee</p>
      </header>

      <label className="glass mb-4 flex items-center gap-2 px-3.5 py-2.5">
        <Search className="size-4 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search documents" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>

      {docs.length === 0 ? (
        <p className="glass p-10 text-center text-sm text-muted">No documents have been shared yet.</p>
      ) : filtered.length === 0 ? (
        <p className="glass p-10 text-center text-sm text-muted">Nothing matches “{q}”.</p>
      ) : (
        <div className="space-y-4">
          {GROUPS.map(({ key, title }) => {
            const list = filtered.filter((d) => d.category === key);
            if (list.length === 0) return null;
            return (
              <section key={key} className="glass overflow-hidden">
                <h2 className="px-5 pb-2 pt-4 text-sm font-medium">{title}</h2>
                <ul className="divide-y divide-border">
                  {list.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent"><FileText className="size-5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{d.title}</p>
                        {d.description && <p className="truncate text-xs text-muted">{d.description}</p>}
                        <p className="text-[11px] text-muted">{docDate(d.docDate, d.createdAt)} · {fileSize(d.sizeBytes)}</p>
                      </div>
                      <a href={`/api/me/documents/${d.id}/file`} target="_blank" rel="noopener noreferrer"
                         className="rounded-lg bg-accent/12 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/20">Open</a>
                      <a href={`/api/me/documents/${d.id}/file`} download aria-label="Download" title="Download"
                         className="grid size-8 place-items-center rounded-lg text-muted hover:text-foreground"><Download className="size-4" /></a>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
