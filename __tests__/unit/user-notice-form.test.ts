import { describe, expect, it } from "vitest";
import {
	getDefaultNoticeExpiresAtInputValue,
	getNoticeCtaHrefError,
	getNoticeLifecycleError,
	normalizeNoticeCtaHref,
} from "@/features/users/notice-form";

describe("user notice form helpers", () => {
	it("normalizes bare domains into web URLs", () => {
		expect(normalizeNoticeCtaHref("google.com")).toBe("https://google.com/");
	});

	it("keeps local site paths unchanged", () => {
		expect(normalizeNoticeCtaHref("/ticket-exchange")).toBe("/ticket-exchange");
	});

	it("rejects unsupported CTA link protocols", () => {
		expect(normalizeNoticeCtaHref("javascript:alert(1)")).toBeNull();
		expect(getNoticeCtaHrefError("javascript:alert(1)")).toContain("CTA link");
	});

	it("defaults notices to a dated expiry input", () => {
		expect(getDefaultNoticeExpiresAtInputValue()).toMatch(
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/,
		);
	});

	it("blocks non-dismissible notices that have no acknowledgement or expiry", () => {
		expect(
			getNoticeLifecycleError({
				requiresAck: false,
				dismissible: false,
				expiresAt: null,
			}),
		).toContain("dismissible");
		expect(
			getNoticeLifecycleError({
				requiresAck: true,
				dismissible: false,
				expiresAt: null,
			}),
		).toBeNull();
	});

	it("requires expiry to be after the notice start time", () => {
		expect(
			getNoticeLifecycleError({
				startsAt: "2026-06-10T12:00:00.000Z",
				expiresAt: "2026-06-10T11:59:00.000Z",
			}),
		).toContain("after");
	});
});
