import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
	try {
		const { email, consent } = await request.json();

		// Basic email validation
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!email || !emailRegex.test(email)) {
			return NextResponse.json(
				{ error: "Invalid email address" },
				{ status: 400 },
			);
		}

		// Check consent
		if (!consent) {
			return NextResponse.json(
				{ error: "Consent is required" },
				{ status: 400 },
			);
		}

		// Here you would typically:
		// 1. Store the email in your database with consent timestamp
		// 2. Send a welcome email
		// 3. Add to mailing list
		// 4. Log the authentication event with GDPR compliance

		// For now, we'll log with consent info
		console.log("User authenticated:", {
			email,
			consent,
			timestamp: new Date().toISOString(),
			ip: request.headers.get("x-forwarded-for") || "unknown",
		});

		// You could store in a database like this:
		// await storeEmailWithConsent({
		//   email,
		//   consentGiven: true,
		//   consentTimestamp: new Date(),
		//   ipAddress: request.headers.get('x-forwarded-for'),
		//   source: 'fete-finder-auth'
		// });

		return NextResponse.json(
			{
				success: true,
				message: "Email collected with consent",
				timestamp: new Date().toISOString(),
			},
			{ status: 200 },
		);
	} catch (error) {
		console.error("Error processing email:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
