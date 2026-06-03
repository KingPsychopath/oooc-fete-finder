import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const recordAction = vi.fn();

const loadRoute = async () => {
	vi.resetModules();

	vi.doMock(
		"@/lib/platform/postgres/ticket-exchange-analytics-repository",
		() => ({
			getTicketExchangeAnalyticsRepository: () => ({
				recordAction,
			}),
		}),
	);
	vi.doMock("@/features/security/rate-limiter", () => ({
		checkTrackDiscoveryIpLimit: () =>
			Promise.resolve({ allowed: true, reason: "ok" }),
		checkTrackDiscoverySessionLimit: () =>
			Promise.resolve({ allowed: true, reason: "ok" }),
		extractClientIpFromHeaders: () => "127.0.0.1",
	}));
	vi.doMock("@/features/auth/user-session-cookie", () => ({
		USER_AUTH_COOKIE_NAME: "oooc_user",
		getCanonicalUserSessionFromCookieHeader: () =>
			Promise.resolve({
				isAuthenticated: true,
				userId: "usr_abc",
				email: "alex@example.com",
			}),
	}));
	vi.doMock("@/features/auth/user-context-touch", () => ({
		touchAuthenticatedUserContext: vi.fn(),
	}));

	return import("@/app/api/analytics/ticket-exchange/route");
};

const makeRequest = (body: unknown) =>
	new NextRequest(
		"https://fete.outofofficecollective.co.uk/api/analytics/ticket-exchange",
		{
			method: "POST",
			headers: {
				"content-type": "application/json",
				host: "fete.outofofficecollective.co.uk",
				origin: "https://fete.outofofficecollective.co.uk",
			},
			body: JSON.stringify(body),
		},
	);

describe("/api/analytics/ticket-exchange", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("records valid same-origin exchange analytics", async () => {
		const { POST } = await loadRoute();
		const response = await POST(
			makeRequest({
				actionType: "listing_create",
				sessionId: "session-1",
				eventKey: "evt_abc",
				listingType: "selling",
				surface: "listing_form",
				path: "/exchange/evt_abc",
				clientContext: { deviceClass: "mobile" },
				recordedAt: "2026-06-01T12:00:00.000Z",
			}),
		);

		expect(response.status).toBe(202);
		expect(recordAction).toHaveBeenCalledWith(
			expect.objectContaining({
				actionType: "listing_create",
				userId: "usr_abc",
				userEmail: "alex@example.com",
				eventKey: "evt_abc",
				listingType: "selling",
				surface: "listing_form",
				path: "/exchange/evt_abc",
				deviceClass: "mobile",
			}),
		);
	});

	it("ignores non-exchange paths", async () => {
		const { POST } = await loadRoute();
		const response = await POST(
			makeRequest({
				actionType: "listing_create",
				sessionId: "session-1",
				path: "/admin",
				surface: "listing_form",
			}),
		);

		expect(response.status).toBe(202);
		expect(recordAction).not.toHaveBeenCalled();
	});

	it("records exchange friction analytics", async () => {
		const { POST } = await loadRoute();
		const response = await POST(
			makeRequest({
				actionType: "flow_blocked",
				sessionId: "session-1",
				eventKey: "evt_abc",
				listingId: "listing-1",
				listingType: "looking",
				listingStatus: "active",
				surface: "listing_card",
				detail: "login_required:contact_unlock",
				path: "/exchange/evt_abc",
				recordedAt: "2026-06-01T12:00:00.000Z",
			}),
		);

		expect(response.status).toBe(202);
		expect(recordAction).toHaveBeenCalledWith(
			expect.objectContaining({
				actionType: "flow_blocked",
				eventKey: "evt_abc",
				listingId: "listing-1",
				listingType: "looking",
				listingStatus: "active",
				surface: "listing_card",
				detail: "login_required:contact_unlock",
			}),
		);
	});
});
