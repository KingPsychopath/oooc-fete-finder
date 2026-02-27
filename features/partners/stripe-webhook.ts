import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/config/env";
import { log } from "@/lib/platform/logger";
import { getPartnerActivationRepository } from "@/lib/platform/postgres/partner-activation-repository";

type StripeWebhookEnvelope = {
	id?: string;
	type?: string;
	data?: {
		object?: Record<string, unknown>;
	};
};

type StripeCustomField = {
	key?: string;
	text?: { value?: string };
	dropdown?: { value?: string };
	numeric?: { value?: string };
};

const WEBHOOK_TOLERANCE_SECONDS = 300;

const parseStripeSignature = (
	signatureHeader: string,
): { timestamp: number; signatures: string[] } | null => {
	const segments = signatureHeader.split(",").map((segment) => segment.trim());
	const timestampSegment = segments.find((segment) => segment.startsWith("t="));
	const signatureSegments = segments.filter((segment) =>
		segment.startsWith("v1="),
	);
	if (!timestampSegment || signatureSegments.length === 0) return null;
	const timestamp = Number(timestampSegment.slice(2));
	if (!Number.isFinite(timestamp)) return null;
	return {
		timestamp,
		signatures: signatureSegments.map((segment) => segment.slice(3)),
	};
};

const secureCompareHex = (leftHex: string, rightHex: string): boolean => {
	try {
		const left = Buffer.from(leftHex, "hex");
		const right = Buffer.from(rightHex, "hex");
		if (left.length !== right.length) return false;
		return timingSafeEqual(left, right);
	} catch {
		return false;
	}
};

export const verifyStripeWebhookSignature = (input: {
	payload: string;
	signatureHeader: string | null;
	secret: string | null | undefined;
	nowMs?: number;
}): boolean => {
	const secret = input.secret?.trim();
	if (!secret || !input.signatureHeader) return false;
	const parsed = parseStripeSignature(input.signatureHeader);
	if (!parsed) return false;

	const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
	if (Math.abs(nowSeconds - parsed.timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
		return false;
	}

	const signedPayload = `${parsed.timestamp}.${input.payload}`;
	const expected = createHmac("sha256", secret)
		.update(signedPayload, "utf8")
		.digest("hex");

	return parsed.signatures.some((signature) =>
		secureCompareHex(expected, signature),
	);
};

const normalizeString = (value: unknown): string | null => {
	if (typeof value !== "string") return null;
	const normalized = value.trim();
	return normalized.length > 0 ? normalized : null;
};

const getObjectValue = (
	record: Record<string, unknown>,
	key: string,
): unknown =>
	Object.prototype.hasOwnProperty.call(record, key) ? record[key] : undefined;

const extractPaymentLinkId = (
	session: Record<string, unknown>,
): string | null => {
	const paymentLink = normalizeString(getObjectValue(session, "payment_link"));
	if (!paymentLink) return null;
	const parts = paymentLink.split("/");
	return parts[parts.length - 1] || paymentLink;
};

const extractCustomFieldValue = (
	customFields: StripeCustomField[],
	keys: string[],
): string | null => {
	const wantedKeys = new Set(keys.map((key) => key.toLowerCase()));
	for (const field of customFields) {
		const fieldKey = field.key?.toLowerCase();
		if (!fieldKey || !wantedKeys.has(fieldKey)) continue;
		const fromText = normalizeString(field.text?.value);
		if (fromText) return fromText;
		const fromDropdown = normalizeString(field.dropdown?.value);
		if (fromDropdown) return fromDropdown;
		const fromNumeric = normalizeString(field.numeric?.value);
		if (fromNumeric) return fromNumeric;
	}
	return null;
};

const mapPackageKeyFromPaymentLink = (
	paymentLinkId: string | null,
): string | null => {
	if (!paymentLinkId) return null;
	const map = new Map<string, string>([
		[
			env.STRIPE_PAYMENT_LINK_ID_SPOTLIGHT_STANDARD?.trim() || "",
			"spotlight-standard",
		],
		[
			env.STRIPE_PAYMENT_LINK_ID_SPOTLIGHT_TAKEOVER?.trim() || "",
			"spotlight-takeover",
		],
		[env.STRIPE_PAYMENT_LINK_ID_PROMOTED?.trim() || "", "promoted-listing"],
		[env.STRIPE_PAYMENT_LINK_ID_ADDON_WHATSAPP?.trim() || "", "addon-whatsapp"],
		[
			env.STRIPE_PAYMENT_LINK_ID_ADDON_NEWSLETTER?.trim() || "",
			"addon-newsletter",
		],
	]);
	const value = map.get(paymentLinkId);
	return value || null;
};

const extractSessionMetadata = (
	session: Record<string, unknown>,
): Record<string, unknown> => {
	const metadata = getObjectValue(session, "metadata");
	if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
		return {};
	}
	return metadata as Record<string, unknown>;
};

