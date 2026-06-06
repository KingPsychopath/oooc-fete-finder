import { describe, expect, it } from "vitest";
import {
	getNoticeCtaHrefError,
	normalizeNoticeCtaHref,
} from "@/features/users/notice-form";

describe("user notice form helpers", () => {
	it("normalizes bare domains into web URLs", () => {
		expect(normalizeNoticeCtaHref("google.com")).toBe("https://google.com/");
	});

	it("keeps local site paths unchanged", () => {
		expect(normalizeNoticeCtaHref("/ticket-exchange")).toBe(
			"/ticket-exchange",
		);
	});

	it("rejects unsupported CTA link protocols", () => {
		expect(normalizeNoticeCtaHref("javascript:alert(1)")).toBeNull();
		expect(getNoticeCtaHrefError("javascript:alert(1)")).toContain(
			"CTA link",
		);
	});
});
