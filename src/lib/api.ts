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
  // the Chairman's review of larger entries (the money counts either way)
  approvalStatus: "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED"; reviewNote: string | null; reviewedBy: string | null;
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
export interface Me {
  id: number | null; username: string; fullName: string; roles: string[];
  mustChangePassword: boolean;      // a new or reset login: the password must be changed first
  flatId: number | null;            // set for resident logins
  canViewFinancial: boolean;        // committee members: may they open financial documents (the treasurer always can)
}

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
  periods: string;                                       // months this receipt covers, e.g. "September 2026 – October 2026"
  whatsappStatus: "NOT_SENT" | "SHARED" | "SENT" | "FAILED" | "SKIPPED";   // SHARED = opened in WhatsApp by the treasurer
  whatsappShareUrl: string | null;                       // ready-to-send wa.me link (null when no phone saved)
}

/** Notes that the receipt was opened in WhatsApp (share sheet or wa.me link). */
export const markReceiptShared = (paymentId: number) =>
  request<PaymentInfo>(`/api/receipts/${paymentId}/shared`, { method: "POST" });

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
  emailAutomatic: boolean; autoRemindersEnabled: boolean; dueDay: number;
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
/** manual = the treasurer opened WhatsApp / their mail app themselves. false = the server sends it (email only). */
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

// ---- Multi-month payments ----
export type LineKind = "ARREARS" | "CURRENT" | "ADVANCE";

export interface PaymentPlan {
  flatId: number; flatNumber: string; ownerName: string;
  amount: number; outstandingTotal: number;
  outstanding: { recordId: number; year: number; month: number; label: string; balance: number }[];
  lines: { year: number; month: number; label: string; amount: number; kind: LineKind; balanceAfter: number; created: boolean }[];
  balanceAfter: number; hasArrears: boolean;
}
export interface FlatPaymentResult {
  paymentId: number; receiptNumber: string; receiptPath: string; periods: string; total: number;
  lines: { year: number; month: number; label: string; amount: number; kind: LineKind; settled: boolean }[];
  flatBalanceAfter: number; whatsappShareUrl: string | null;
}

/** How an amount would be split across months (oldest dues first). Saves nothing. */
export const getPaymentPlan = (flatId: number, amount?: number, onlyRecordId?: number) =>
  request<PaymentPlan>(
    `/api/maintenance/plan?flatId=${flatId}` +
    (amount !== undefined ? `&amount=${amount}` : "") +
    (onlyRecordId !== undefined ? `&onlyRecordId=${onlyRecordId}` : ""));

export const payFlat = (body: {
  flatId: number; amount: number; paymentMode: PaymentMode; paymentDate?: string;
  transactionRef?: string; remarks?: string; onlyRecordId?: number;
}) => request<FlatPaymentResult>("/api/maintenance/pay", { method: "POST", body: JSON.stringify(body) });

