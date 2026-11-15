"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { type Me, getMe, logout } from "@/lib/api";
import { MobileNav, Sidebar } from "./nav";

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const bare = path === "/login" || path === "/change-password";     // no sidebar on these
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (bare) return;
    getMe()
      .then((m) => {
        setMe(m);
        if (m.mustChangePassword) router.replace("/change-password");
      })
      .catch(() => {});
  }, [bare, router]);

  async function signOut() {
    try { await logout(); } finally { window.location.href = "/login"; }
  }

  if (bare) return <>{children}</>;

  return (
    <>
      <Sidebar me={me} onLogout={signOut} />
      <div className="md:pl-64">
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-6 md:pb-10">{children}</main>
      </div>
      <MobileNav me={me} onLogout={signOut} />
    </>
  );
}
