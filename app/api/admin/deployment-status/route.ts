import { validateAdminKeyForApiRoute } from "@/features/auth/admin-validation";
import { getCurrentDeploymentId } from "@/lib/deployment/build-id";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
	if (!(await validateAdminKeyForApiRoute(request))) {
		return NextResponse.json(
			{ success: false, error: "Unauthorized" },
			{ status: 401, headers: NO_STORE_HEADERS },
		);
	}

	return NextResponse.json(
		{
			success: true,
			deploymentId: getCurrentDeploymentId(),
			timestamp: new Date().toISOString(),
		},
		{ headers: NO_STORE_HEADERS },
	);
}
