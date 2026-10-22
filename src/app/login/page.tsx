"use client";

import { Building2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { login } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true); setError(null);
    try {
      await login(String(f.get("username")), String(f.get("password")));
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <form onSubmit={submit} className="glass w-full max-w-sm space-y-4 p-7">
        <div className="mb-2 text-center">
          <span className="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-accent/15 text-accent">
            <Building2 className="size-6" />
          </span>
          <h1 className="text-lg font-semibold">Maruti Niwas</h1>
          <p className="text-sm text-muted">Treasurer sign in</p>
        </div>
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Username</span>
          <input name="username" autoComplete="username" required autoFocus className="field" />
        </label>
        <label className="block text-xs text-muted">
          <span className="mb-1 block">Password</span>
          <input name="password" type="password" autoComplete="current-password" required className="field" />
        </label>
        {error && <p className="rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}
        <button disabled={busy} className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60">
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
