import {
	USER_AUTH_COOKIE_NAME,
	getCanonicalUserSessionFromCookieHeader,
} from "@/features/auth/user-session-cookie";
import { MAX_PLANS_PER_DATE } from "@/features/plans/types";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import {
	DEFAULT_JSON_BODY_LIMIT_BYTES,
	isJsonContentType,
	isSameOriginRequest,
	isWithinBodySizeLimit,
} from "@/lib/http/request-security";
import { log } from "@/lib/platform/logger";
import { getUserPlanRepository } from "@/lib/platform/postgres/user-plan-repository";
import { NextResponse } from "next/server";
import { z } from "zod";

const planStopSchema = z.object({
	id: z.string().trim().max(80).optional(),
	eventKey: z.string().trim().min(1).max(220),
	stopOrder: z.number().int().min(1).max(20),
	locked: z.boolean().optional(),
	arrivalTime: z.string().trim().max(12).nullable().optional(),
	departureTime: z.string().trim().max(12).nullable().optional(),
	travelMinutesFromPrevious: z
		.number()
		.int()
		.min(0)
		.max(360)
		.nullable()
		.optional(),
});

const planSchema = z.object({
	id: z.string().trim().max(80).optional(),
	planDate: z
		.string()
		.trim()
		.regex(/^\d{4}-\d{2}-\d{2}$/),
	title: z.string().trim().min(1).max(120),
	visibility: z.enum(["private", "unlisted"]).default("private"),
	stops: z.array(planStopSchema).max(12),
});

const plansPostSchema = z.object({
	plan: planSchema,
	source: z.string().trim().max(80).optional(),
	idempotencyKey: z.string().trim().max(240).optional(),
});

const plansDeleteSchema = z.object({
	planId: z.string().trim().min(1).max(80),
	source: z.string().trim().max(80).optional(),
	idempotencyKey: z.string().trim().max(240).optional(),
});

export const runtime = "nodejs";

const parseCookieByName = (
	cookieHeader: string | null,
	name: string,
): string | undefined => {
	if (!cookieHeader) return undefined;
	const segments = cookieHeader.split(";");
	for (const segment of segments) {
		const [rawKey, ...rawValueParts] = segment.trim().split("=");
		if (rawKey === name) return rawValueParts.join("=");
	}
	return undefined;
};

const getUserPlanIdentity = async (
	request: Request,
): Promise<{ userId: string; ownerKey: string } | null> => {
	const cookieHeader = request.headers.get("cookie");
	const userCookie = parseCookieByName(cookieHeader, USER_AUTH_COOKIE_NAME);
	const userSession = await getCanonicalUserSessionFromCookieHeader(userCookie);
	if (!userSession.isAuthenticated || !userSession.userId) return null;
	return {
		userId: userSession.userId,
		ownerKey: `user:${userSession.userId}`,
	};
};

export async function GET(request: Request) {
	const repository = getUserPlanRepository();
	const identity = await getUserPlanIdentity(request);
	if (!repository || !identity) {
		return NextResponse.json(
			{ success: true, plans: [] },
			{ headers: NO_STORE_HEADERS },
		);
	}

	try {
		const plans = await repository.listPlans({ ownerKey: identity.ownerKey });
		return NextResponse.json(
			{ success: true, plans },
			{ headers: NO_STORE_HEADERS },
		);
	} catch (error) {
		log.warn("plans.user", "Failed to list user plans", {
			error: error instanceof Error ? error.message : "unknown",
		});
		return NextResponse.json(
			{ success: true, plans: [] },
			{ headers: NO_STORE_HEADERS },
		);
	}
}

export async function POST(request: Request) {
	if (
		!isSameOriginRequest(request) ||
		!isJsonContentType(request) ||
		!isWithinBodySizeLimit(request, DEFAULT_JSON_BODY_LIMIT_BYTES)
	) {
		return NextResponse.json(
			{ success: false, error: "Invalid request" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const repository = getUserPlanRepository();
	const identity = await getUserPlanIdentity(request);
	if (!repository || !identity) {
		return NextResponse.json(
			{ success: false, error: "Sign in to sync plans" },
			{ status: 401, headers: NO_STORE_HEADERS },
		);
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return NextResponse.json(
			{ success: false, error: "Invalid JSON" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const parsed = plansPostSchema.safeParse(payload);
	if (!parsed.success) {
		return NextResponse.json(
			{ success: false, error: "Invalid plan" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	try {
		const existingPlans = await repository.listPlans({
			ownerKey: identity.ownerKey,
		});
		const existingPlan = parsed.data.plan.id
			? existingPlans.find((plan) => plan.id === parsed.data.plan.id)
			: undefined;
		const plansForDate = existingPlans.filter(
			(plan) => plan.planDate === parsed.data.plan.planDate,
		);
		if (!existingPlan && plansForDate.length >= MAX_PLANS_PER_DATE) {
			return NextResponse.json(
				{
					success: false,
					error: `You can save up to ${MAX_PLANS_PER_DATE} routes for this day`,
				},
				{ status: 409, headers: NO_STORE_HEADERS },
			);
		}
		const plan = await repository.upsertPlan({
			ownerKey: identity.ownerKey,
			userId: identity.userId,
			plan: parsed.data.plan,
		});
		return NextResponse.json(
			{ success: true, plan },
			{ headers: NO_STORE_HEADERS },
		);
	} catch (error) {
		log.warn("plans.user", "Failed to save user plan", {
			planId: parsed.data.plan.id,
			source: parsed.data.source,
			hasIdempotencyKey: Boolean(parsed.data.idempotencyKey),
			error: error instanceof Error ? error.message : "unknown",
		});
		return NextResponse.json(
			{ success: false, error: "Plan was not saved" },
			{ status: 500, headers: NO_STORE_HEADERS },
		);
	}
}

export async function DELETE(request: Request) {
	if (
		!isSameOriginRequest(request) ||
		!isJsonContentType(request) ||
		!isWithinBodySizeLimit(request, DEFAULT_JSON_BODY_LIMIT_BYTES)
	) {
		return NextResponse.json(
			{ success: false, error: "Invalid request" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const repository = getUserPlanRepository();
	const identity = await getUserPlanIdentity(request);
	if (!repository || !identity) {
		return NextResponse.json(
			{ success: false, error: "Sign in to sync plans" },
			{ status: 401, headers: NO_STORE_HEADERS },
		);
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return NextResponse.json(
			{ success: false, error: "Invalid JSON" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const parsed = plansDeleteSchema.safeParse(payload);
	if (!parsed.success) {
		return NextResponse.json(
			{ success: false, error: "Invalid plan delete" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	try {
		await repository.deletePlan({
			ownerKey: identity.ownerKey,
			planId: parsed.data.planId,
		});
		return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
	} catch (error) {
		log.warn("plans.user", "Failed to delete user plan", {
			planId: parsed.data.planId,
			source: parsed.data.source,
			hasIdempotencyKey: Boolean(parsed.data.idempotencyKey),
			error: error instanceof Error ? error.message : "unknown",
		});
		return NextResponse.json(
			{ success: false, error: "Plan was not deleted" },
			{ status: 500, headers: NO_STORE_HEADERS },
		);
	}
}
