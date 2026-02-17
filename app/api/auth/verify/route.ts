import { env } from "@/lib/config/env";
import { UserCollectionStore } from "@/lib/user-management/user-collection-store";
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
			{ status: 400 },
		);
	}

	const firstName = body.firstName?.trim() || "";
	const lastName = body.lastName?.trim() || "";
	const email = body.email?.trim().toLowerCase() || "";
	const consent = Boolean(body.consent);

	if (firstName.length < 2) {
		return NextResponse.json(
			{ success: false, error: "First name must be at least 2 characters" },
			{ status: 400 },
		);
	}
	if (lastName.length < 2) {
		return NextResponse.json(
			{ success: false, error: "Last name must be at least 2 characters" },
			{ status: 400 },
		);
	}
	if (!isValidEmail(email)) {
		return NextResponse.json(
			{ success: false, error: "Valid email address is required" },
			{ status: 400 },
		);
	}
	if (!consent) {
		return NextResponse.json(
			{ success: false, error: "Consent is required" },
			{ status: 400 },
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

		const shouldMirrorToGoogle = Boolean(
			env.GOOGLE_MIRROR_WRITES && env.GOOGLE_SHEETS_URL,
		);
		let mirrorWarning: string | null = null;

		if (shouldMirrorToGoogle && env.GOOGLE_SHEETS_URL) {
			try {
				const mirrorResponse = await fetch(env.GOOGLE_SHEETS_URL, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(user),
					signal: AbortSignal.timeout(10000),
				});
				if (!mirrorResponse.ok) {
					mirrorWarning =
						`Google mirror failed: ${mirrorResponse.status} ${mirrorResponse.statusText}`;
				}
			} catch (mirrorError) {
				mirrorWarning =
					mirrorError instanceof Error
						? `Google mirror failed: ${mirrorError.message}`
						: "Google mirror failed";
			}
		}

		return NextResponse.json({
			success: true,
			email,
			storedIn: storeStatus.provider,
			message:
				storeResult.alreadyExisted
					? "Existing user verified"
					: "User verified",
			mirrorWarning,
		});
	} catch (error) {
		const message =
			error instanceof Error ? error.message : "Unexpected verify error";
		console.error("Failed to verify user:", message);
		return NextResponse.json(
			{
				success: false,
				error: "Verification failed. Please try again.",
			},
			{ status: 500 },
		);
	}
}
