import { FlatsBoard } from "@/components/flats-board";
import { getFlats, getMaintenance } from "@/lib/api.server";

export const dynamic = "force-dynamic";

export default async function FlatsPage() {
  const [records, flats] = await Promise.all([getMaintenance(), getFlats()]);
  const now = new Date();
  return (
    <FlatsBoard
      initialFlats={flats}
      initialRecords={records}
      initialYear={records[0]?.year ?? now.getFullYear()}
      initialMonth={records[0]?.month ?? now.getMonth() + 1}
    />
  );
}
