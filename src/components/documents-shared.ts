import type { DocumentCategory } from "@/lib/api";

export const DOC_LABEL: Record<DocumentCategory, string> = {
  NOTICE: "Society notice", MINUTES: "Meeting minutes", RULES: "Rules & bylaws",
  IMPORTANT: "Important document", FINANCIAL: "Financial (private)", OTHER: "Other",
};

/** Matches the server: these stay with the staff unless someone deliberately shares them. */
export const staffOnlyByDefault = (c: DocumentCategory) => c === "FINANCIAL" || c === "OTHER";

export const fileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export const docDate = (iso: string | null, fallback: string) =>
  new Date(iso ?? fallback).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
