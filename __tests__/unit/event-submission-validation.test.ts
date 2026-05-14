import { parseEventSubmissionInput } from "@/features/events/submissions/store";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

const validInput = {
	eventName: "Rooftop Session",
	date: "2026-06-21",
	startTime: "18:00",
	endTime: "23:00",
	location: "Paris",
	hostEmail: "host@example.com",
	proofLink: "instagram.com/proof-post",
	ticketLink: "tickets.example.com/event\nhttps://example.org/second",
	genre: "Afrobeats",
	price: "Free",
	arrondissement: "11",
	honeypot: "",
	formStartedAt: "2026-02-18T10:00:00.000Z",
};

const baselineUpdatePayload = {
	...validInput,
	proofLink: "https://instagram.com/proof-post",
	originalEventKey: "evt_123",
	submissionType: "event_update" as const,
	originalEventSnapshot: {
		eventName: "Rooftop Session",
		date: "2026-06-21",
		startTime: "18:00",
		endTime: "23:00",
		location: "Paris",
	},
};

describe("event submission validation", () => {
	it("normalizes HTTP URLs and trims core fields", () => {
		const parsed = parseEventSubmissionInput({
			...validInput,
			eventName: "  Rooftop   Session  ",
		});

		expect(parsed.eventName).toBe("Rooftop Session");
		expect(parsed.proofLink).toBe("https://instagram.com/proof-post");
		expect(parsed.ticketLink).toBe(
			"https://tickets.example.com/event\nhttps://example.org/second",
		);
	});

	it("rejects dirty URL values", () => {
		expect(() =>
			parseEventSubmissionInput({
				...validInput,
				proofLink: "not a url",
			}),
		).toThrow(ZodError);
		expect(() =>
			parseEventSubmissionInput({
				...validInput,
				ticketLink: "javascript:alert(1)",
			}),
		).toThrow(ZodError);
	});

	it("rejects invalid date, time, and arrondissement values", () => {
		expect(() =>
			parseEventSubmissionInput({ ...validInput, date: "21/06/2026" }),
		).toThrow(ZodError);
		expect(() =>
			parseEventSubmissionInput({ ...validInput, startTime: "25:00" }),
		).toThrow(ZodError);
		expect(() =>
			parseEventSubmissionInput({ ...validInput, arrondissement: "99" }),
		).toThrow(ZodError);
	});

	it("requires update requests to reference an original event key", () => {
		expect(() =>
			parseEventSubmissionInput({
				...validInput,
				submissionType: "event_update",
				originalEventKey: "",
			}),
		).toThrow(ZodError);
	});

	it("accepts partial update payloads and merges with the original snapshot", () => {
		const parsed = parseEventSubmissionInput({
			...baselineUpdatePayload,
			eventName: "  Rooftop Session: Reloaded ",
			ticketLink:
				"https://tickets.example.com/new-link\nhttps://example.org/queue",
		});

		expect(parsed.submissionType).toBe("event_update");
		expect(parsed.eventName).toBe("Rooftop Session: Reloaded");
		expect(parsed.location).toBe("Paris");
		expect(parsed.date).toBe("2026-06-21");
		expect(parsed.ticketLink).toBe(
			"https://tickets.example.com/new-link\nhttps://example.org/queue",
		);
		expect(parsed.originalEventSnapshot.eventName).toBe("Rooftop Session");
		expect(parsed.originalEventSnapshot.date).toBe("2026-06-21");
		expect(parsed.originalEventSnapshot.startTime).toBe("18:00");
		expect(parsed.originalEventSnapshot.location).toBe("Paris");
		expect(parsed.originalEventSnapshot.endTime).toBe("23:00");
		expect(parsed.originalEventSnapshot.ticketLink).toBeUndefined();
	});

	it("accepts price flags with optional reporter notes", () => {
		const parsed = parseEventSubmissionInput({
			submissionType: "price_flag",
			originalEventKey: "evt_free_123",
			originalEventName: "Free Block Party",
			originalEventUrl: "https://example.com/event/evt_free_123",
			originalEventSnapshot: {
				eventName: "Free Block Party",
				date: "2026-06-21",
				startTime: "16:00",
				location: "Paris",
				price: "Free",
				ticketLink: "https://tickets.example.com/free-block-party",
			},
			eventName: "Free Block Party",
			date: "2026-06-21",
			startTime: "16:00",
			location: "Paris",
			price: "Free",
			proofLink: "tickets.example.com/free-block-party",
			ticketLink: "tickets.example.com/free-block-party",
			reporterNote: "Ticket page now says €12.",
			formStartedAt: "2026-02-18T10:00:00.000Z",
		});

		expect(parsed.submissionType).toBe("price_flag");
		expect(parsed.hostEmail).toBe("price-flag@outofofficecollective.co.uk");
		expect(parsed.proofLink).toBe(
			"https://tickets.example.com/free-block-party",
		);
		expect(parsed.ticketLink).toBe(
			"https://tickets.example.com/free-block-party",
		);
		expect(parsed.reporterNote).toBe("Ticket page now says €12.");
		expect(parsed.originalEventSnapshot.price).toBe("Free");
	});

	it("rejects updates when no changed event fields are provided", () => {
		expect(() =>
			parseEventSubmissionInput({
				submissionType: "event_update",
				originalEventKey: "evt_123",
				originalEventSnapshot: {
					eventName: "Rooftop Session",
					date: "2026-06-21",
					startTime: "18:00",
					endTime: "23:00",
					location: "Paris",
				},
				hostEmail: "host@example.com",
				proofLink: "https://instagram.com/proof-post",
			}),
		).toThrow(ZodError);
	});

	it("rejects update payloads when required merge fields are missing from both payload and snapshot", () => {
		expect(() =>
			parseEventSubmissionInput({
				submissionType: "event_update",
				originalEventKey: "evt_123",
				originalEventSnapshot: {},
				eventName: "Rooftop Session",
				proofLink: "https://instagram.com/proof-post",
				hostEmail: "host@example.com",
			}),
		).toThrow(ZodError);
	});
});
