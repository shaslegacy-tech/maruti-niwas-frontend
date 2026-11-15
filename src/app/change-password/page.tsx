"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { type Me, changePassword, getMe } from "@/lib/api";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { getMe().then(setMe).catch(() => {}); }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const next = String(f.get("next"));
    if (next !== String(f.get("again"))) { setError("The two new passwords do not match"); return; }
    setBusy(true); setError(null);
    try {
      await changePassword(String(f.get("current")), next);
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const first = me?.mustChangePassword;

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <form onSubmit={submit} className="glass w-full max-w-sm space-y-4 p-7">
        <div className="mb-2 text-center">
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-accent/15 text-accent">
            <KeyRound className="size-6" />
          </span>
          <h1 className="text-lg font-semibold">{first ? "Choose your own password" : "Change password"}</h1>
          <p className="text-sm text-muted">
            {first ? "Your login was created with a temporary password. Please set a new one to continue." : "Use at least 8 characters."}
          </p>
        </div>
        <label className="block text-xs text-muted">
          <span className="mb-1 block">{first ? "Temporary password" : "Current password"}</span>
          <input name="current" type="password" autoComplete="current-password" required className="field" />
        </label>
        <label className="block text-xs text-muted">
          <span className="mb-1 block">New password</span>
          <input name="next" type="password" autoComplete="new-password" minLength={8} required className="field" />
        </label>
        <label className="block text-xs text-muted">
          <span className="mb-1 block">New password again</span>
          <input name="again" type="password" autoComplete="new-password" minLength={8} required className="field" />
        </label>
        {error && <p className="rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60">
          {busy ? "Saving…" : "Save new password"}
        </button>
        {!first && <Link href="/" className="block text-center text-xs text-muted hover:text-foreground">Back</Link>}
      </form>
    </div>
  );
}
