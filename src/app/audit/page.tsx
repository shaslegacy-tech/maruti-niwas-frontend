import { getAudit } from "@/lib/api.server";

export const dynamic = "force-dynamic";

const TONE: Record<string, string> = {
  CREATE: "bg-income/15 text-income", PAYMENT: "bg-income/15 text-income", LOGIN: "bg-foreground/10 text-muted",
  UPDATE: "bg-warn/15 text-warn", CLOSE_MONTH: "bg-warn/15 text-warn", REOPEN_MONTH: "bg-warn/15 text-warn",
  GENERATE: "bg-foreground/10 text-muted", SEND_RECEIPT: "bg-foreground/10 text-muted", SHARE_RECEIPT: "bg-foreground/10 text-muted", REMINDER: "bg-warn/15 text-warn", EXPORT: "bg-foreground/10 text-muted", RECONCILE: "bg-income/15 text-income", ADJUST: "bg-warn/15 text-warn",
  DELETE: "bg-expense/15 text-expense", RESET: "bg-expense/15 text-expense",
  DEACTIVATE: "bg-expense/15 text-expense", LOGIN_FAILED: "bg-expense/15 text-expense",
};

export default async function AuditPage() {
  const rows = await getAudit();
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
        <p className="text-sm text-muted">Every change and sign-in, newest first. Entries can’t be edited or deleted.</p>
      </header>
      <section className="glass overflow-hidden">
        {rows.length === 0 && <p className="p-10 text-center text-sm text-muted">Nothing recorded yet</p>}
        <ul className="divide-y divide-border">
          {rows.map((r) => (
            <li key={r.id}>
              <details className="group">
                <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 sm:px-5">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TONE[r.action] ?? TONE.LOGIN}`}>
                    {r.action.replace("_", " ").toLowerCase()}
                  </span>
                  <span className="min-w-0 flex-1 basis-60 truncate text-sm">{r.summary ?? `${r.entityType} ${r.entityId ?? ""}`}</span>
                  <span className="text-xs text-muted">{r.actor} · {fmt(r.occurredAt)}</span>
                </summary>
                {(r.before || r.after) && (
                  <div className="grid gap-3 px-4 pb-4 text-xs sm:grid-cols-2 sm:px-5">
                    {(["before", "after"] as const).map((k) => r[k] && (
                      <div key={k}>
                        <p className="mb-1 uppercase tracking-wide text-muted">{k}</p>
                        <pre className="overflow-x-auto rounded-lg bg-foreground/5 p-3">{JSON.stringify(r[k], null, 2)}</pre>
                      </div>
                    ))}
                  </div>
                )}
              </details>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
