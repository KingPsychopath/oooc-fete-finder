import {
	EVENT_ENGAGEMENT_ACTIONS,
	type EventEngagementAction,
} from "@/features/events/engagement/types";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { log } from "@/lib/platform/logger";
import { getEventEngagementRepository } from "@/lib/platform/postgres/event-engagement-repository";
import { NextResponse } from "next/server";
import { z } from "zod";

const trackPayloadSchema = z.object({
	eventKey: z.string().trim().min(1).max(220),
	actionType: z.enum(EVENT_ENGAGEMENT_ACTIONS),
	sessionId: z.string().trim().max(120).optional(),
	source: z.string().trim().max(80).optional(),
	path: z.string().trim().max(280).optional(),
	isAuthenticated: z.boolean().optional(),
});

export const runtime = "nodejs";

const accepted = () =>
	NextResponse.json(
		{ success: true },
		{ status: 202, headers: NO_STORE_HEADERS },
	);

export async function POST(request: Request) {
	const repository = getEventEngagementRepository();
	if (!repository) {
		return accepted();
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return accepted();
	}

	const parsed = trackPayloadSchema.safeParse(payload);
	if (!parsed.success) {
		return accepted();
	}

	const body = parsed.data;
	try {
		await repository.recordEventAction({
			eventKey: body.eventKey,
			actionType: body.actionType as EventEngagementAction,
			sessionId: body.sessionId ?? null,
			source: body.source ?? null,
			path: body.path ?? null,
			isAuthenticated: body.isAuthenticated ?? null,
		});
	} catch (error) {
		log.warn("events.track", "Failed to record event engagement", {
			eventKey: body.eventKey,
			actionType: body.actionType,
			error: error instanceof Error ? error.message : "unknown",
		});
	}

	return accepted();
}
