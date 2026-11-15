import { NoticesBoard } from "@/components/notices-board";
import { getNotices } from "@/lib/api.server";

export const dynamic = "force-dynamic";

export default async function NoticesPage() {
  return <NoticesBoard initial={await getNotices()} />;
}