const extractSessionDetails = (session: Record<string, unknown>) => {
	const metadata = extractSessionMetadata(session);
	const customFieldsValue = getObjectValue(session, "custom_fields");
	const customFields = Array.isArray(customFieldsValue)
		? (customFieldsValue as StripeCustomField[])
		: [];

	const paymentLinkId = extractPaymentLinkId(session);
	const packageKeyFromMetadata = normalizeString(metadata.package_key);
	const packageKey =
		packageKeyFromMetadata || mapPackageKeyFromPaymentLink(paymentLinkId);
	const eventName =
		extractCustomFieldValue(customFields, ["event_name", "eventname"]) ||
		normalizeString(metadata.event_name);
	const eventUrl =
		extractCustomFieldValue(customFields, [
			"event_url",
			"event_link",
			"ticket_link",
			"eventurl",
		]) || normalizeString(metadata.event_url);
	const customerEmail = normalizeString(
		getObjectValue(session, "customer_email"),
	);
	const customerDetails = getObjectValue(session, "customer_details");
	const customerName =
		(customerDetails &&
		typeof customerDetails === "object" &&
		!Array.isArray(customerDetails)
			? normalizeString((customerDetails as Record<string, unknown>).name)
			: null) || normalizeString(getObjectValue(session, "customer_name"));
	const amountTotalRaw = getObjectValue(session, "amount_total");
	const amountTotalCents =
		typeof amountTotalRaw === "number" && Number.isFinite(amountTotalRaw)
			? Math.round(amountTotalRaw)
			: null;
	const currency = normalizeString(getObjectValue(session, "currency"));
	const stripeSessionId = normalizeString(getObjectValue(session, "id"));

	return {
		packageKey,
		paymentLinkId,
		customerEmail,
		customerName,
		eventName,
		eventUrl,
		amountTotalCents,
		currency,
		stripeSessionId,
		metadata,
	};
};

export const ingestStripeCheckoutCompleted = async (event: {
	id: string;
	object: Record<string, unknown>;
}): Promise<{ inserted: boolean }> => {
	const repository = getPartnerActivationRepository();
	if (!repository) {
		throw new Error("Postgres not configured");
	}
	const session = event.object;
	const details = extractSessionDetails(session);

	const result = await repository.enqueueFromStripe({
		sourceEventId: event.id,
		packageKey: details.packageKey,
		paymentLinkId: details.paymentLinkId,
		stripeSessionId: details.stripeSessionId,
		customerEmail: details.customerEmail,
		customerName: details.customerName,
		eventName: details.eventName,
		eventUrl: details.eventUrl,
		amountTotalCents: details.amountTotalCents,
		currency: details.currency,
		metadata: details.metadata,
		rawPayload: {
			type: "checkout.session.completed",
			session,
		},
	});

	return { inserted: result.inserted };
};

export const handleStripeWebhookPayload = async (
	payload: string,
): Promise<{ handled: boolean; inserted?: boolean }> => {
	const parsed = JSON.parse(payload) as StripeWebhookEnvelope;
	const type = normalizeString(parsed.type);
	const eventId = normalizeString(parsed.id);
	const object = parsed.data?.object;
	if (!type || !eventId || !object || typeof object !== "object") {
		return { handled: false };
	}

	if (type !== "checkout.session.completed") {
		return { handled: true, inserted: false };
	}

	const inserted = await ingestStripeCheckoutCompleted({
		id: eventId,
		object: object as Record<string, unknown>,
	});

	log.info("partners", "Stripe checkout session ingested", {
		eventId,
		inserted: inserted.inserted,
	});

	return { handled: true, inserted: inserted.inserted };
};
