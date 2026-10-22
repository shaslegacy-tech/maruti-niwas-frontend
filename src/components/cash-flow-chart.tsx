"use client";

import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartPoint } from "@/lib/api";
import { inr } from "@/lib/format";

export function CashFlowChart({ data }: { data: ChartPoint[] }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="glass p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium">Income vs expenses</h2>
          <p className="text-xs text-muted">Last 6 months</p>
        </div>
        <div className="flex gap-4 text-xs text-muted">
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-income" />Income</span>
          <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-expense" />Expenses</span>
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={4} margin={{ left: -12, right: 4, top: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--muted)", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} width={56} tick={{ fill: "var(--muted)", fontSize: 12 }}
                   tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
            <Tooltip
              cursor={{ fill: "var(--border)" }}
              formatter={(v) => inr(Number(v))}
              contentStyle={{
                background: "var(--background)", border: "1px solid var(--border)",
                borderRadius: 12, fontSize: 12, color: "var(--foreground)",
              }}
            />
            <Bar dataKey="income" name="Income" fill="var(--income)" radius={[6, 6, 0, 0]} maxBarSize={22} />
            <Bar dataKey="expenses" name="Expenses" fill="var(--expense)" radius={[6, 6, 0, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.section>
  );
}
