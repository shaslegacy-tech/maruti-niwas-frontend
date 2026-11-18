import type { ApprovalState, MeetingKind, MeetingStatus, ResolutionOutcome } from "@/lib/api";

export const KIND_LABEL: Record<MeetingKind, string> = {
  AGM: "Annual general meeting", SPECIAL: "Special general meeting", COMMITTEE: "Committee meeting", OTHER: "Meeting",
};

export const STATUS_UI: Record<MeetingStatus, { label: string; tone: string }> = {
  DRAFT: { label: "Draft", tone: "bg-foreground/10 text-muted" },
  SCHEDULED: { label: "Scheduled", tone: "bg-accent/15 text-accent" },
  HELD: { label: "Held", tone: "bg-income/15 text-income" },
  CANCELLED: { label: "Cancelled", tone: "bg-expense/15 text-expense" },
};

export const OUTCOME_UI: Record<ResolutionOutcome, { label: string; tone: string }> = {
  PASSED: { label: "Passed", tone: "bg-income/15 text-income" },
  REJECTED: { label: "Not passed", tone: "bg-expense/15 text-expense" },
  DEFERRED: { label: "Deferred", tone: "bg-warn/15 text-warn" },
};

export const APPROVAL_UI: Record<ApprovalState, { label: string; tone: string } | null> = {
  NOT_REQUIRED: null,
  PENDING: { label: "Waiting for the Chairman", tone: "bg-warn/15 text-warn" },
  APPROVED: { label: "Approved by the Chairman", tone: "bg-income/15 text-income" },
  REJECTED: { label: "Rejected by the Chairman", tone: "bg-expense/15 text-expense" },
};

const pad = (n: number) => String(n).padStart(2, "0");
/** ISO instant -> value for <input type="datetime-local"> in the browser's own time zone */
export const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const toIso = (local: string) => new Date(local).toISOString();

export const dayTime = (iso: string) =>
  new Date(iso).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export const votesLine = (f: number | null, a: number | null, ab: number | null) =>
  f === null && a === null && ab === null ? null
    : `Votes: ${f ?? 0} for, ${a ?? 0} against${ab === null ? "" : `, ${ab} abstained`}`;

export type Tab = "overview" | "agenda" | "attendance" | "minutes" | "decisions" | "documents";
export const TABS: Tab[] = ["overview", "agenda", "attendance", "minutes", "decisions", "documents"];
