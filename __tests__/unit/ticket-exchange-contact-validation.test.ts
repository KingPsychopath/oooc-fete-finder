import {
	normalizeInstagramHandle,
	normalizeOptionalEmail,
	normalizeWhatsAppNumber,
	normalizeXHandle,
} from "@/features/ticket-exchange/utils";
import { describe, expect, it } from "vitest";

describe("ticket exchange contact validation", () => {
	it("normalizes optional email overrides", () => {
		expect(normalizeOptionalEmail("  ALEX@Example.COM ")).toBe(
			"alex@example.com",
		);
		expect(normalizeOptionalEmail("")).toBe("");
		expect(() => normalizeOptionalEmail("not an email")).toThrow(
			"Enter a valid email address.",
		);
	});

	it("requires WhatsApp numbers with a valid country code", () => {
		expect(normalizeWhatsAppNumber(" +44 7123 456789 ")).toBe("+447123456789");
		expect(normalizeWhatsAppNumber("")).toBe("");
		expect(() => normalizeWhatsAppNumber("07123 456789")).toThrow(
			"Enter a valid WhatsApp number with country code.",
		);
	});

	it("normalizes and validates Instagram handles only", () => {
		expect(normalizeInstagramHandle("@melanyamene")).toBe("melanyamene");
		expect(normalizeInstagramHandle("")).toBe("");
		expect(() => normalizeInstagramHandle("instagram.com/melanyamene")).toThrow(
			"Enter a valid Instagram handle.",
		);
		expect(() => normalizeInstagramHandle("bad..handle")).toThrow(
			"Enter a valid Instagram handle.",
		);
	});

	it("normalizes and validates Twitter handles only", () => {
		expect(normalizeXHandle("@oooc_fete")).toBe("oooc_fete");
		expect(normalizeXHandle("")).toBe("");
		expect(() => normalizeXHandle("x.com/oooc_fete")).toThrow(
			"Enter a valid Twitter handle.",
		);
		expect(() => normalizeXHandle("this_handle_is_way_too_long")).toThrow(
			"Enter a valid Twitter handle.",
		);
	});
});
