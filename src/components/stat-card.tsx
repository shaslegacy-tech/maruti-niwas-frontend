"use client";

import { animate, motion, useMotionValue, useTransform } from "framer-motion";
import { type ReactNode, useEffect } from "react";
import { inr } from "@/lib/format";

interface Props {
  label: string;
  value: number;
  kind?: "currency" | "plain";
  suffix?: string;
  hint?: string;
  icon: ReactNode;
  tone?: "default" | "income" | "expense" | "warn";
  progress?: number; // 0..1
  index?: number;
}

const TONES = {
  default: "bg-accent/15 text-accent",
  income: "bg-income/15 text-income",
  expense: "bg-expense/15 text-expense",
  warn: "bg-warn/15 text-warn",
};

export function StatCard({ label, value, kind = "currency", suffix, hint, icon, tone = "default", progress, index = 0 }: Props) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => (kind === "currency" ? inr(Math.round(v)) : String(Math.round(v))));

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.9, ease: "easeOut" });
    return () => controls.stop();
  }, [mv, value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.45, ease: "easeOut" }}
      whileHover={{ y: -3 }}
      className="glass p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        <span className={`grid size-8 place-items-center rounded-lg ${TONES[tone]}`}>{icon}</span>
      </div>
      <p className="mt-3 flex items-baseline gap-1.5 text-2xl font-semibold tracking-tight tabular-nums">
        <motion.span>{text}</motion.span>
        {suffix && <span className="text-base font-normal text-muted">{suffix}</span>}
      </p>
      {progress !== undefined && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent to-income"
            initial={{ width: 0 }}
            animate={{ width: `${Math.round(progress * 100)}%` }}
            transition={{ delay: 0.3 + index * 0.07, duration: 0.8, ease: "easeOut" }}
          />
        </div>
      )}
      {hint && <p className="mt-2 text-xs text-muted">{hint}</p>}
    </motion.div>
  );
}
