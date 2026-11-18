"use client";

import { BadgeCheck, Bell, CalendarDays, Building2, Contact, Download, FolderOpen, Home, Inbox, KeyRound, Landmark, LayoutDashboard, LogOut, Megaphone, MessageSquareWarning, Receipt, ScrollText, ShieldCheck, UserCog, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Me } from "@/lib/api";

const TREASURER = ["TREASURER"];
const CHAIRMAN = ["CHAIRMAN"];
const COMMITTEE = ["TREASURER", "SECRETARY", "CHAIRMAN"];   // Secretary and Chairman read the books; only the treasurer changes them

// `roles` decides who sees each item. Add SECRETARY / CHAIRMAN / RESIDENT here as their screens ship.
const RESIDENT = ["RESIDENT"];

const ITEMS = [
  { href: "/", label: "Home", icon: Home, roles: RESIDENT },
  { href: "/maintenance", label: "Maintenance", icon: Receipt, roles: RESIDENT },
  { href: "/meetings", label: "Meetings", icon: CalendarDays, roles: RESIDENT },
  { href: "/complaints", label: "Complaints", icon: MessageSquareWarning, roles: RESIDENT },
  { href: "/documents", label: "Documents", icon: FolderOpen, roles: RESIDENT },
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: COMMITTEE },
  { href: "/approvals", label: "Approvals", icon: BadgeCheck, roles: CHAIRMAN },
  { href: "/flats", label: "Flats", icon: Users, roles: COMMITTEE },
  { href: "/members", label: "Members", icon: Contact, roles: COMMITTEE },
  { href: "/residents", label: "Residents", icon: KeyRound, roles: TREASURER },
  { href: "/committee", label: "Committee", icon: UserCog, roles: TREASURER },
  { href: "/claims", label: "Payment proofs", icon: Inbox, roles: TREASURER },
  { href: "/notices", label: "Notices", icon: Megaphone, roles: COMMITTEE },
  { href: "/meetings", label: "Meetings", icon: CalendarDays, roles: COMMITTEE },
  { href: "/complaints", label: "Complaints", icon: MessageSquareWarning, roles: COMMITTEE },
  { href: "/documents", label: "Documents", icon: FolderOpen, roles: COMMITTEE },
  { href: "/defaulters", label: "Defaulters", icon: Bell, roles: COMMITTEE },
  { href: "/ledger", label: "Ledger", icon: Receipt, roles: COMMITTEE },
  { href: "/balances", label: "Balances", icon: Landmark, roles: COMMITTEE },
  { href: "/report", label: "Report", icon: ScrollText, roles: COMMITTEE },
  { href: "/exports", label: "Exports", icon: Download, roles: COMMITTEE },
  { href: "/audit", label: "Audit", icon: ShieldCheck, roles: COMMITTEE },
];

const visible = (me: Me | null) =>
  // Until we know who is signed in, show no menu rather than everyone's menu.
  me ? ITEMS.filter((i) => i.roles.some((r) => me.roles.includes(r))) : [];

export function Sidebar({ me, onLogout }: { me: Me | null; onLogout: () => void }) {
  const path = usePathname();
  return (
    <aside className="glass fixed inset-y-3 left-3 hidden w-56 flex-col p-4 md:flex">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <span className="grid size-9 place-items-center rounded-xl bg-accent/15 text-accent">
          <Building2 className="size-5" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Maruti Niwas</p>
          <p className="text-xs text-muted">Society accounts</p>
        </div>
      </div>
      <nav className="flex flex-col gap-1">
        {visible(me).map(({ href, label, icon: Icon, roles }) => (
          <Link key={`${href}:${label}:${roles.join()}`} href={href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  path === href ? "bg-accent/15 font-medium text-accent" : "text-muted hover:text-foreground"}`}>
            <Icon className="size-4" />{label}
          </Link>
        ))}
      </nav>
      {me && (
        <div className="mt-auto flex items-center gap-2 rounded-xl bg-foreground/5 p-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
            {me.fullName.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-xs font-medium">{me.fullName}</p>
            <p className="truncate text-[10px] uppercase tracking-wide text-muted">{me.roles.join(", ").toLowerCase()}</p>
          </div>
          <Link href="/change-password" aria-label="Change password" title="Change password" className="text-muted hover:text-foreground">
            <KeyRound className="size-4" />
          </Link>
          <button onClick={onLogout} aria-label="Sign out" title="Sign out" className="text-muted hover:text-expense">
            <LogOut className="size-4" />
          </button>
        </div>
      )}
    </aside>
  );
}

export function MobileNav({ me, onLogout }: { me: Me | null; onLogout: () => void }) {
  const path = usePathname();
  return (
    <nav className="glass fixed inset-x-3 bottom-3 z-20 flex gap-1 overflow-x-auto p-1.5 md:hidden">
      {visible(me).filter((i) => i.href !== "/audit").map(({ href, label, icon: Icon, roles }) => (
        <Link key={`${href}:${label}:${roles.join()}`} href={href}
              className={`flex min-w-[68px] flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] ${path === href ? "text-accent" : "text-muted"}`}>
          <Icon className="size-5" />{label}
        </Link>
      ))}
      <Link href="/change-password" className="flex min-w-[68px] flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] text-muted">
        <KeyRound className="size-5" />Password
      </Link>
      <button onClick={onLogout} className="flex min-w-[68px] flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] text-muted">
        <LogOut className="size-5" />Sign out
      </button>
    </nav>
  );
}
