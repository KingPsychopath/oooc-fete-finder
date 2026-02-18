import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

type Setup = {
	POST: typeof import("@/app/api/event-submissions/route").POST;
	checkEventSubmitIpLimit: ReturnType<typeof vi.fn>;
	checkEventSubmitEmailIpLimit: ReturnType<typeof vi.fn>;
	checkEventSubmitFingerprintLimit: ReturnType<typeof vi.fn>;
	parseEventSubmissionInput: ReturnType<typeof vi.fn>;
	buildEventSubmissionFingerprint: ReturnType<typeof vi.fn>;
	evaluateSubmissionSpamSignals: ReturnType<typeof vi.fn>;
	createEventSubmission: ReturnType<typeof vi.fn>;
};

const validBody = {
	eventName: "Rooftop Session",
	date: "2026-06-21",
	startTime: "18:00",
	location: "Paris",
	hostEmail: "host@example.com",
	proofLink: "https://example.com/event",
	honeypot: "",
	formStartedAt: "2026-02-18T10:00:00.000Z",
};

const normalizedInput = {
	eventName: "Rooftop Session",
	date: "2026-06-21",
	startTime: "18:00",
	location: "Paris",
	hostEmail: "host@example.com",
	proofLink: "https://example.com/event",
	endTime: "",
	genre: "",
	price: "",
	age: "",
	indoorOutdoor: "",
	notes: "",
	arrondissement: "",
	honeypot: "",
	formStartedAt: "2026-02-18T10:00:00.000Z",
};

const loadRoute = async (): Promise<Setup> => {
	vi.resetModules();

	const checkEventSubmitIpLimit = vi.fn().mockResolvedValue({
		allowed: true,
		retryAfterSeconds: null,
		reason: "ok",
		scope: "event_submit_ip",
		keyHash: "hashed-ip",
	});
	const checkEventSubmitEmailIpLimit = vi.fn().mockResolvedValue({
		allowed: true,
		retryAfterSeconds: null,
		reason: "ok",
		scope: "event_submit_email_ip",
		keyHash: "hashed-email-ip",
	});
	const checkEventSubmitFingerprintLimit = vi.fn().mockResolvedValue({
		allowed: true,
		retryAfterSeconds: null,
		reason: "ok",
		scope: "event_submit_fingerprint",
		keyHash: "hashed-fingerprint",
	});
	const parseEventSubmissionInput = vi.fn().mockReturnValue(normalizedInput);
	const buildEventSubmissionFingerprint = vi.fn().mockReturnValue("fingerprint");
	const evaluateSubmissionSpamSignals = vi.fn().mockReturnValue({
		honeypotFilled: false,
		completedTooFast: false,
		completionSeconds: 12,
		reasons: [],
	});
	const createEventSubmission = vi.fn().mockResolvedValue({ id: "sub_1" });

	vi.doMock("@/features/security/rate-limiter", () => ({
		extractClientIpFromHeaders: () => "203.0.113.1",
		checkEventSubmitIpLimit,
		checkEventSubmitEmailIpLimit,
		checkEventSubmitFingerprintLimit,
	}));

	vi.doMock("@/features/events/submissions/store", () => ({
		parseEventSubmissionInput,
		buildEventSubmissionFingerprint,
		evaluateSubmissionSpamSignals,
		createEventSubmission,
	}));

	const route = await import("@/app/api/event-submissions/route");
	return {
		POST: route.POST,
		checkEventSubmitIpLimit,
		checkEventSubmitEmailIpLimit,
		checkEventSubmitFingerprintLimit,
		parseEventSubmissionInput,
		buildEventSubmissionFingerprint,
		evaluateSubmissionSpamSignals,
		createEventSubmission,
	};
};

describe("/api/event-submissions route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("accepts valid minimal payload", async () => {
		const { POST, createEventSubmission } = await loadRoute();
		const response = await POST(
			new Request("https://example.com/api/event-submissions", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(validBody),
			}),
		);
		const payload = (await response.json()) as { success: boolean; message: string };

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.message).toContain("received");
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(createEventSubmission).toHaveBeenCalledTimes(1);
	});

	it("returns 400 for invalid payload", async () => {
		const { POST, parseEventSubmissionInput, createEventSubmission } =
			await loadRoute();
		parseEventSubmissionInput.mockImplementation(() => {
			throw new ZodError([
				{
					code: "custom",
					path: ["eventName"],
					message: "Invalid event name",
				},
			]);
		});

		const response = await POST(
			new Request("https://example.com/api/event-submissions", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({}),
			}),
		);
		expect(response.status).toBe(400);
		expect(createEventSubmission).not.toHaveBeenCalled();
	});

	it("returns 429 when IP rate limit is exceeded", async () => {
		const { POST, checkEventSubmitIpLimit, createEventSubmission } = await loadRoute();
		checkEventSubmitIpLimit.mockResolvedValue({
			allowed: false,
			retryAfterSeconds: 37,
			reason: "ip_limit",
			scope: "event_submit_ip",
			keyHash: "hashed-ip",
		});

		const response = await POST(
			new Request("https://example.com/api/event-submissions", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(validBody),
			}),
		);

		expect(response.status).toBe(429);
		expect(response.headers.get("retry-after")).toBe("37");
		expect(createEventSubmission).not.toHaveBeenCalled();
	});

	it("returns 429 when email+IP rate limit is exceeded", async () => {
		const { POST, checkEventSubmitEmailIpLimit, createEventSubmission } =
			await loadRoute();
		checkEventSubmitEmailIpLimit.mockResolvedValue({
			allowed: false,
			retryAfterSeconds: 61,
			reason: "email_ip_limit",
			scope: "event_submit_email_ip",
			keyHash: "hashed-email-ip",
		});

		const response = await POST(
			new Request("https://example.com/api/event-submissions", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(validBody),
			}),
		);

		expect(response.status).toBe(429);
		expect(response.headers.get("retry-after")).toBe("61");
		expect(createEventSubmission).not.toHaveBeenCalled();
	});

	it("returns 429 when fingerprint cooldown limit is exceeded", async () => {
		const { POST, checkEventSubmitFingerprintLimit, createEventSubmission } =
			await loadRoute();
		checkEventSubmitFingerprintLimit.mockResolvedValue({
			allowed: false,
			retryAfterSeconds: 3600,
			reason: "fingerprint_limit",
			scope: "event_submit_fingerprint",
			keyHash: "hashed-fingerprint",
		});

		const response = await POST(
			new Request("https://example.com/api/event-submissions", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(validBody),
			}),
		);

		expect(response.status).toBe(429);
		expect(response.headers.get("retry-after")).toBe("3600");
		expect(createEventSubmission).not.toHaveBeenCalled();
	});

	it("stores spam-signal submissions and still returns generic success", async () => {
		const { POST, evaluateSubmissionSpamSignals, createEventSubmission } =
			await loadRoute();
		evaluateSubmissionSpamSignals.mockReturnValue({
			honeypotFilled: true,
			completedTooFast: true,
			completionSeconds: 1,
			reasons: ["honeypot_filled", "completed_too_fast"],
		});

		const response = await POST(
			new Request("https://example.com/api/event-submissions", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(validBody),
			}),
		);
		const payload = (await response.json()) as { success: boolean; message: string };

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.message).toContain("received");
		expect(createEventSubmission).toHaveBeenCalledWith(
			expect.objectContaining({
				spamSignals: expect.objectContaining({
					reasons: ["honeypot_filled", "completed_too_fast"],
				}),
			}),
		);
	});
});
