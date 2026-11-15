import { ResidentsBoard } from "@/components/residents-board";
import { getResidents } from "@/lib/api.server";

export const dynamic = "force-dynamic";

export default async function ResidentsPage() {
  return <ResidentsBoard initial={await getResidents()} />;
}
