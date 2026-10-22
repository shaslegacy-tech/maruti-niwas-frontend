// Browser calls go to this same origin; next.config.ts proxies /api/* to Spring Boot.
const BASE = "";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/login") {
    window.location.href = "/login";
    throw new ApiError(401, "Session expired");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

// ---- Types (mirror the Spring Boot DTOs) ----
export type PaymentStatus = "PAID" | "PENDING" | "PARTIAL";
export type TxType = "INCOME" | "EXPENSE";

export interface ChartPoint { label: string; income: number; expenses: number }
export interface FeedItem {
  type: TxType; category: string; title: string;
  amount: number; date: string; status: PaymentStatus | "COMPLETED";
}
export interface Dashboard {
  monthLabel: string; totalBalance: number; cashBalance: number; bankBalance: number;
  flatsPaid: number; totalFlats: number;
  maintenanceCollected: number; monthIncome: number; monthExpenses: number;
  pendingDues: number; chart: ChartPoint[]; recent: FeedItem[];
}

// ---- Endpoints ----
export const getDashboard = () => request<Dashboard>("/api/dashboard");

// ---- Flats & maintenance ----
export type PaymentMode = "UPI" | "CASH" | "BANK_TRANSFER";
export type OccupantType = "OWNER" | "TENANT" | "VACANT";

export interface Flat {
  id: number; flatNumber: string; ownerName: string; phoneNumber: string | null; email: string | null;
  occupantType: OccupantType; monthlyFee: number; active: boolean;
  outstandingAmount: number; pendingMonths: number;
}
export interface Maintenance {
  id: number; flatId: number; flatNumber: string; ownerName: string; phoneNumber: string | null;
  month: number; year: number; amount: number; amountPaid: number; balanceDue: number;
  status: PaymentStatus; paymentDate: string | null; paymentMode: PaymentMode | null;
  transactionRef: string | null; remarks: string | null;
  reminderMessage: string | null; whatsappReminderUrl: string | null;
  payments: PaymentInfo[];
}
export interface PaymentInput {
  amount: number; paymentMode: PaymentMode; paymentDate?: string; transactionRef?: string; remarks?: string;
}
export interface FlatInput {
  flatNumber: string; ownerName: string; phoneNumber?: string; email?: string; occupantType: OccupantType; monthlyFee: number;
}

export const getFlats = () => request<Flat[]>("/api/flats");
export const getMaintenance = (year?: number, month?: number) =>
  request<Maintenance[]>(year && month ? `/api/maintenance?year=${year}&month=${month}` : "/api/maintenance");
export const recordPayment = (id: number, body: PaymentInput) =>
  request<Maintenance>(`/api/maintenance/${id}/payments`, { method: "POST", body: JSON.stringify(body) });
export const resetPayment = (id: number) =>
  request<Maintenance>(`/api/maintenance/${id}/reset`, { method: "POST" });
export const updateFlat = (id: number, body: FlatInput) =>
  request<Flat>(`/api/flats/${id}`, { method: "PUT", body: JSON.stringify(body) });

// ---- Ledger ----
export interface Transaction {
  id: number; type: TxType; category: string; amount: number; date: string;
  paidTo: string | null; paidBy: string | null; description: string | null;
  receiptRef: string | null; recordedBy: string | null; account: Account;
}
export interface TransactionInput {
  type: TxType; category: string; amount: number; date: string;
  paidTo?: string; paidBy?: string; description?: string; receiptRef?: string; account?: Account;
}
export interface Categories { expense: string[]; income: string[] }

export const getTransactions = (year: number, month: number) =>
  request<Transaction[]>(`/api/transactions?year=${year}&month=${month}`);
export const getCategories = () => request<Categories>("/api/transactions/categories");
export const createTransaction = (body: TransactionInput) =>
  request<Transaction>("/api/transactions", { method: "POST", body: JSON.stringify(body) });
