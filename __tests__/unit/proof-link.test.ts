import {
	normalizeProofLink,
	normalizeProofLinks,
} from "@/features/events/submissions/proof-link";
import { describe, expect, it } from "vitest";

describe("proof link normalization", () => {
	it("adds https for scheme-less domains", () => {
		expect(normalizeProofLink("instagram.com/some-event")).toBe(
			"https://instagram.com/some-event",
		);
	});

	it("keeps valid http links", () => {
		expect(normalizeProofLink("http://example.com/event")).toBe(
			"http://example.com/event",
		);
	});

	it("rejects non-http protocols", () => {
		expect(normalizeProofLink("ftp://example.com/file")).toBeNull();
	});

	it("rejects non-url text", () => {
		expect(normalizeProofLink("this is not a link")).toBeNull();
	});

	it("normalizes multiple links split by newline, comma, or pipe", () => {
		expect(
			normalizeProofLinks(
				"tickets.example.com/one\nhttps://example.com/two | example.org/three",
			),
		).toEqual([
			"https://tickets.example.com/one",
			"https://example.com/two",
			"https://example.org/three",
		]);
	});

	it("rejects a multiple-link list when any entry is invalid", () => {
		expect(
			normalizeProofLinks("tickets.example.com/one | not a url"),
		).toBeNull();
	});
});