// ---- Account ----
export const changePassword = (currentPassword: string, newPassword: string) =>
  request<Me>("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });

// ---- Resident logins (treasurer) ----
export interface ResidentLogin {
  flatId: number; flatNumber: string; ownerName: string; phoneNumber: string | null; email: string | null;
  hasLogin: boolean; username: string | null; active: boolean; mustChangePassword: boolean; lastLoginAt: string | null;
}
export interface ResidentCredentials {
  username: string; temporaryPassword: string; loginUrl: string; message: string; whatsappUrl: string | null;
}
export const getResidents = () => request<ResidentLogin[]>("/api/residents");
export const createResidentLogin = (flatId: number) =>
  request<ResidentCredentials>(`/api/residents/${flatId}/credentials`, { method: "POST" });
export const setResidentActive = (flatId: number, active: boolean) =>
  request<ResidentLogin>(`/api/residents/${flatId}/active`, { method: "PUT", body: JSON.stringify({ active }) });

// ---- Resident portal (a resident's own flat) ----
export type NoticeKind = "NOTICE" | "ANNOUNCEMENT" | "MEETING";
export type ClaimStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface NoticeItem {
  id: number; kind: NoticeKind; title: string; body: string; pinned: boolean;
  postedAt: string; meetingAt: string | null; venue: string | null;
}
/** A payment the resident has told the treasurer about. mode is UPI, CASH or BANK_TRANSFER. */
export interface ResidentClaim {
  id: number; amount: number; paidOn: string; mode: string; reference: string | null; note: string | null;
  status: ClaimStatus; reviewNote: string | null; receiptNumber: string | null; submittedAt: string; hasProof: boolean;
}
export interface ResidentHome {
  flat: { flatNumber: string; ownerName: string; phoneNumber: string | null; email: string | null;
          occupantType: string; monthlyFee: number; societyName: string };
  outstandingTotal: number; overdueAmount: number; dueDay: number;
  currentMonth: { label: string; status: PaymentStatus; amount: number; balance: number; dueDate: string;
                  overdue: boolean; paymentDate: string | null } | null;
  paidThisYear: number; yearLabel: string;
  months: { year: number; month: number; label: string; amount: number; paid: number; balance: number;
            status: PaymentStatus; overdue: boolean; dueDate: string; paymentDate: string | null }[];
  receipts: { receiptNumber: string; date: string; amount: number; periods: string; mode: string;
              reference: string | null; receiptPath: string }[];
  claims: ResidentClaim[];
  notices: NoticeItem[];          // notices and announcements
  meetings: NoticeItem[];         // upcoming only
  payTo: { societyName: string; upiId: string | null; payeeName: string | null; bankName: string | null;
           accountName: string | null; accountNumber: string | null; ifsc: string | null; branch: string | null };
}
export const updateMyContact = (phoneNumber: string, email: string) =>
  request<ResidentHome["flat"]>("/api/me/contact", { method: "PUT", body: JSON.stringify({ phoneNumber, email }) });

/** "I have paid": sends payment details (and an optional screenshot) to the treasurer. Changes no balance. */
export async function submitPaymentProof(form: FormData): Promise<ResidentClaim> {
  const res = await fetch("/api/me/payments", { method: "POST", body: form });   // the browser sets the multipart header
  if (res.status === 401) { window.location.href = "/login"; throw new ApiError(401, "Session expired"); }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? "Could not send your payment details");
  }
  return res.json();
}
export const cancelMyClaim = (id: number) => request<void>(`/api/me/payments/${id}/cancel`, { method: "POST" });

// ---- Notices (staff) ----
export interface Notice {
  id: number; kind: NoticeKind; title: string; body: string; pinned: boolean;
  publishAt: string; expiresAt: string | null; meetingAt: string | null; venue: string | null;
  createdBy: string; live: boolean; whatsappShareUrl: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "PUBLISHED" | "REJECTED"; important: boolean;
  reviewNote: string | null; reviewedBy: string | null;
}
export interface NoticeInput {
  kind: NoticeKind; title: string; body: string; pinned: boolean;
  publishAt?: string; expiresAt?: string; meetingAt?: string; venue?: string;
  important?: boolean; action?: "DRAFT" | "PUBLISH";
}
export const getNotices = () => request<Notice[]>("/api/notices");
export const createNotice = (b: NoticeInput) => request<Notice>("/api/notices", { method: "POST", body: JSON.stringify(b) });
export const updateNotice = (id: number, b: NoticeInput) =>
  request<Notice>(`/api/notices/${id}`, { method: "PUT", body: JSON.stringify(b) });
export const deleteNotice = (id: number) => request<void>(`/api/notices/${id}`, { method: "DELETE" });
export const publishNotice = (id: number) => request<Notice>(`/api/notices/${id}/publish`, { method: "POST" });
export const unpublishNotice = (id: number) => request<Notice>(`/api/notices/${id}/draft`, { method: "POST" });

// ---- Payment claims (treasurer) ----
export interface StaffClaim {
  id: number; flatId: number; flatNumber: string; ownerName: string;
  amount: number; paidOn: string; mode: string; reference: string | null; note: string | null;
  status: ClaimStatus; reviewNote: string | null; reviewedBy: string | null; reviewedAt: string | null;
  receiptNumber: string | null; submittedAt: string;
  hasProof: boolean; proofType: string | null; proofPath: string | null;
  duplicateReference: boolean; flatOutstanding: number;
}
export const getClaims = () => request<StaffClaim[]>("/api/payment-claims?limit=60");
export const approveClaim = (id: number, body: { amount?: number; mode?: PaymentMode; paymentDate?: string; reference?: string }) =>
  request<StaffClaim>(`/api/payment-claims/${id}/approve`, { method: "POST", body: JSON.stringify(body) });
