import { isValidUserId } from "@/features/auth/user-id";
import {
	USER_AUTH_COOKIE_NAME,
	getCanonicalUserSessionFromCookieHeader,
} from "@/features/auth/user-session-cookie";
import { getUserActionPolicyDecision } from "@/features/users/policy";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import {
	DEFAULT_JSON_BODY_LIMIT_BYTES,
	acceptedNoStoreResponse,
	isJsonContentType,
	isSameOriginRequest,
	isWithinBodySizeLimit,
} from "@/lib/http/request-security";
import { log } from "@/lib/platform/logger";
import { getAppKVStoreRepository } from "@/lib/platform/postgres/app-kv-store-repository";
import {
	type LocalAppSettings,
	type SyncedUserAppSettings,
	normalizeLocalAppSettings,
	normalizeMapPreference,
	normalizeThemeMode,
} from "@/lib/user-app-settings";
import { NextResponse } from "next/server";
import { z } from "zod";

const appSettingsSchema = z.object({
	appSettings: z.object({
		hideFloatingFilterButton: z.boolean().optional(),
		hideFloatingPrompts: z.boolean().optional(),
		enableHaptics: z.boolean().optional(),
		defaultEventSortMode: z.enum(["upcoming", "fresh-activity"]).optional(),
		mapLoadStrategy: z.enum(["idle", "expand"]).optional(),
	}),
	mapPreference: z.enum(["system", "google", "apple", "ask"]),
	themeMode: z.enum(["system", "light", "dark"]),
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
		if (rawKey === name) {
			return rawValueParts.join("=");
		}
	}
	return undefined;
};

const getUserSettingsIdentity = async (
	request: Request,
): Promise<{ key: string; userId: string; email: string | null } | null> => {
	const cookieHeader = request.headers.get("cookie");
	const userCookie = parseCookieByName(cookieHeader, USER_AUTH_COOKIE_NAME);
	const userSession = await getCanonicalUserSessionFromCookieHeader(userCookie);
	if (!userSession.isAuthenticated) return null;
	if (!userSession.userId || !isValidUserId(userSession.userId)) return null;
	return {
		key: `user-app-settings:${userSession.userId}`,
		userId: userSession.userId,
		email: userSession.email,
	};
};

const normalizeSyncedSettings = (
	value:
		| (Partial<Omit<SyncedUserAppSettings, "appSettings">> & {
				appSettings?: Partial<LocalAppSettings> | null;
		  })
		| null
		| undefined,
): SyncedUserAppSettings => ({
	appSettings: normalizeLocalAppSettings(value?.appSettings),
	mapPreference: normalizeMapPreference(value?.mapPreference),
	themeMode: normalizeThemeMode(value?.themeMode),
	updatedAt: typeof value?.updatedAt === "string" ? value.updatedAt : undefined,
});

export async function GET(request: Request) {
	const repository = getAppKVStoreRepository();
	const identity = await getUserSettingsIdentity(request);
	if (!repository || !identity) {
		return NextResponse.json(
			{ success: true, settings: null },
			{ headers: NO_STORE_HEADERS },
		);
	}

	try {
		const record = await repository.getRecord(identity.key);
		if (!record) {
			return NextResponse.json(
				{ success: true, settings: null },
				{ headers: NO_STORE_HEADERS },
			);
		}

		const parsed = JSON.parse(record.value) as Partial<SyncedUserAppSettings>;
		const settings = normalizeSyncedSettings({
			...parsed,
			updatedAt: record.updatedAt,
		});
		return NextResponse.json(
			{ success: true, settings },
			{ headers: NO_STORE_HEADERS },
		);
	} catch (error) {
		log.warn("user.app-settings", "Failed to read app settings", {
			error: error instanceof Error ? error.message : "unknown",
		});
		return NextResponse.json(
			{ success: true, settings: null },
			{ headers: NO_STORE_HEADERS },
		);
	}
}

export async function POST(request: Request) {
	if (!isSameOriginRequest(request)) {
		return acceptedNoStoreResponse();
	}
	if (!isJsonContentType(request)) {
		return acceptedNoStoreResponse();
	}
	if (!isWithinBodySizeLimit(request, DEFAULT_JSON_BODY_LIMIT_BYTES)) {
		return acceptedNoStoreResponse();
	}

	const repository = getAppKVStoreRepository();
	const identity = await getUserSettingsIdentity(request);
	if (!repository || !identity) {
		return NextResponse.json(
			{ success: true },
			{ status: 202, headers: NO_STORE_HEADERS },
		);
	}
	const policyDecision = await getUserActionPolicyDecision({
		userId: identity.userId,
		email: identity.email,
		scope: "app_settings.sync",
	});
	if (!policyDecision.allowed) {
		return NextResponse.json(
			{ success: true },
			{ status: 202, headers: NO_STORE_HEADERS },
		);
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return acceptedNoStoreResponse();
	}

	const parsed = appSettingsSchema.safeParse(payload);
	if (!parsed.success) {
		return acceptedNoStoreResponse();
	}

	try {
		const settings = normalizeSyncedSettings(parsed.data);
		await repository.upsertValue(identity.key, JSON.stringify(settings));
	} catch (error) {
		log.warn("user.app-settings", "Failed to save app settings", {
			error: error instanceof Error ? error.message : "unknown",
		});
	}

	return NextResponse.json(
		{ success: true },
		{ status: 202, headers: NO_STORE_HEADERS },
	);
}
