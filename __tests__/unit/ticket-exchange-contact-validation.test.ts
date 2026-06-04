import {
	TICKET_EXCHANGE_NOTE_LANGUAGE_ERROR,
	createTicketExchangeLanguageError,
	hasOffensiveTicketExchangeNoteLanguage,
	normalizeInstagramHandle,
	normalizeOptionalEmail,
	normalizeWhatsAppNumber,
	normalizeXHandle,
	validateTicketExchangeNote,
	validateTicketExchangePriceLabel,
	validateTicketExchangeUserText,
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

	it("allows normal Ticket Exchange notes", () => {
		expect(
			validateTicketExchangeNote("  Can transfer via Dice after payment  "),
		).toBe("Can transfer via Dice after payment");
		expect(validateTicketExchangeNote("")).toBe("");
	});

	it("rejects offensive Ticket Exchange note language", () => {
		expect(
			hasOffensiveTicketExchangeNoteLanguage("no f u c k i n g timewasters"),
		).toBe(true);
		expect(hasOffensiveTicketExchangeNoteLanguage("I'll suck your dick")).toBe(
			true,
		);
		expect(hasOffensiveTicketExchangeNoteLanguage("heil hitler")).toBe(true);
		expect(() => validateTicketExchangeNote("no sh1t offers")).toThrow(
			TICKET_EXCHANGE_NOTE_LANGUAGE_ERROR,
		);
	});

	it("rejects offensive language in visible free-text fields", () => {
		expect(
			validateTicketExchangeUserText("  2 tickets available  ", 80, "quantity"),
		).toBe("2 tickets available");
		expect(() =>
			validateTicketExchangeUserText("sh1t budget", 80, "the price or budget"),
		).toThrow(createTicketExchangeLanguageError("the price or budget"));
	});

	it("requires a numeric or face-value ticket price or budget", () => {
		expect(validateTicketExchangePriceLabel("  £35 each  ")).toBe("£35 each");
		expect(validateTicketExchangePriceLabel("75€")).toBe("75€");
		expect(validateTicketExchangePriceLabel("GBP 40")).toBe("GBP 40");
		expect(validateTicketExchangePriceLabel("35 / face value")).toBe(
			"35 / face value",
		);
		expect(validateTicketExchangePriceLabel("FV")).toBe("FV");

		expect(() => validateTicketExchangePriceLabel("")).toThrow(
			"Add the ticket price or budget before posting.",
		);
		expect(() => validateTicketExchangePriceLabel("DM me")).toThrow(
			"Use a number, FV, or face value for the ticket price or budget.",
		);
		expect(() => validateTicketExchangePriceLabel("cheap")).toThrow(
			"Use a number, FV, or face value for the ticket price or budget.",
		);
	});

	it("keeps social handles on format validation only", () => {
		expect(normalizeInstagramHandle("@nazi")).toBe("nazi");
		expect(normalizeXHandle("@nazi")).toBe("nazi");
	});
});