export const rejectClaim = (id: number, reason: string) =>
  request<StaffClaim>(`/api/payment-claims/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });

// ---- multipart posts (photos, documents) ----
async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(path, { method: "POST", body: form });   // the browser sets the multipart header itself
  if (res.status === 401) { window.location.href = "/login"; throw new ApiError(401, "Session expired"); }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? "That did not work. Please try again.");
  }
  return res.json();
}

// ---- Complaints ----
export type ComplaintStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type ComplaintCategory = "PLUMBING" | "ELECTRICAL" | "LIFT" | "CLEANING" | "SECURITY" | "PARKING" | "WATER" | "NOISE" | "OTHER";
export interface AttachmentMeta { id: number; commentId: number | null; name: string; type: string; sizeBytes: number }
export interface ComplaintSummary {
  id: number; flatId: number; flatNumber: string; ownerName: string;
  category: ComplaintCategory; title: string; status: ComplaintStatus;
  createdAt: string; lastActivityAt: string; resolvedAt: string | null; replies: number;
}
export interface ComplaintEntry {
  id: number; authorName: string; authorType: "RESIDENT" | "STAFF"; kind: "COMMENT" | "STATUS";
  body: string | null; statusTo: ComplaintStatus | null; createdAt: string; attachments: AttachmentMeta[];
}
export interface ComplaintDetail {
  summary: ComplaintSummary; description: string; attachments: AttachmentMeta[]; thread: ComplaintEntry[];
}

// resident
export const getMyComplaints = () => request<ComplaintSummary[]>("/api/me/complaints");
export const getMyComplaint = (id: number) => request<ComplaintDetail>(`/api/me/complaints/${id}`);
export const createComplaint = (form: FormData) => postForm<ComplaintDetail>("/api/me/complaints", form);
export const commentOnComplaint = (id: number, form: FormData) => postForm<ComplaintDetail>(`/api/me/complaints/${id}/comments`, form);
export const confirmComplaint = (id: number) => request<ComplaintDetail>(`/api/me/complaints/${id}/confirm`, { method: "POST" });
export const reopenComplaint = (id: number, reason: string) =>
  request<ComplaintDetail>(`/api/me/complaints/${id}/reopen?reason=${encodeURIComponent(reason)}`, { method: "POST" });
// staff
export const getComplaints = () => request<ComplaintSummary[]>("/api/complaints?limit=100");
export const getComplaintDetail = (id: number) => request<ComplaintDetail>(`/api/complaints/${id}`);
export const replyToComplaint = (id: number, form: FormData) => postForm<ComplaintDetail>(`/api/complaints/${id}/replies`, form);
export const setComplaintStatus = (id: number, status: ComplaintStatus, note?: string) =>
  request<ComplaintDetail>(`/api/complaints/${id}/status`, { method: "POST", body: JSON.stringify({ status, note }) });

// ---- Documents ----
export type DocumentCategory = "NOTICE" | "MINUTES" | "RULES" | "IMPORTANT" | "FINANCIAL" | "OTHER" | "REGISTRATION" | "RESOLUTION" | "CIRCULAR";
export interface ResidentDocument {
  id: number; title: string; category: DocumentCategory; description: string | null; docDate: string | null;
  fileType: string; sizeBytes: number; createdAt: string;
}
export interface StaffDocument {
  id: number; title: string; category: DocumentCategory; description: string | null; docDate: string | null;
  visibility: "RESIDENTS" | "STAFF"; sensitive: boolean; sharedWithResidents: boolean;
  fileName: string; fileType: string; sizeBytes: number; uploadedBy: string; createdAt: string;
}
export const getMyDocuments = () => request<ResidentDocument[]>("/api/me/documents");
export const getDocuments = () => request<StaffDocument[]>("/api/documents");
export const uploadDocument = (form: FormData) => postForm<StaffDocument>("/api/documents", form);
export const updateDocument = (id: number, body: {
  title: string; category: DocumentCategory; description?: string; docDate?: string;
  visibility: "RESIDENTS" | "STAFF"; confirmSensitive: boolean;
}) => request<StaffDocument>(`/api/documents/${id}`, { method: "PUT", body: JSON.stringify(body) });
export const deleteDocument = (id: number) => request<void>(`/api/documents/${id}`, { method: "DELETE" });

// ---- Committee accounts (treasurer only) ----
export interface CommitteeMember {
  id: number; username: string; fullName: string; email: string | null; role: "SECRETARY" | "CHAIRMAN";
  active: boolean; mustChangePassword: boolean; canViewFinancial: boolean; lastLoginAt: string | null;
}
export const getCommittee = () => request<CommitteeMember[]>("/api/committee");
export const createCommitteeMember = (b: {
  fullName: string; role: "SECRETARY" | "CHAIRMAN"; username?: string; email?: string; phone?: string; canViewFinancial: boolean;
}) => request<ResidentCredentials>("/api/committee", { method: "POST", body: JSON.stringify(b) });
export const resetCommitteePassword = (id: number) =>
  request<ResidentCredentials>(`/api/committee/${id}/credentials`, { method: "POST" });
export const updateCommitteeMember = (id: number, b: { active?: boolean; canViewFinancial?: boolean }) =>
  request<CommitteeMember>(`/api/committee/${id}`, { method: "PUT", body: JSON.stringify(b) });

// ---- Members, family, flat and ownership information ----
export type MemberRelation = "CO_OWNER" | "SPOUSE" | "CHILD" | "PARENT" | "SIBLING" | "TENANT" | "OTHER";
export interface MemberView {
  id: number; flatId: number; fullName: string; relation: MemberRelation;
  phone: string | null; email: string | null; notes: string | null;
}
export interface FlatDirectoryEntry {
  flatId: number; flatNumber: string; ownerName: string; phoneNumber: string | null; email: string | null;
  occupantType: "OWNER" | "TENANT" | "VACANT"; floorNo: number | null; areaSqFt: number | null;
  parkingSlot: string | null; ownershipSince: string | null; shareCertificateNo: string | null;
  ownershipNotes: string | null; members: MemberView[];
}
export interface FlatDetailsInput {
  ownerName: string; phoneNumber?: string; email?: string; occupantType: "OWNER" | "TENANT" | "VACANT";
  floorNo?: number; areaSqFt?: number; parkingSlot?: string; ownershipSince?: string;
  shareCertificateNo?: string; ownershipNotes?: string;
}
export interface MemberInput { fullName: string; relation: MemberRelation; phone?: string; email?: string; notes?: string }
export const getMembers = () => request<FlatDirectoryEntry[]>("/api/members");
export const updateFlatDetails = (flatId: number, b: FlatDetailsInput) =>
  request<FlatDirectoryEntry>(`/api/members/flats/${flatId}`, { method: "PUT", body: JSON.stringify(b) });
export const addMember = (flatId: number, b: MemberInput) =>
  request<MemberView>(`/api/members/flats/${flatId}/people`, { method: "POST", body: JSON.stringify(b) });
export const updateMember = (id: number, b: MemberInput) =>
  request<MemberView>(`/api/members/people/${id}`, { method: "PUT", body: JSON.stringify(b) });
export const removeMember = (id: number) => request<void>(`/api/members/people/${id}`, { method: "DELETE" });

// ---- Approvals (Chairman) ----
export interface ApprovalItem {
  type: "NOTICE" | "RESOLUTION" | "TRANSACTION"; id: number; title: string; meta: string; summary: string;
  submittedBy: string; submittedAt: string | null; amount: number | null;
}
export const getApprovals = () => request<ApprovalItem[]>("/api/approvals");
export const approveNotice = (id: number) => request<void>(`/api/approvals/notices/${id}/approve`, { method: "POST" });
export const rejectNotice = (id: number, reason: string) =>
  request<void>(`/api/approvals/notices/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
export const approveResolution = (id: number) => request<void>(`/api/approvals/resolutions/${id}/approve`, { method: "POST" });
export const rejectResolution = (id: number, reason: string) =>
  request<void>(`/api/approvals/resolutions/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });

// ---- Meetings ----
export type MeetingKind = "AGM" | "SPECIAL" | "COMMITTEE" | "OTHER";
export type MeetingStatus = "DRAFT" | "SCHEDULED" | "HELD" | "CANCELLED";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "APOLOGY";
export type ResolutionOutcome = "PASSED" | "REJECTED" | "DEFERRED";
export type ApprovalState = "NOT_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED";
export interface MeetingSummary {
  id: number; kind: MeetingKind; title: string; scheduledAt: string; venue: string | null; status: MeetingStatus;
  minutesPublished: boolean; agendaCount: number; resolutionCount: number; createdBy: string;
}
export interface AgendaItemView { id: number; position: number; title: string; notes: string | null }
export interface AttendanceRow {
  flatId: number; flatNumber: string; ownerName: string; status: AttendanceStatus | null;
  attendeeName: string | null; note: string | null;
}
export interface ResolutionView {
  id: number; number: number; title: string; text: string; outcome: ResolutionOutcome;
  votesFor: number | null; votesAgainst: number | null; abstained: number | null;
  important: boolean; approvalStatus: ApprovalState; reviewNote: string | null; reviewedBy: string | null;
}
export interface MeetingDetail {
  summary: MeetingSummary; description: string | null; cancelledReason: string | null; minutes: string | null;
  agenda: AgendaItemView[]; attendance: AttendanceRow[]; resolutions: ResolutionView[]; documents: StaffDocument[];
}
export interface MeetingInput { kind: MeetingKind; title: string; scheduledAt: string; venue?: string; description?: string }
export interface ResolutionInput {
  title: string; text: string; outcome: ResolutionOutcome; votesFor?: number; votesAgainst?: number; abstained?: number; important: boolean;
}
export const getMeetings = () => request<MeetingSummary[]>("/api/meetings");
export const getMeeting = (id: number) => request<MeetingDetail>(`/api/meetings/${id}`);
export const createMeeting = (b: MeetingInput) => request<MeetingDetail>("/api/meetings", { method: "POST", body: JSON.stringify(b) });
export const updateMeeting = (id: number, b: MeetingInput) => request<MeetingDetail>(`/api/meetings/${id}`, { method: "PUT", body: JSON.stringify(b) });
export const deleteMeeting = (id: number) => request<void>(`/api/meetings/${id}`, { method: "DELETE" });
export const scheduleMeeting = (id: number) => request<MeetingDetail>(`/api/meetings/${id}/schedule`, { method: "POST" });
export const markMeetingHeld = (id: number) => request<MeetingDetail>(`/api/meetings/${id}/held`, { method: "POST" });
export const cancelMeeting = (id: number, reason: string) =>
  request<MeetingDetail>(`/api/meetings/${id}/cancel`, { method: "POST", body: JSON.stringify({ reason }) });
export const saveAgenda = (id: number, items: { title: string; notes?: string }[]) =>
  request<MeetingDetail>(`/api/meetings/${id}/agenda`, { method: "PUT", body: JSON.stringify({ items }) });
export const saveAttendance = (id: number, rows: { flatId: number; status: AttendanceStatus; attendeeName?: string; note?: string }[]) =>
  request<MeetingDetail>(`/api/meetings/${id}/attendance`, { method: "PUT", body: JSON.stringify({ rows }) });
export const saveMinutes = (id: number, minutes: string, published: boolean) =>
  request<MeetingDetail>(`/api/meetings/${id}/minutes`, { method: "PUT", body: JSON.stringify({ minutes, published }) });
export const addResolution = (id: number, b: ResolutionInput) =>
  request<MeetingDetail>(`/api/meetings/${id}/resolutions`, { method: "POST", body: JSON.stringify(b) });
export const updateResolution = (resolutionId: number, b: ResolutionInput) =>
  request<MeetingDetail>(`/api/meetings/resolutions/${resolutionId}`, { method: "PUT", body: JSON.stringify(b) });
export const deleteResolution = (resolutionId: number) =>
  request<MeetingDetail>(`/api/meetings/resolutions/${resolutionId}`, { method: "DELETE" });
export const uploadMeetingDocument = (id: number, form: FormData) => postForm<StaffDocument>(`/api/meetings/${id}/documents`, form);

// resident view
export interface ResidentMeetingLine {
  id: number; kind: MeetingKind; title: string; scheduledAt: string; venue: string | null; status: MeetingStatus; hasMinutes: boolean;
}
export interface ResidentMeeting {
  id: number; kind: MeetingKind; title: string; scheduledAt: string; venue: string | null; status: MeetingStatus;
  description: string | null; cancelledReason: string | null; agenda: AgendaItemView[]; minutes: string | null;
  decisions: { number: number; title: string; text: string; outcome: ResolutionOutcome; votesFor: number | null; votesAgainst: number | null; abstained: number | null }[];
  documents: ResidentDocument[];
}
export const getMyMeetings = () => request<ResidentMeetingLine[]>("/api/me/meetings");
export const getMyMeeting = (id: number) => request<ResidentMeeting>(`/api/me/meetings/${id}`);
export const approveTransaction = (id: number) => request<void>(`/api/approvals/transactions/${id}/approve`, { method: "POST" });
export const rejectTransaction = (id: number, reason: string) =>
  request<void>(`/api/approvals/transactions/${id}/reject`, { method: "POST", body: JSON.stringify({ reason }) });
export interface ReviewSummary { pending: number; rejected: number; threshold: number }

// ---- Backup health (treasurer) ----
export interface BackupStatus {
  ok?: boolean; error?: string | null; lastSuccessAt?: string | null; file?: string; sizeBytes?: number;
  encrypted?: boolean; offsite?: "ok" | "failed" | "skipped";
  lastVerifiedAt?: string | null; lastVerifyOk?: boolean | null; lastVerifyError?: string | null;
}
export interface BackupStatusResponse { configured: boolean; readable?: boolean; status?: BackupStatus; serverTime?: string }
