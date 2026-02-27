import {
	handleStripeWebhookPayload,
	verifyStripeWebhookSignature,
} from "@/features/partners/stripe-webhook";
import { env } from "@/lib/config/env";
import { log } from "@/lib/platform/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
	const webhookSecret = env.STRIPE_WEBHOOK_SECRET?.trim();
	if (!webhookSecret) {
		log.warn(
			"partners",
			"Stripe webhook called but STRIPE_WEBHOOK_SECRET is not configured",
		);
		return Response.json({ error: "Webhook not configured" }, { status: 503 });
	}

	const payload = await request.text();
	const signatureHeader = request.headers.get("stripe-signature");
	const isValid = verifyStripeWebhookSignature({
		payload,
		signatureHeader,
		secret: webhookSecret,
	});

	if (!isValid) {
		log.warn("partners", "Stripe webhook signature verification failed");
		return Response.json({ error: "Invalid signature" }, { status: 400 });
	}

	try {
		const result = await handleStripeWebhookPayload(payload);
		return Response.json(
			{
				ok: true,
				handled: result.handled,
				inserted: result.inserted ?? false,
			},
			{ status: 200 },
		);
	} catch (error) {
		log.error("partners", "Failed to process Stripe webhook", undefined, error);
		return Response.json(
			{ error: "Webhook processing failed" },
			{ status: 500 },
		);
	}
}
