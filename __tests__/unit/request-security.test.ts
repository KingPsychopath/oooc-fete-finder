import {
	isJsonContentType,
	isSameOriginRequest,
	isWithinBodySizeLimit,
} from "@/lib/http/request-security";
import { describe, expect, it } from "vitest";

describe("request security helpers", () => {
	it("allows same-origin browser requests", () => {
		const request = new Request("http://localhost:3000/api/track", {
			method: "POST",
			headers: {
				host: "localhost:3000",
				origin: "http://localhost:3000",
				"sec-fetch-site": "same-origin",
			},
		});

		expect(isSameOriginRequest(request)).toBe(true);
	});

	it("rejects cross-site browser requests", () => {
		const request = new Request("https://fete.example/api/track", {
			method: "POST",
			headers: {
				host: "fete.example",
				origin: "https://attacker.example",
				"sec-fetch-site": "cross-site",
			},
		});

		expect(isSameOriginRequest(request)).toBe(false);
	});

	it("allows server-to-server requests without an origin", () => {
		const request = new Request("https://fete.example/api/revalidate/deploy", {
			method: "POST",
			headers: {
				host: "fete.example",
			},
		});

		expect(isSameOriginRequest(request)).toBe(true);
	});

	it("validates JSON content types and content-length limits", () => {
		const request = new Request("https://fete.example/api/track", {
			method: "POST",
			headers: {
				"content-type": "application/json; charset=utf-8",
				"content-length": "128",
			},
		});

		expect(isJsonContentType(request)).toBe(true);
		expect(isWithinBodySizeLimit(request, 256)).toBe(true);
		expect(isWithinBodySizeLimit(request, 64)).toBe(false);
	});
});
