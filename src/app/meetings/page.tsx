import { redirect } from "next/navigation";
import { MeetingsBoard } from "@/components/meetings-board";
import { ResidentMeetings } from "@/components/resident-meetings";
import { getMe, getMeetings, getMyMeetings } from "@/lib/api.server";

export const dynamic = "force-dynamic";

/** Same address for everyone: residents see the meetings they may see, staff see and manage them all. */
export default async function MeetingsPage() {
  const me = await getMe();
  if (me.mustChangePassword) redirect("/change-password");
  if (me.roles.includes("RESIDENT")) return <ResidentMeetings lines={await getMyMeetings()} />;
  const readOnly = !(me.roles.includes("TREASURER") || me.roles.includes("SECRETARY"));   // the Chairman reads the records
  return <MeetingsBoard initial={await getMeetings()} readOnly={readOnly} />;
}
