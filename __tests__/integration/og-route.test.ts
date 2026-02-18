import type { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type MockKVStore = {
	get: ReturnType<typeof vi.fn>;
	set: ReturnType<typeof vi.fn>;
};

type Setup = {
	GET: typeof import("@/app/api/og/route").GET;
	kv: MockKVStore;
};

const loadRoute = async (initialRateState: string | null): Promise<Setup> => {
	vi.resetModules();

	let storedRateState = initialRateState;
	const kv: MockKVStore = {
		get: vi.fn(async () => storedRateState),
		set: vi.fn(async (_key: string, value: string) => {
			storedRateState = value;
		}),
	};

	vi.doMock("@/lib/config/env", () => ({
		env: {
			NEXT_PUBLIC_SITE_URL: "https://fete-finder.ooo",
		},
	}));

	vi.doMock("@/lib/platform/kv/kv-store-factory", () => ({
		getKVStore: async () => kv,
	}));

	vi.doMock("next/og", () => ({
		ImageResponse: class ImageResponseMock extends Response {
			constructor(_element: unknown, init?: ResponseInit) {
				const headers = new Headers(init?.headers);
				if (!headers.has("content-type")) {
					headers.set("content-type", "image/png");
				}
				super("png-binary", {
					status: init?.status ?? 200,
					headers,
				});
			}
		},
	}));

	vi.doMock("@/lib/platform/logger", () => ({
		log: {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		},
	}));

	const route = await import("@/app/api/og/route");
	return { GET: route.GET, kv };
};

describe("/api/og route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns a cacheable OG image response when request is within limit", async () => {
		const { GET, kv } = await loadRoute(null);
		const request = new Request(
			"https://example.com/api/og?theme=event&arrondissement=11e&eventCount=12",
			{
				headers: {
					"x-forwarded-for": "203.0.113.10",
				},
			},
		) as NextRequest;

		const response = await GET(request);

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("image/png");
		expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
		expect(kv.get).toHaveBeenCalledTimes(1);
		expect(kv.set).toHaveBeenCalledTimes(1);
	});

	it("returns 429 with no-store when rate limit is exceeded", async () => {
		const futureWindow = Date.now() + 60_000;
		const { GET, kv } = await loadRoute(
			JSON.stringify({
				count: 120,
				resetAt: futureWindow,
			}),
		);
		const request = new Request("https://example.com/api/og", {
			headers: {
				"x-forwarded-for": "203.0.113.99",
			},
		}) as NextRequest;

		const response = await GET(request);

		expect(response.status).toBe(429);
		expect(await response.text()).toBe("Rate limit exceeded");
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(kv.get).toHaveBeenCalledTimes(1);
		expect(kv.set).not.toHaveBeenCalled();
	});
});
