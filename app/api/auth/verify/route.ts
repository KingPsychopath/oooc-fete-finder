import { UserCollectionStore } from "@/features/auth/user-collection-store";
import {
	USER_AUTH_COOKIE_NAME,
	getUserAuthCookieOptions,
	signUserSessionToken,
} from "@/features/auth/user-session-cookie";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { log } from "@/lib/platform/logger";
import { NextResponse } from "next/server";

type VerifyBody = {
	firstName?: string;
	lastName?: string;
	email?: string;
	consent?: boolean;
	source?: string;
};

const isValidEmail = (email: string): boolean => {
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return emailRegex.test(email);
};

export async function POST(request: Request) {
	let body: VerifyBody;
	try {
		body = (await request.json()) as VerifyBody;
	} catch {
		return NextResponse.json(
			{ success: false, error: "Invalid request payload" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const firstName = body.firstName?.trim() || "";
	const lastName = body.lastName?.trim() || "";
	const email = body.email?.trim().toLowerCase() || "";
	const consent = Boolean(body.consent);

	if (firstName.length < 2) {
		return NextResponse.json(
			{ success: false, error: "First name must be at least 2 characters" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}
	if (lastName.length < 2) {
		return NextResponse.json(
			{ success: false, error: "Last name must be at least 2 characters" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}
	if (!isValidEmail(email)) {
		return NextResponse.json(
			{ success: false, error: "Valid email address is required" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}
	if (!consent) {
		return NextResponse.json(
			{ success: false, error: "Consent is required" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	try {
		const user = {
			firstName,
			lastName,
			email,
			consent: true,
			source: body.source?.trim() || "fete-finder-auth",
			timestamp: new Date().toISOString(),
		};

		const storeResult = await UserCollectionStore.addOrUpdate(user);
		const storeStatus = await UserCollectionStore.getStatus();

		const response = NextResponse.json(
			{
				success: true,
				email,
				storedIn: storeStatus.provider,
				message: storeResult.alreadyExisted
					? "Existing user verified"
					: "User verified",
			},
			{ headers: NO_STORE_HEADERS },
		);
		response.cookies.set(
			USER_AUTH_COOKIE_NAME,
			signUserSessionToken(email),
			getUserAuthCookieOptions(),
		);
		return response;
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unexpected verify error";
		log.error("auth-verify", "Failed to verify user", { message }, error);
		return NextResponse.json(
			{
				success: false,
				error: "Verification failed. Please try again.",
			},
			{ status: 500, headers: NO_STORE_HEADERS },
		);
	}
}
