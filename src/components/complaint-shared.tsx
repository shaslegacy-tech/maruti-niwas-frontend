"use client";

import { ImagePlus, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { AttachmentMeta, ComplaintCategory, ComplaintDetail, ComplaintStatus } from "@/lib/api";
import { when } from "./resident-shared";

export const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  PLUMBING: "Plumbing", ELECTRICAL: "Electrical", LIFT: "Lift", CLEANING: "Cleaning", SECURITY: "Security",
  PARKING: "Parking", WATER: "Water supply", NOISE: "Noise", OTHER: "Other",
};

export const STATUS_UI: Record<ComplaintStatus, { label: string; tone: string }> = {
  OPEN: { label: "Open", tone: "bg-warn/15 text-warn" },
  IN_PROGRESS: { label: "In progress", tone: "bg-accent/15 text-accent" },
  RESOLVED: { label: "Resolved", tone: "bg-income/15 text-income" },
  CLOSED: { label: "Closed", tone: "bg-foreground/10 text-muted" },
};

/** Choose up to a few photos and see them before sending. */
export function PhotoPicker({ files, onChange, max = 3 }: { files: File[]; onChange: (f: File[]) => void; max?: number }) {
  const [previews, setPreviews] = useState<string[]>([]);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {previews.map((src, i) => (
          <div key={src} className="relative size-16 overflow-hidden rounded-lg border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Photo ${i + 1}`} className="size-full object-cover" />
            <button type="button" aria-label="Remove photo" onClick={() => onChange(files.filter((_, j) => j !== i))}
                    className="absolute right-0.5 top-0.5 grid size-5 place-items-center rounded-full bg-black/60 text-white">
              <X className="size-3" />
            </button>
          </div>
        ))}
        {files.length < max && (
          <label className="flex size-16 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border border-dashed border-border text-[10px] text-muted transition hover:text-foreground">
            <ImagePlus className="size-5" />Photo
            <input type="file" accept="image/*" multiple className="sr-only"
                   onChange={(e) => {
                     const picked = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
                     onChange([...files, ...picked].slice(0, max));
                     e.target.value = "";
                   }} />
          </label>
        )}
      </div>
      <p className="mt-1 text-[11px] text-muted">Up to {max} photos. Large photos are shrunk before they are sent.</p>
    </div>
  );
}

function Photos({ items, url }: { items: AttachmentMeta[]; url: (id: number) => string }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((a) => (
        <a key={a.id} href={url(a.id)} target="_blank" rel="noopener noreferrer"
           className="block size-20 overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url(a.id)} alt={a.name} loading="lazy" className="size-full object-cover" />
        </a>
      ))}
    </div>
  );
}

/** The complaint, its photos and the whole conversation. Shared by the resident and staff screens. */
export function ComplaintThread({ detail, photoUrl }: { detail: ComplaintDetail; photoUrl: (attachmentId: number) => string }) {
  const { summary: s } = detail;
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_UI[s.status].tone}`}>{STATUS_UI[s.status].label}</span>
        <span className="rounded-full bg-foreground/8 px-2 py-0.5 text-[11px]">{CATEGORY_LABEL[s.category]}</span>
        <span className="text-[11px] text-muted">Flat {s.flatNumber} · raised {when(s.createdAt)}</span>
      </div>
      <h3 className="text-base font-semibold">{s.title}</h3>
      <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{detail.description}</p>
      <Photos items={detail.attachments} url={photoUrl} />

      <ul className="mt-5 space-y-3 border-t border-border pt-4">
        {detail.thread.length === 0 && <li className="text-center text-xs text-muted">No replies yet</li>}
        {detail.thread.map((e) =>
          e.kind === "STATUS" ? (
            <li key={e.id} className="text-center text-xs text-muted">
              {e.authorName} marked it <b className="text-foreground">{e.statusTo ? STATUS_UI[e.statusTo].label.toLowerCase() : ""}</b>
              {e.body ? <> · “{e.body}”</> : null} · {when(e.createdAt)}
            </li>
          ) : (
            <li key={e.id} className={`flex ${e.authorType === "STAFF" ? "justify-end" : ""}`}>
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${e.authorType === "STAFF" ? "bg-accent/12" : "bg-foreground/6"}`}>
                <p className="text-[11px] font-medium text-muted">
                  {e.authorName}{e.authorType === "STAFF" ? " · committee" : ""} · {when(e.createdAt)}
                </p>
                {e.body && <p className="mt-0.5 whitespace-pre-wrap">{e.body}</p>}
                <Photos items={e.attachments} url={photoUrl} />
              </div>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
