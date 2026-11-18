"use client";

import { motion } from "framer-motion";
import { CalendarDays, MapPin, Pencil, Pin } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import type { NoticeItem, ResidentHome } from "@/lib/api";
import { inr, shortDate } from "@/lib/format";
import { Modal } from "./modal";
import { ContactForm, STATUS, when } from "./resident-shared";

export function ResidentDashboard({ home: initial }: { home: ResidentHome }) {
  const [home, setHome] = useState(initial);
  const [editing, setEditing] = useState(false);
  const { flat, currentMonth: cm } = home;
  const late = home.overdueAmount > 0;
  const owing = home.outstandingTotal > 0;
  const last = home.receipts[0];
  const notices = home.notices.filter((n) => n.kind === "NOTICE");
  const announcements = home.notices.filter((n) => n.kind === "ANNOUNCEMENT");

  const headline = late
    ? { text: "Overdue", tone: "text-expense", hint: `${inr(home.overdueAmount)} is past the ${home.dueDay}th` }
    : owing
    ? { text: "Payment due", tone: "text-warn", hint: `Please pay by the ${home.dueDay}th` }
    : { text: "All paid up", tone: "text-income", hint: "Nothing pending" };

  const tiles = [
    { label: "Maintenance status", value: headline.text, tone: headline.tone, hint: headline.hint },
    { label: "Pending amount", value: inr(home.outstandingTotal), tone: owing ? (late ? "text-expense" : "text-warn") : "", hint: owing ? "Across all unpaid months" : "You owe nothing" },
    { label: "Paid this year", value: inr(home.paidThisYear), tone: "text-income", hint: home.yearLabel },
    { label: "Last payment", value: last ? inr(last.amount) : "–", tone: "", hint: last ? `${shortDate(last.date)} · ${last.mode}` : "No payments yet" },
  ];

  return (
    <>
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Hello, {flat.ownerName.split(" ")[0]}</h1>
          <p className="text-sm text-muted">Flat {flat.flatNumber} · {flat.societyName}</p>
        </div>
        <ThemeToggle />
      </header>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {tiles.map((t, i) => (
          <motion.div key={t.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                      className="glass p-4">
            <p className="text-xs text-muted">{t.label}</p>
            <p className={`mt-1.5 text-xl font-semibold tabular-nums ${t.tone}`}>{t.value}</p>
            <p className="mt-1 text-[11px] text-muted">{t.hint}</p>
          </motion.div>
        ))}
      </div>

      <section className="glass mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 p-5">
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-xs text-muted">This month</p>
          <p className="text-lg font-semibold">{cm ? cm.label : "No dues yet"}</p>
          {cm && (
            <p className="text-sm text-muted">
              {cm.status === "PAID"
                ? `Paid${cm.paymentDate ? ` on ${shortDate(cm.paymentDate)}` : ""} · ${inr(cm.amount)}`
                : `${inr(cm.balance)} to pay · due by ${shortDate(cm.dueDate)}`}
            </p>
          )}
        </div>
        {cm && (
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${cm.overdue ? "bg-expense/15 text-expense" : STATUS[cm.status].tone}`}>
            {cm.overdue ? "Overdue" : STATUS[cm.status].label}
          </span>
        )}
        {(!cm || cm.status !== "PAID" || owing) && (
          <Link href="/maintenance" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90">
            {owing ? "Pay or send payment details" : "View maintenance"}
          </Link>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <NoticeCard title="Notices" empty="No notices right now" items={notices} />
        <MeetingCard meetings={home.meetings} />
        <NoticeCard title="Society announcements" empty="No announcements right now" items={announcements} />
      </div>

      <section className="glass mt-4 flex items-center gap-3 p-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-medium">Your contact details</h2>
          <p className="mt-1 truncate text-sm text-muted">
            {flat.phoneNumber ?? "No phone saved"} · {flat.email ?? "No email saved"}
          </p>
        </div>
        <button onClick={() => setEditing(true)} aria-label="Edit contact details"
                className="grid size-9 place-items-center rounded-lg text-muted hover:text-foreground">
          <Pencil className="size-4" />
        </button>
      </section>

      <Modal open={editing} onClose={() => setEditing(false)} title="Update contact details">
        {editing && <ContactForm flat={flat} onSaved={(f) => { setHome({ ...home, flat: f }); setEditing(false); }} />}
      </Modal>
    </>
  );
}

function NoticeCard({ title, empty, items }: { title: string; empty: string; items: NoticeItem[] }) {
  return (
    <section className="glass p-5">
      <h2 className="mb-3 text-sm font-medium">{title}</h2>
      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-4">
          {items.map((n) => (
            <li key={n.id}>
              <p className="flex items-start gap-1.5 text-sm font-medium">
                {n.pinned && <Pin className="mt-0.5 size-3.5 shrink-0 text-accent" />}{n.title}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{n.body}</p>
              <p className="mt-1 text-[11px] text-muted">{shortDate(n.postedAt.slice(0, 10))}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function MeetingCard({ meetings }: { meetings: NoticeItem[] }) {
  return (
    <section className="glass p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium">Upcoming meetings</h2>
        <Link href="/meetings" className="text-xs text-accent hover:underline">All meetings</Link>
      </div>
      {meetings.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">No meetings scheduled</p>
      ) : (
        <ul className="space-y-4">
          {meetings.map((m) => {
            const d = new Date(m.meetingAt!);
            return (
              <li key={m.id} className="flex gap-3">
                <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-accent/12 text-center leading-tight text-accent">
                  <div>
                    <p className="text-base font-semibold">{d.getDate()}</p>
                    <p className="text-[10px] uppercase">{d.toLocaleDateString("en-IN", { month: "short" })}</p>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{m.title}</p>
                  <p className="flex items-center gap-1 text-xs text-muted"><CalendarDays className="size-3" />{when(m.meetingAt!)}</p>
                  {m.venue && <p className="flex items-center gap-1 text-xs text-muted"><MapPin className="size-3" />{m.venue}</p>}
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{m.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
