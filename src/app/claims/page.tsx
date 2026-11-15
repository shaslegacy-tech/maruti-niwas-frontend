import { ClaimsBoard } from "@/components/claims-board";
import { getClaims } from "@/lib/api.server";

export const dynamic = "force-dynamic";

export default async function ClaimsPage() {
  return <ClaimsBoard initial={await getClaims()} />;
}
