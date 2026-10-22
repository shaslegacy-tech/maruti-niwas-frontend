"use client";

import { motion } from "framer-motion";
import { FileText, Table2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { downloadReport } from "@/lib/api";

type Format = "pdf" | "xlsx";
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** The Indian financial year starts on 1 April. */
function presets(today: string) {
  const [y, m] = today.split("-").map(Number);
  const fy = m >= 4 ? y : y - 1;
  const six = new Date(y, m - 1 - 5, 1);
  return [
    { label: "This financial year", from: iso(fy, 4, 1), to: iso(fy + 1, 3, 31) },
    { label: "Last financial year", from: iso(fy - 1, 4, 1), to: iso(fy, 3, 31) },
    { label: "Last 6 months", from: iso(six.getFullYear(), six.getMonth() + 1, 1), to: today },
  ];
}

export function ExportsBoard({ today }: { today: string }) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const ranges = presets(today);
  const [range, setRange] = useState({ from: ranges[0].from, to: ranges[0].to });
  const [asOf, setAsOf] = useState(today);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function download(kind: string, path: string, format: Format) {
    setError(null);
    setBusy(`${kind}:${format}`);
    try {
      await downloadReport(`${path}${path.includes("?") ? "&" : "?"}format=${format}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const [year, mm] = month.split("-");

  return (
    <>
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Exports</h1>
        <p className="text-sm text-muted">Download statements for the committee, the auditor or your own records</p>
      </header>

      {error && <p className="mb-3 rounded-lg bg-expense/10 px-3 py-2 text-sm text-expense">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card index={0} title="Monthly statement"
              description="Opening and closing balance by cash and bank, dues by flat, maintenance received, other income and expenses."
              busy={busy} kind="monthly"
              disabled={!month}
              onDownload={(f) => download("monthly", `/api/reports/monthly-statement?year=${year}&month=${Number(mm)}`, f)}>
          <label className="block text-xs text-muted">
            <span className="mb-1 block">Month</span>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="field" />
          </label>
        </Card>

        <Card index={1} title="Income vs expense"
              description="Month-wise income and expenditure, plus income and expenses by category, for any period up to 3 years."
              busy={busy} kind="income"
              disabled={!range.from || !range.to}
              onDownload={(f) => download("income", `/api/reports/income-expense?from=${range.from}&to=${range.to}`, f)}>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-muted">
              <span className="mb-1 block">From</span>
              <input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} className="field" />
            </label>
            <label className="block text-xs text-muted">
              <span className="mb-1 block">To</span>
              <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} className="field" />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ranges.map((p) => (
              <button key={p.label} type="button" onClick={() => setRange({ from: p.from, to: p.to })}
                      className="rounded-full bg-foreground/6 px-2.5 py-1 text-[11px] text-muted transition hover:text-foreground">
                {p.label}
              </button>
            ))}
          </div>
        </Card>

        <Card index={2} title="Balance sheet"
              description="Society fund and assets (cash plus bank) as on a date, for the financial year that date falls in."
              busy={busy} kind="balance"
              disabled={!asOf}
              onDownload={(f) => download("balance", `/api/reports/balance-sheet?asOf=${asOf}`, f)}>
          <label className="block text-xs text-muted">
            <span className="mb-1 block">As on</span>
            <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="field" />
          </label>
        </Card>
      </div>

      <p className="mt-4 text-xs text-muted">
        Reports use a cash basis: maintenance counts in the month it is received. Every download is recorded in the Audit log.
      </p>
    </>
  );
}

function Card({ index, title, description, busy, kind, disabled, onDownload, children }: {
  index: number; title: string; description: string; busy: string | null; kind: string;
  disabled: boolean; onDownload: (f: Format) => void; children: ReactNode;
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.07 }} className="glass flex flex-col p-5">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="mb-4 mt-1 text-xs text-muted">{description}</p>
      <div className="mb-5">{children}</div>
      <div className="mt-auto grid grid-cols-2 gap-2">
        <button disabled={disabled || busy !== null} onClick={() => onDownload("pdf")}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-accent py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50">
          <FileText className="size-4" />{busy === `${kind}:pdf` ? "Preparing…" : "PDF"}
        </button>
        <button disabled={disabled || busy !== null} onClick={() => onDownload("xlsx")}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-income/15 py-2.5 text-sm font-medium text-income transition hover:bg-income/25 disabled:opacity-50">
          <Table2 className="size-4" />{busy === `${kind}:xlsx` ? "Preparing…" : "Excel"}
        </button>
      </div>
    </motion.section>
  );
}
