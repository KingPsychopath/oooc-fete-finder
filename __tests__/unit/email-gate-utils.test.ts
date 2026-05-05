import {
	buildSuggestedEmail,
	normalizeEmailInput,
	sanitizePastedEmail,
	sanitizeRecentProfile,
	validateEmail,
} from "@/features/auth/email-gate-utils";
import { describe, expect, it } from "vitest";

describe("email gate utilities", () => {
	describe("buildSuggestedEmail", () => {
		it("suggests common consumer email domain typos", () => {
			expect(buildSuggestedEmail("123test@gmail.con")).toBe(
				"123test@gmail.com",
			);
			expect(buildSuggestedEmail("person@gnail.com")).toBe("person@gmail.com");
			expect(buildSuggestedEmail("person@hotnail.com")).toBe(
				"person@hotmail.com",
			);
		});

		it("normalizes casing and spaces before suggesting", () => {
			expect(buildSuggestedEmail(" Person @ GMAIL.CON ")).toBe(
				"person@gmail.com",
			);
		});

		it("does not suggest when the domain is already common", () => {
			expect(buildSuggestedEmail("person@gmail.com")).toBe(null);
		});

		it("does not suggest for business-like domains that are not obvious consumer typos", () => {
			expect(buildSuggestedEmail("person@company.co.uk")).toBe(null);
			expect(buildSuggestedEmail("person@events-paris.com")).toBe(null);
			expect(buildSuggestedEmail("person@sub.company.com")).toBe(null);
		});

		it("does not suggest for malformed or incomplete email values", () => {
			expect(buildSuggestedEmail("person")).toBe(null);
			expect(buildSuggestedEmail("@gmail.con")).toBe(null);
			expect(buildSuggestedEmail("person@gmail")).toBe(null);
		});
	});

	it("normalizes typed email whitespace around the at sign", () => {
		expect(normalizeEmailInput("  person @ gmail.com  ")).toBe(
			"person@gmail.com",
		);
	});

	it("sanitizes pasted emails from common wrappers and punctuation", () => {
		expect(sanitizePastedEmail(" <person@gmail.com>, ")).toBe(
			"person@gmail.com",
		);
		expect(sanitizePastedEmail('"person @ gmail.com"')).toBe(
			"person@gmail.com",
		);
	});

	describe("sanitizeRecentProfile", () => {
		it("trims names and lowercases email for a valid stored profile", () => {
			expect(
				sanitizeRecentProfile({
					firstName: " Ada ",
					lastName: " Lovelace ",
					email: " ADA@EXAMPLE.COM ",
				}),
			).toEqual({
				firstName: "Ada",
				lastName: "Lovelace",
				email: "ada@example.com",
			});
		});

		it("rejects invalid profile shapes", () => {
			expect(sanitizeRecentProfile(null)).toBe(null);
			expect(sanitizeRecentProfile({ firstName: "Ada" })).toBe(null);
			expect(
				sanitizeRecentProfile({
					firstName: "Ada",
					lastName: "Lovelace",
					email: "not-an-email",
				}),
			).toBe(null);
		});
	});

	describe("validateEmail", () => {
		it("checks basic email syntax", () => {
			expect(validateEmail("person@example.com")).toBe(true);
			expect(validateEmail("person@example")).toBe(false);
			expect(validateEmail("person example.com")).toBe(false);
		});
	});
});
