import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ApprovalItem, AuditEntry, MeetingDetail, MeetingSummary, ResidentMeetingLine, BalanceOverview, CommitteeMember, FlatDirectoryEntry, ComplaintSummary, Me, Notice, ResidentDocument, StaffClaim, StaffDocument, ResidentHome, ResidentLogin, Categories, DefaultersOverview, RecentReminder, Reconciliation, Dashboard, Flat, Maintenance, Summary, Transaction } from "./api";

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
export const getMe = () => get<Me>("/api/auth/me");
export const getResidents = () => get<ResidentLogin[]>("/api/residents");
export const getResidentHome = () => get<ResidentHome>("/api/me/home");
export const getNotices = () => get<Notice[]>("/api/notices");
export const getClaims = () => get<StaffClaim[]>("/api/payment-claims?limit=60");
export const getClaimsSummary = () => get<{ pending: number }>("/api/payment-claims/summary");
export const getMyComplaints = () => get<ComplaintSummary[]>("/api/me/complaints");
export const getComplaints = () => get<ComplaintSummary[]>("/api/complaints?limit=100");
export const getComplaintsSummary = () => get<{ active: number }>("/api/complaints/summary");
export const getMyDocuments = () => get<ResidentDocument[]>("/api/me/documents");
export const getDocuments = () => get<StaffDocument[]>("/api/documents");
export const getCommittee = () => get<CommitteeMember[]>("/api/committee");
export const getMembers = () => get<FlatDirectoryEntry[]>("/api/members");
export const getApprovals = () => get<ApprovalItem[]>("/api/approvals");
export const getApprovalsSummary = () => get<{ pending: number }>("/api/approvals/summary");
export const getMeetings = () => get<MeetingSummary[]>("/api/meetings");
export const getMeeting = (id: number) => get<MeetingDetail>(`/api/meetings/${id}`);
export const getMyMeetings = () => get<ResidentMeetingLine[]>("/api/me/meetings");
