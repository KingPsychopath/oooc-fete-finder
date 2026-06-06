import { getAdminUserDetail } from "@/features/users/admin-actions";
import { unstable_noStore as noStore } from "next/cache";
import { UserDetailClient } from "../UserDetailClient";

export const dynamic = "force-dynamic";

export default async function AdminUserDetailPage({
	params,
}: {
	params: Promise<{ userId: string }>;
}) {
	noStore();

	const { userId } = await params;
	const lookup = decodeURIComponent(userId);
	const initialPayload = await getAdminUserDetail(lookup);
	return <UserDetailClient lookup={lookup} initialPayload={initialPayload} />;
}
