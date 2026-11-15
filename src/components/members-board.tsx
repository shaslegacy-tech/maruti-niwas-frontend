"use client";

import { motion } from "framer-motion";
import { Mail, Pencil, Phone, Plus, Search, Trash2, UserPlus } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";
import {
  type FlatDirectoryEntry, type MemberRelation, type MemberView,
  addMember, getMembers, removeMember, updateFlatDetails, updateMember,
} from "@/lib/api";
import { Modal } from "./modal";

const RELATION: Record<MemberRelation, string> = {
  CO_OWNER: "Co-owner", SPOUSE: "Spouse", CHILD: "Child", PARENT: "Parent", SIBLING: "Sibling", TENANT: "Tenant", OTHER: "Other",
};
const OCCUPANCY = { OWNER: "Owner-occupied", TENANT: "Tenant", VACANT: "Vacant" } as const;

const sinceLabel = (iso: string) =>
  new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" });

export function MembersBoard({ initial, readOnly }: { initial: FlatDirectoryEntry[]; readOnly: boolean }) {
  const [flats, setFlats] = useState(initial);
  const [q, setQ] = useState("");
  const [editFlat, setEditFlat] = useState<FlatDirectoryEntry | null>(null);
  const [person, setPerson] = useState<{ flat: FlatDirectoryEntry; member: MemberView | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try { setFlats(await getMembers()); } catch (e) { setError((e as Error).message); }
  }, []);

  async function remove(f: FlatDirectoryEntry, m: MemberView) {
    if (!confirm(`Remove ${m.fullName} from Flat ${f.flatNumber}?`)) return;
    setError(null);
    try { await removeMember(m.id); await reload(); } catch (e) { setError((e as Error).message); }
  }

  const needle = q.trim().toLowerCase();
  const shown = flats.filter((f) =>
    !needle || [f.flatNumber, f.ownerName, ...f.members.map((m) => m.fullName)].join(" ").toLowerCase().includes(needle));
  const people = flats.reduce((n, f) => n + 1 + f.members.length, 0);

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-sm text-muted">
          {flats.length} flats · {people} people.
          {readOnly ? " You can view members and ownership details." : " Keep contact details, family and ownership information up to date."}
        </p>
      </header>

      <label className="glass mb-4 flex items-center gap-2 px-3.5 py-2.5">
        <Search className="size-4 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by flat or name"
               className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
      </label>

      {error && <p className="mb-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}

      {shown.length === 0 && <p className="glass p-10 text-center text-sm text-muted">Nothing matches “{q}”.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        {shown.map((f, i) => (
          <motion.section key={f.flatId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                          className="glass p-5">
            <div className="flex items-start gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent/12 text-base font-semibold text-accent">{f.flatNumber}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{f.ownerName}</p>
                <p className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                  <span className="rounded-full bg-foreground/8 px-2 py-0.5 text-[11px]">{OCCUPANCY[f.occupantType]}</span>
                  {f.phoneNumber && <a href={`tel:${f.phoneNumber}`} className="flex items-center gap-1 hover:text-foreground"><Phone className="size-3" />{f.phoneNumber}</a>}
                  {f.email && <a href={`mailto:${f.email}`} className="flex items-center gap-1 truncate hover:text-foreground"><Mail className="size-3" />{f.email}</a>}
                </p>
              </div>
              {!readOnly && (
                <button onClick={() => setEditFlat(f)} aria-label={`Edit flat ${f.flatNumber}`}
                        className="grid size-8 place-items-center rounded-lg text-muted hover:text-foreground"><Pencil className="size-4" /></button>
              )}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-3">
              {([
                ["Floor", f.floorNo === null ? null : String(f.floorNo)],
                ["Area", f.areaSqFt === null ? null : `${f.areaSqFt} sq ft`],
                ["Parking", f.parkingSlot],
                ["Owner since", f.ownershipSince ? sinceLabel(f.ownershipSince) : null],
                ["Share certificate", f.shareCertificateNo],
              ] as const).map(([label, value]) => (
                <div key={label}><dt className="text-muted">{label}</dt><dd className="font-medium">{value ?? "–"}</dd></div>
              ))}
            </dl>
            {f.ownershipNotes && <p className="mt-2 text-xs text-muted">{f.ownershipNotes}</p>}

            <div className="mt-4 border-t border-border pt-3">
              <div className="mb-1 flex items-center justify-between">
                <h3 className="text-xs font-medium text-muted">Family &amp; others living here ({f.members.length})</h3>
                {!readOnly && (
                  <button onClick={() => setPerson({ flat: f, member: null })}
                          className="flex items-center gap-1 rounded-lg bg-accent/12 px-2.5 py-1 text-xs font-medium text-accent transition hover:bg-accent/20">
                    <UserPlus className="size-3.5" />Add
                  </button>
                )}
              </div>
              {f.members.length === 0 ? (
                <p className="py-2 text-xs text-muted">No one else is listed for this flat.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {f.members.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm">{m.fullName} <span className="ml-1 rounded-full bg-foreground/8 px-2 py-0.5 text-[11px] text-muted">{RELATION[m.relation]}</span></p>
                        {(m.phone || m.email || m.notes) && (
                          <p className="truncate text-xs text-muted">{[m.phone, m.email, m.notes].filter(Boolean).join(" · ")}</p>
                        )}
                      </div>
                      {!readOnly && (
                        <>
                          <button onClick={() => setPerson({ flat: f, member: m })} aria-label={`Edit ${m.fullName}`}
                                  className="grid size-7 place-items-center rounded-md text-muted hover:text-foreground"><Pencil className="size-3.5" /></button>
                          <button onClick={() => remove(f, m)} aria-label={`Remove ${m.fullName}`}
                                  className="grid size-7 place-items-center rounded-md text-muted hover:text-expense"><Trash2 className="size-3.5" /></button>
                        </>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.section>
        ))}
      </div>

      <Modal open={editFlat !== null} onClose={() => setEditFlat(null)} title={editFlat ? `Flat ${editFlat.flatNumber} details` : ""}>
        {editFlat && <FlatForm flat={editFlat} onSaved={() => { setEditFlat(null); reload(); }} />}
      </Modal>
      <Modal open={person !== null} onClose={() => setPerson(null)}
             title={person ? (person.member ? `Edit ${person.member.fullName}` : `Add a person to Flat ${person.flat.flatNumber}`) : ""}>
        {person && <PersonForm flat={person.flat} member={person.member} onSaved={() => { setPerson(null); reload(); }} />}
      </Modal>
    </>
  );
}

function FlatForm({ flat, onSaved }: { flat: FlatDirectoryEntry; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim() || undefined;
    const num = (k: string) => (text(k) === undefined ? undefined : Number(text(k)));
    setBusy(true); setErr(null);
    try {
      await updateFlatDetails(flat.flatId, {
        ownerName: String(f.get("ownerName")).trim(), phoneNumber: text("phoneNumber"), email: text("email"),
        occupantType: String(f.get("occupantType")) as "OWNER" | "TENANT" | "VACANT",
        floorNo: num("floorNo"), areaSqFt: num("areaSqFt"), parkingSlot: text("parkingSlot"),
        ownershipSince: text("ownershipSince"), shareCertificateNo: text("shareCertificateNo"), ownershipNotes: text("ownershipNotes"),
      });
      onSaved();
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Main owner</span>
        <input name="ownerName" required maxLength={120} defaultValue={flat.ownerName} className="field" autoFocus />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Mobile</span>
          <input name="phoneNumber" inputMode="tel" defaultValue={flat.phoneNumber ?? ""} className="field" />
        </label>
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Email</span>
          <input name="email" type="email" defaultValue={flat.email ?? ""} className="field" />
        </label>
      </div>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Who lives there?</span>
        <select name="occupantType" defaultValue={flat.occupantType} className="field">
          <option value="OWNER">Owner-occupied</option><option value="TENANT">Tenant</option><option value="VACANT">Vacant</option>
        </select>
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Floor</span>
          <input name="floorNo" type="number" min={-2} max={60} defaultValue={flat.floorNo ?? ""} className="field" />
        </label>
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Area (sq ft)</span>
          <input name="areaSqFt" type="number" step="0.01" min={1} defaultValue={flat.areaSqFt ?? ""} className="field" />
        </label>
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Parking</span>
          <input name="parkingSlot" maxLength={30} defaultValue={flat.parkingSlot ?? ""} className="field" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Owner since</span>
          <input name="ownershipSince" type="date" max={today} defaultValue={flat.ownershipSince ?? ""} className="field" />
        </label>
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Share certificate no.</span>
          <input name="shareCertificateNo" maxLength={40} defaultValue={flat.shareCertificateNo ?? ""} className="field" />
        </label>
      </div>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Ownership notes</span>
        <textarea name="ownershipNotes" maxLength={300} rows={2} defaultValue={flat.ownershipNotes ?? ""} className="field resize-y"
                  placeholder="e.g. Joint ownership with spouse; transfer pending" />
      </label>
      {err && <p className="text-sm text-expense">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Saving…" : "Save"}
      </button>
    </form>
  );
}

function PersonForm({ flat, member, onSaved }: { flat: FlatDirectoryEntry; member: MemberView | null; onSaved: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "").trim() || undefined;
    const body = {
      fullName: String(f.get("fullName")).trim(), relation: String(f.get("relation")) as MemberRelation,
      phone: text("phone"), email: text("email"), notes: text("notes"),
    };
    setBusy(true); setErr(null);
    try {
      if (member) await updateMember(member.id, body); else await addMember(flat.flatId, body);
      onSaved();
    } catch (e2) {
      setErr((e2 as Error).message);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Full name</span>
        <input name="fullName" required maxLength={120} defaultValue={member?.fullName} className="field" autoFocus />
      </label>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Relation to the owner</span>
        <select name="relation" defaultValue={member?.relation ?? "SPOUSE"} className="field">
          {(Object.keys(RELATION) as MemberRelation[]).map((r) => <option key={r} value={r}>{RELATION[r]}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Mobile (optional)</span>
          <input name="phone" inputMode="tel" defaultValue={member?.phone ?? ""} className="field" />
        </label>
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Email (optional)</span>
          <input name="email" type="email" defaultValue={member?.email ?? ""} className="field" />
        </label>
      </div>
      <label className="block text-xs text-muted">
        <span className="mb-1 block">Notes (optional)</span>
        <input name="notes" maxLength={300} defaultValue={member?.notes ?? ""} className="field" placeholder="e.g. Studies abroad; tenant agreement ends Mar 2027" />
      </label>
      {err && <p className="text-sm text-expense">{err}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white disabled:opacity-60">
        {busy ? "Saving…" : member ? "Save changes" : "Add person"}
      </button>
    </form>
  );
}
