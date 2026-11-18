import { notFound, redirect } from "next/navigation";
import { MeetingDetailView } from "@/components/meeting-detail";
import { TABS, type Tab } from "@/components/meeting-shared";
import { getMe, getMeeting } from "@/lib/api.server";

export const dynamic = "force-dynamic";

export default async function MeetingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const me = await getMe();
  if (me.mustChangePassword) redirect("/change-password");
  if (me.roles.includes("RESIDENT")) redirect("/meetings");           // residents use the list and its details
  const meetingId = Number(id);
  if (!Number.isInteger(meetingId)) notFound();
  const readOnly = !(me.roles.includes("TREASURER") || me.roles.includes("SECRETARY"));
  const initialTab: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : "overview";
  return <MeetingDetailView initial={await getMeeting(meetingId)} readOnly={readOnly} initialTab={initialTab} />;
}
