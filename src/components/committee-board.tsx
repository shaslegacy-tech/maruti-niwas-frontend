"use client";

import { motion } from "framer-motion";
import { KeyRound, Plus, ShieldAlert } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";
import {
  type CommitteeMember, type ResidentCredentials,
  createCommitteeMember, getCommittee, resetCommitteePassword, updateCommitteeMember,
} from "@/lib/api";
import { Modal } from "./modal";
import { CredentialsView } from "./residents-board";
import { when } from "./resident-shared";

const ROLE_LABEL = { SECRETARY: "Secretary", CHAIRMAN: "Chairman" } as const;

export function CommitteeBoard({ initial }: { initial: CommitteeMember[] }) {
  const [members, setMembers] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [creds, setCreds] = useState<{ who: string; value: ResidentCredentials } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try { setMembers(await getCommittee()); } catch (e) { setError((e as Error).message); }
  }, []);

  async function change(m: CommitteeMember, patch: { active?: boolean; canViewFinancial?: boolean }) {
    setError(null); setBusy(m.id);
    try { await updateCommitteeMember(m.id, patch); await reload(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  async function reset(m: CommitteeMember) {
    if (!confirm(`Reset the password for ${m.fullName}? The old password will stop working.`)) return;
    setError(null); setBusy(m.id);
    try { setCreds({ who: m.fullName, value: await resetCommitteePassword(m.id) }); await reload(); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }

  return (
    <>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Committee</h1>
          <p className="max-w-2xl text-sm text-muted">
            Secretary and Chairman logins. They can view the books and reports but never change them. The Secretary also
            maintains members, notices and documents. Financial documents stay hidden from them unless you allow it.
          </p>
        </div>
        <button onClick={() => setAdding(true)}
                className="flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2.5 text-sm font-medium text-white transition hover:opacity-90">
          <Plus className="size-4" />Add member
        </button>
      </header>

      {error && <p className="mb-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}

      <section className="glass overflow-hidden">
        {members.length === 0 && (
          <p className="p-10 text-center text-sm text-muted">No committee logins yet. Use “Add member” to create one for the Secretary or Chairman.</p>
        )}
        <ul className="divide-y divide-border">
          {members.map((m, i) => (
            <motion.li key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                       className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent/12 text-sm font-semibold text-accent">
                {m.fullName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium">
                  {m.fullName} <span className="ml-1 rounded-full bg-accent/12 px-2 py-0.5 text-[11px] font-medium text-accent">{ROLE_LABEL[m.role]}</span>
                </p>
                <p className="truncate text-xs text-muted">
                  {m.username}
                  {" · "}
                  {!m.active ? <span className="text-expense">Disabled</span>
                    : m.mustChangePassword ? <span className="text-warn">Has not signed in yet</span>
                    : m.lastLoginAt ? <>Last sign-in {when(m.lastLoginAt)}</> : "Active"}
                </p>
              </div>

              <button onClick={() => change(m, { canViewFinancial: !m.canViewFinancial })} disabled={busy === m.id}
                      title="Bank statements and complete financial reports"
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition disabled:opacity-60 ${
                        m.canViewFinancial ? "bg-warn/15 text-warn" : "bg-foreground/8 text-muted hover:text-foreground"}`}>
                <ShieldAlert className="size-3.5" />
                {m.canViewFinancial ? "Can view financial documents" : "Financial documents hidden"}
              </button>

              <div className="flex items-center gap-2">
                <button onClick={() => reset(m)} disabled={busy === m.id}
                        className="flex items-center gap-1.5 rounded-lg bg-foreground/8 px-3 py-1.5 text-xs transition hover:bg-foreground/12 disabled:opacity-60">
                  <KeyRound className="size-3.5" />Reset password
                </button>
                <button onClick={() => change(m, { active: !m.active })} disabled={busy === m.id}
                        className={`rounded-lg px-3 py-1.5 text-xs transition disabled:opacity-60 ${
                          m.active ? "bg-foreground/8 hover:bg-expense/15 hover:text-expense" : "bg-income/15 text-income"}`}>
                  {m.active ? "Disable" : "Enable"}
                </button>
              </div>
            </motion.li>
          ))}
        </ul>
      </section>

      <Modal open={adding} onClose={() => setAdding(false)} title="Add a committee member">
        {adding && (
          <AddForm onCreated={(who, value) => { setAdding(false); setCreds({ who, value }); reload(); }} />
        )}
      </Modal>

      <Modal open={creds !== null} onClose={() => setCreds(null)} title={creds ? `Login for ${creds.who}` : ""}>
        {creds && <CredentialsView creds={creds.value} onDone={() => setCreds(null)} noPhoneLabel="Add a phone number to send by WhatsApp" />}
      </Modal>
    </>
  );
}

function AddForm({ onCreated }: { onCreated: (who: string, c: ResidentCredentials) => void }) {
  const [role, setRole] = useState<"SECRETARY" | "CHAIRMAN">("SECRETARY");
  const [financial, setFinancial] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const fullName = String(f.get("fullName")).trim();
    setBusy(true); setErr(null);
    try {
      const value = await createCommitteeMember({
        fullName, role, canViewFinancial: financial,
        username: String(f.get("username") ?? "").trim().toLowerCase() || undefined,
        email: String(f.get("email") ?? "").trim() || undefined,
        phone: String(f.get("phone") ?? "").trim() || undefined,
      });
      onCreated(fullName, value);
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Full name</span>
        <input name="fullName" required maxLength={120} className="field" autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-foreground/6 p-1">
        {(["SECRETARY", "CHAIRMAN"] as const).map((r) => (
          <button type="button" key={r} onClick={() => setRole(r)}
                  className={`rounded-lg py-1.5 text-sm font-medium transition ${role === r ? "bg-accent text-white" : "text-muted"}`}>
            {ROLE_LABEL[r]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Mobile (for the WhatsApp message)</span>
          <input name="phone" inputMode="tel" className="field" placeholder="98765 43210" />
        </label>
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Email (optional)</span>
          <input name="email" type="email" className="field" />
        </label>
      </div>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Username (optional, default: {role.toLowerCase()})</span>
        <input name="username" pattern="[a-z0-9._\-]{3,30}" className="field" placeholder={role.toLowerCase()} />
      </label>
      <label className="flex items-start gap-2 rounded-xl border border-border p-3 text-xs">
        <input type="checkbox" checked={financial} onChange={(e) => setFinancial(e.target.checked)} className="mt-0.5" />
        <span>
          <b className="text-sm">Can view financial documents</b>
          <span className="block text-muted">Bank statements and complete financial reports. Leave off unless this person needs them.</span>
        </span>
      </label>
      {err && <p className="text-sm text-expense">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Creating…" : "Create login"}
      </button>
    </form>
  );
}
