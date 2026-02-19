import { describe, expect, it } from "vitest";
import { normalizeProofLink } from "@/features/events/submissions/proof-link";

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
});
