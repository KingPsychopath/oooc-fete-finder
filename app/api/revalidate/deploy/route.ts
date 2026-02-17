import { NextRequest, NextResponse } from "next/server";
import { CacheManager } from "@/lib/cache/cache-manager";
import { log } from "@/lib/platform/logger";

export const runtime = "nodejs";

const readSecretToken = (request: NextRequest): string => {
	const authorization = request.headers.get("authorization");
	if (authorization?.startsWith("Bearer ")) {
		return authorization.slice(7).trim();
	}

	const headerToken = request.headers.get("x-revalidate-secret");
	if (headerToken && headerToken.trim().length > 0) {
		return headerToken.trim();
	}

	return request.nextUrl.searchParams.get("secret")?.trim() ?? "";
};

async function handleRevalidation(request: NextRequest): Promise<NextResponse> {
	const configuredSecret = process.env.DEPLOY_REVALIDATE_SECRET?.trim() ?? "";
	if (!configuredSecret) {
		log.warn(
			"cache",
			"Deploy revalidation endpoint called without DEPLOY_REVALIDATE_SECRET configured",
		);
		return NextResponse.json(
			{
				success: false,
				error: "DEPLOY_REVALIDATE_SECRET is not configured",
			},
			{ status: 503 },
		);
	}

	const providedSecret = readSecretToken(request);
	if (!providedSecret || providedSecret !== configuredSecret) {
		return NextResponse.json(
			{
				success: false,
				error: "Unauthorized",
			},
			{ status: 401 },
		);
	}

	try {
		const refreshed = await CacheManager.forceRefresh();
		if (!refreshed.success) {
			log.warn("cache", "Deploy revalidation completed with refresh errors", {
				error: refreshed.error,
			});
			return NextResponse.json(
				{
					success: false,
					message: refreshed.message,
					error: refreshed.error ?? "Cache refresh failed",
				},
				{ status: 500 },
			);
		}

		return NextResponse.json({
			success: true,
			message: refreshed.message,
			count: refreshed.count,
			source: refreshed.source,
		});
	} catch (error) {
		log.error("cache", "Deploy revalidation route failed", undefined, error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 },
		);
	}
}

export async function POST(request: NextRequest): Promise<NextResponse> {
	return handleRevalidation(request);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
	return handleRevalidation(request);
}