export const updateTransaction = (id: number, body: TransactionInput) =>
  request<Transaction>(`/api/transactions/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteTransaction = (id: number) =>
  request<void>(`/api/transactions/${id}`, { method: "DELETE" });

// ---- Monthly summaries ----
export interface Summary {
  year: number; month: number; openingBalance: number; maintenanceIncome: number; otherIncome: number;
  totalIncome: number; totalExpenses: number; adjustments: number; closingBalance: number; closingCash: number; closingBank: number;
  closed: boolean; closedAt: string | null; reportText: string; whatsappShareUrl: string;
}

export const getSummary = (year: number, month: number) => request<Summary>(`/api/summaries/${year}/${month}`);
export const getSummaryHistory = (limit = 12) => request<Summary[]>(`/api/summaries?limit=${limit}`);
export const closeMonth = (year: number, month: number) =>
  request<Summary>(`/api/summaries/${year}/${month}/close`, { method: "POST" });
export const reopenMonth = (year: number, month: number) =>
  request<Summary>(`/api/summaries/${year}/${month}/reopen`, { method: "POST" });

// ---- Auth ----
export interface Me { id: number | null; username: string; fullName: string; roles: string[] }

export const login = (username: string, password: string) =>
  request<Me>("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
export const logout = () => request<void>("/api/auth/logout", { method: "POST" });
export const getMe = () => request<Me>("/api/auth/me");

// ---- Audit ----
export interface AuditEntry {
  id: number; occurredAt: string; actor: string; action: string;
  entityType: string; entityId: string | null; summary: string | null;
  before: Record<string, unknown> | null; after: Record<string, unknown> | null;
}

// ---- Balances (cash + bank) ----
export type Account = "CASH" | "BANK";
export interface AccountBalance { cash: number; bank: number; total: number }
export interface MonthStatement {
  year: number; month: number;
  opening: AccountBalance; maintenance: AccountBalance; otherIncome: AccountBalance;
  expenses: AccountBalance; adjustments: AccountBalance; closing: AccountBalance;
}
export interface Adjustment {
  id: number; account: Account; date: string; amount: number; reason: string; createdBy: string; createdAt: string;
}
export interface Verification {
  status: "MATCHED" | "ADJUSTED" | "VARIANCE";
  expectedCash: number; expectedBank: number; actualCash: number; actualBank: number;
  differenceCash: number; differenceBank: number; adjusted: boolean;
  note: string | null; verifiedBy: string; verifiedAt: string;
}
export interface Reconciliation {
  statement: MonthStatement; verification: Verification | null; adjustments: Adjustment[]; monthClosed: boolean;
}
export interface OpeningBalance {
  id: number; asOf: string; cash: number; bank: number; total: number; note: string | null; updatedAt: string;
}
export interface BalanceOverview { current: AccountBalance; openings: OpeningBalance[]; adjustments: Adjustment[] }
export interface ReconcileInput {
  actualCash: number; actualBank: number; note?: string; postAdjustments: boolean; reason?: string;
}

export const getBalanceOverview = () => request<BalanceOverview>("/api/balances/overview");
export const saveOpeningBalance = (b: { asOf: string; cash: number; bank: number; note?: string }) =>
  request<OpeningBalance>("/api/balances/openings", { method: "PUT", body: JSON.stringify(b) });
export const getReconciliation = (y: number, m: number) =>
  request<Reconciliation>(`/api/balances/months/${y}/${m}`);
export const reconcile = (y: number, m: number, b: ReconcileInput) =>
  request<Reconciliation>(`/api/balances/months/${y}/${m}/reconcile`, { method: "POST", body: JSON.stringify(b) });

// ---- Receipts ----
export interface PaymentInfo {
  id: number; receiptNumber: string; amount: number; date: string;
  mode: PaymentMode; transactionRef: string | null;
  receiptPath: string;                                   // same-origin link to the PDF
  whatsappStatus: "NOT_SENT" | "SENT" | "FAILED" | "SKIPPED"; whatsappError: string | null;
  whatsappAutomatic: boolean;                            // server can send by itself
  whatsappShareUrl: string | null;                       // ready-to-send wa.me link (null when no phone saved)
}

export const sendReceipt = (paymentId: number) =>
  request<PaymentInfo>(`/api/receipts/${paymentId}/send`, { method: "POST" });

// ---- Defaulters & reminders ----
export type ReminderChannel = "WHATSAPP" | "EMAIL";
export type ReminderStatus = "PREPARED" | "SENT" | "FAILED";

export interface DueMonth {
  year: number; month: number; label: string; amount: number; paid: number; balance: number;
  overdue: boolean; dueDate: string;
}
export interface Defaulter {
  flatId: number; flatNumber: string; ownerName: string; phoneNumber: string | null; email: string | null;
  totalOutstanding: number; overdueAmount: number; monthsOverdue: number; daysOverdue: number;
  months: DueMonth[];
  lastReminder: { channel: ReminderChannel; status: ReminderStatus; at: string; by: string } | null;
  reminderCount: number;
  whatsappUrl: string | null;      // wa.me link with the message filled in
  mailtoUrl: string | null;
}
export interface DefaultersOverview {
  summary: { flats: number; overdueFlats: number; totalOutstanding: number; overdueAmount: number; oldestDaysOverdue: number };
  defaulters: Defaulter[];
  whatsappAutomatic: boolean; emailAutomatic: boolean; autoRemindersEnabled: boolean; dueDay: number;
}
export interface ReminderOutcome {
  id: number; flatNumber: string; channel: ReminderChannel; status: ReminderStatus; detail: string | null; at: string;
}
export interface BulkReminderResult { sent: number; failed: number; skipped: number; notes: string[] }
export interface RecentReminder {
  id: number; flatNumber: string; ownerName: string; channel: ReminderChannel; status: ReminderStatus;
  amountDue: number; detail: string | null; triggeredBy: string; at: string;
}

export const getDefaulters = () => request<DefaultersOverview>("/api/defaulters");
export const getRecentReminders = () => request<RecentReminder[]>("/api/defaulters/reminders?limit=15");
/** manual = the treasurer opened WhatsApp / their mail app themselves; false = the server sends it. */
export const remindFlat = (flatId: number, channel: ReminderChannel, manual: boolean) =>
  request<ReminderOutcome>(`/api/defaulters/${flatId}/reminders`, { method: "POST", body: JSON.stringify({ channel, manual }) });
export const remindAll = () => request<BulkReminderResult>("/api/defaulters/remind-all", { method: "POST" });

// ---- Report downloads ----
/** Fetches a generated report and saves it. Errors come back as readable messages instead of a broken file. */
export async function downloadReport(path: string): Promise<void> {
  const res = await fetch(path, { cache: "no-store" });
  if (res.status === 401) { window.location.href = "/login"; return; }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? "Could not create the report");
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const name = /filename="?([^";]+)"?/.exec(disposition)?.[1] ?? "report";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
