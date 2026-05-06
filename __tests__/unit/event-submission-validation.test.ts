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
});
