import { EventsRuntimeManager } from "@/lib/cache/cache-manager";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { log } from "@/lib/platform/logger";
import { NextRequest, NextResponse } from "next/server";

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
	return "";
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
			{ status: 503, headers: NO_STORE_HEADERS },
		);
	}

	const providedSecret = readSecretToken(request);
	if (!providedSecret || providedSecret !== configuredSecret) {
		return NextResponse.json(
			{
				success: false,
				error: "Unauthorized",
			},
			{ status: 401, headers: NO_STORE_HEADERS },
		);
	}

	try {
		const refreshed = await EventsRuntimeManager.forceRefresh();
		if (!refreshed.success) {
			log.warn("cache", "Deploy revalidation completed with live data errors", {
				error: refreshed.error,
			});
			return NextResponse.json(
				{
					success: false,
					message: refreshed.message,
					error: refreshed.error ?? "Live data reload failed",
				},
				{ status: 500, headers: NO_STORE_HEADERS },
			);
		}

		return NextResponse.json(
			{
				success: true,
				message: refreshed.message,
				count: refreshed.count,
				source: refreshed.source,
			},
			{ headers: NO_STORE_HEADERS },
		);
	} catch (error) {
		log.error("cache", "Deploy revalidation route failed", undefined, error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500, headers: NO_STORE_HEADERS },
		);
	}
}

export async function POST(request: NextRequest): Promise<NextResponse> {
	return handleRevalidation(request);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
	return handleRevalidation(request);
}
