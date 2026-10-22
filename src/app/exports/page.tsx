import { ExportsBoard } from "@/components/exports-board";

export const dynamic = "force-dynamic";

export default function ExportsPage() {
  // Today's date in India, whatever the server's time zone
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return <ExportsBoard today={today} />;
}
