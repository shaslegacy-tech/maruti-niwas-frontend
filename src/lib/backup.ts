import type { BackupStatusResponse } from "@/lib/api";

const STALE_HOURS = 36;

export interface BackupProblem { message: string; severity: "error" | "warn" }

const ago = (hours: number) =>
  hours < 48 ? `${Math.max(1, Math.round(hours))} hours ago` : `${Math.floor(hours / 24)} days ago`;

/**
 * What the treasurer should be told about the backups, or null when all is well.
 * Not configured (a developer's computer) is not a problem: there is nothing to warn about.
 */
export function backupProblem(b: BackupStatusResponse | null, now: number = Date.now()): BackupProblem | null {
  if (!b || !b.configured) return null;
  if (!b.readable || !b.status) {
    return { severity: "error", message: "The backup status cannot be read. Please ask whoever looks after the server to check the backups." };
  }
  const s = b.status;
  if (!s.lastSuccessAt) {
    return { severity: "error", message: s.ok === false ? `No backup has succeeded yet, and the latest attempt failed.` : "No successful backup has been recorded yet." };
  }
  const hours = (now - new Date(s.lastSuccessAt).getTime()) / 36e5;
  if (!Number.isFinite(hours)) {
    // An unreadable time must never be mistaken for "all fine".
    return { severity: "error", message: "The backup status is damaged (its time cannot be read). Please ask whoever looks after the server to check the backups." };
  }
  if (hours > STALE_HOURS) {
    return { severity: "error", message: `The last successful backup was ${ago(hours)}. Backups may have stopped.` };
  }
  if (s.ok === false) {
    return { severity: "error", message: `The latest backup attempt failed. The last good backup was ${ago(hours)}.` };
  }
  if (s.lastVerifyOk === false) {
    return { severity: "error", message: "The last restore test failed, so the newest backup may not be usable. Please have it checked." };
  }
  if (s.offsite === "failed") {
    return { severity: "warn", message: "The latest backup was made, but copying it off-site failed." };
  }
  return null;
}
