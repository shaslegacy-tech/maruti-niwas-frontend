import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { AuditEntry, BalanceOverview, Categories, DefaultersOverview, RecentReminder, Reconciliation, Dashboard, Flat, Maintenance, Summary, Transaction } from "./api";

const API = process.env.API_URL ?? "http://localhost:8080";

async function get<T>(path: string): Promise<T> {
  const token = (await cookies()).get("mn_token")?.value;
  const res = await fetch(API + path, {
    cache: "no-store",
    headers: token ? { Cookie: `mn_token=${token}` } : {},
  });
  if (res.status === 401) redirect("/login");
  if (!res.ok) throw new Error(`Backend request failed: ${path} (${res.status})`);
  return res.json() as Promise<T>;
}

export const getDashboard = () => get<Dashboard>("/api/dashboard");
export const getFlats = () => get<Flat[]>("/api/flats");
export const getMaintenance = () => get<Maintenance[]>("/api/maintenance");
export const getTransactions = (y: number, m: number) => get<Transaction[]>(`/api/transactions?year=${y}&month=${m}`);
export const getCategories = () => get<Categories>("/api/transactions/categories");
export const getSummary = (y: number, m: number) => get<Summary>(`/api/summaries/${y}/${m}`);
export const getSummaryHistory = () => get<Summary[]>("/api/summaries?limit=12");
export const getAudit = (limit = 150) => get<AuditEntry[]>(`/api/audit?limit=${limit}`);
export const getBalanceOverview = () => get<BalanceOverview>("/api/balances/overview");
export const getReconciliation = (y: number, m: number) => get<Reconciliation>(`/api/balances/months/${y}/${m}`);
export const getDefaulters = () => get<DefaultersOverview>("/api/defaulters");
export const getRecentReminders = () => get<RecentReminder[]>("/api/defaulters/reminders?limit=15");
