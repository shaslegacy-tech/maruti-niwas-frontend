"use client";

import { motion } from "framer-motion";
import { Check, Copy, KeyRound, MessageCircle } from "lucide-react";
import { useCallback, useState } from "react";
import {
  type ResidentCredentials, type ResidentLogin,
  createResidentLogin, getResidents, setResidentActive,
} from "@/lib/api";
import { Modal } from "./modal";

function status(r: ResidentLogin) {
  if (!r.hasLogin) return { label: "No login", tone: "bg-foreground/10 text-muted" };
  if (!r.active) return { label: "Disabled", tone: "bg-expense/15 text-expense" };
  if (r.mustChangePassword) return { label: "Waiting for first sign-in", tone: "bg-warn/15 text-warn" };
  return { label: "Active", tone: "bg-income/15 text-income" };
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "never";

export function ResidentsBoard({ initial }: { initial: ResidentLogin[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<{ flat: ResidentLogin; value: ResidentCredentials } | null>(null);

  const reload = useCallback(async () => {
    try { setRows(await getResidents()); } catch (e) { setError((e as Error).message); }
  }, []);

  async function issue(r: ResidentLogin) {
    if (r.hasLogin && !confirm(`Reset the password for Flat ${r.flatNumber}? The old password will stop working.`)) return;
    setError(null); setBusy(r.flatId);
    try {
      setCreds({ flat: r, value: await createResidentLogin(r.flatId) });
      await reload();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  async function toggle(r: ResidentLogin) {
    setError(null); setBusy(r.flatId);
    try { await setResidentActive(r.flatId, !r.active); await reload(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  const withLogin = rows.filter((r) => r.hasLogin).length;

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Residents</h1>
        <p className="text-sm text-muted">
          Give each flat a login so owners can see their own dues and download their receipts · {withLogin} of {rows.length} flats have one
        </p>
      </header>

      {error && <p className="mb-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}

      <section className="glass overflow-hidden">
        <ul className="divide-y divide-border">
          {rows.map((r, i) => {
            const st = status(r);
            return (
              <motion.li key={r.flatId} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                         className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 sm:px-5">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/12 text-sm font-semibold text-accent">
                  {r.flatNumber}
                </span>
                <div className="min-w-0 flex-1 basis-44">
                  <p className="truncate text-sm font-medium">{r.ownerName}</p>
                  <p className="truncate text-xs text-muted">
                    {r.hasLogin ? <>Username <b className="text-foreground">{r.username}</b> · last sign-in {when(r.lastLoginAt)}</> : (r.phoneNumber ?? "No phone saved")}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${st.tone}`}>{st.label}</span>
                <div className="flex w-full justify-end gap-2 sm:w-auto">
                  <button onClick={() => issue(r)} disabled={busy === r.flatId}
                          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-60">
                    <KeyRound className="size-3.5" />{r.hasLogin ? "Reset password" : "Create login"}
                  </button>
                  {r.hasLogin && (
                    <button onClick={() => toggle(r)} disabled={busy === r.flatId}
                            className="rounded-lg bg-foreground/8 px-3 py-1.5 text-xs transition hover:bg-foreground/12 disabled:opacity-60">
                      {r.active ? "Disable" : "Enable"}
                    </button>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ul>
      </section>

      <p className="mt-3 text-xs text-muted">
        A new login gets a temporary password that is shown only once. The owner is asked to choose their own the first time they sign in.
        Disable a login when a flat is sold; the history stays.
      </p>

      <Modal open={creds !== null} onClose={() => setCreds(null)}
             title={creds ? `Login for Flat ${creds.flat.flatNumber}` : ""}>
        {creds && <CredentialsView creds={creds.value} onDone={() => setCreds(null)} />}
      </Modal>
    </>
  );
}

export function CredentialsView({ creds, onDone, noPhoneLabel = "No phone saved" }: { creds: ResidentCredentials; onDone: () => void; noPhoneLabel?: string }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(key: string, value: string) {
    try { await navigator.clipboard.writeText(value); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-warn/10 px-3 py-2 text-xs text-warn">
        Copy or share this now. For safety the password cannot be shown again; you can reset it any time.
      </p>
      <dl className="space-y-2 rounded-lg bg-foreground/5 p-3 text-sm">
        <Row label="Website" value={creds.loginUrl} onCopy={() => copy("url", creds.loginUrl)} done={copied === "url"} />
        <Row label="Username" value={creds.username} onCopy={() => copy("user", creds.username)} done={copied === "user"} />
        <Row label="Password" value={creds.temporaryPassword} onCopy={() => copy("pass", creds.temporaryPassword)} done={copied === "pass"} mono />
      </dl>
      <div className="grid grid-cols-2 gap-2">
        {creds.whatsappUrl ? (
          <a href={creds.whatsappUrl} target="_blank" rel="noopener noreferrer"
             className="flex items-center justify-center gap-1.5 rounded-lg bg-income/15 py-2.5 text-sm font-medium text-income">
            <MessageCircle className="size-4" />WhatsApp
          </a>
        ) : (
          <span className="flex items-center justify-center rounded-lg bg-foreground/5 py-2.5 text-center text-xs text-muted">{noPhoneLabel}</span>
        )}
        <button onClick={() => copy("msg", creds.message)}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-foreground/8 py-2.5 text-sm font-medium">
          {copied === "msg" ? <Check className="size-4 text-income" /> : <Copy className="size-4" />}Copy message
        </button>
      </div>
      <button onClick={onDone} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white">Done</button>
    </div>
  );
}

function Row({ label, value, onCopy, done, mono }: { label: string; value: string; onCopy: () => void; done: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <dt className="w-20 shrink-0 text-xs text-muted">{label}</dt>
      <dd className={`min-w-0 flex-1 truncate font-medium ${mono ? "font-mono text-base tracking-wider" : ""}`}>{value}</dd>
      <button onClick={onCopy} aria-label={`Copy ${label}`} className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:text-foreground">
        {done ? <Check className="size-3.5 text-income" /> : <Copy className="size-3.5" />}
      </button>
    </div>
  );
}
