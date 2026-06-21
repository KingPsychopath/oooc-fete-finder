import { getOfficialFetePlanHref } from "@/features/plans/official-plan-config";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function RouteShortcutPage() {
	redirect(getOfficialFetePlanHref());
}
