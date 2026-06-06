import { beforeEach, describe, expect, it, vi } from "vitest";

type NoticeRepositoryMock = {
	listActivePublicNotices: ReturnType<typeof vi.fn>;
	markNoticeReceipt: ReturnType<typeof vi.fn>;
};

type Setup = {
	GET: typeof import("@/app/api/user/notices/route").GET;
	POST: typeof import("@/app/api/user/notices/route").POST;
	getCanonicalUserSessionFromCookieHeader: ReturnType<typeof vi.fn>;
	listActivePublicNotices: ReturnType<typeof vi.fn>;
	markNoticeReceipt: ReturnType<typeof vi.fn>;
	setRepository: (repository: NoticeRepositoryMock | null) => void;
};

const loadRoute = async (): Promise<Setup> => {
	vi.resetModules();

	let repository: NoticeRepositoryMock | null = {
		listActivePublicNotices: vi.fn().mockResolvedValue([
			{
				id: "notice_1",
				title: "Listing rules updated",
				body: "Please review the latest ticket listing rules.",
				severity: "warning",
				ctaLabel: "View rules",
				ctaHref: "/ticket-exchange",
				requiresAck: true,
				dismissible: false,
				expiresAt: null,
				receipt: null,
			},
		]),
		markNoticeReceipt: vi.fn().mockResolvedValue(undefined),
	};
	const getCanonicalUserSessionFromCookieHeader = vi.fn().mockResolvedValue({
		isAuthenticated: true,
		userId: "019b0000-0000-7000-8000-000000000001",
		email: "owen@example.com",
	});

	vi.doMock("@/features/auth/user-session-cookie", () => ({
		USER_AUTH_COOKIE_NAME: "oooc_user_session",
		getCanonicalUserSessionFromCookieHeader,
	}));

	vi.doMock("@/features/users/policy-repository", () => ({
		getUserPolicyRepository: () => repository,
	}));

	const route = await import("@/app/api/user/notices/route");
	const getRepository = (): NoticeRepositoryMock => {
		if (!repository) {
			throw new Error("Repository mock is unavailable");
		}
		return repository;
	};

	return {
		GET: route.GET,
		POST: route.POST,
		getCanonicalUserSessionFromCookieHeader,
		get listActivePublicNotices() {
			return getRepository().listActivePublicNotices;
		},
		get markNoticeReceipt() {
			return getRepository().markNoticeReceipt;
		},
		setRepository: (nextRepository) => {
			repository = nextRepository;
		},
	};
};

describe("/api/user/notices route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns active notices for the authenticated user identity", async () => {
		const { GET, listActivePublicNotices } = await loadRoute();

		const response = await GET(
			new Request("https://example.com/api/user/notices", {
				headers: {
					cookie: "oooc_user_session=test-token",
				},
			}),
		);
		const payload = (await response.json()) as {
			success: boolean;
			notices: Array<{ id: string; severity: string }>;
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.notices).toHaveLength(1);
		expect(payload.notices[0]).toMatchObject({
			id: "notice_1",
			severity: "warning",
		});
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(listActivePublicNotices).toHaveBeenCalledWith({
			userId: "019b0000-0000-7000-8000-000000000001",
			email: "owen@example.com",
		});
	});

	it("records notice receipts for authenticated users", async () => {
		const { POST, markNoticeReceipt } = await loadRoute();

		const response = await POST(
			new Request("https://example.com/api/user/notices", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					cookie: "oooc_user_session=test-token",
				},
				body: JSON.stringify({
					noticeId: "notice_1",
					action: "acknowledge",
				}),
			}),
		);
		const payload = (await response.json()) as { success: boolean };

		expect(response.status).toBe(202);
		expect(payload).toEqual({ success: true });
		expect(response.headers.get("cache-control")).toContain("no-store");
		expect(markNoticeReceipt).toHaveBeenCalledWith({
			noticeId: "notice_1",
			action: "acknowledge",
			userId: "019b0000-0000-7000-8000-000000000001",
			email: "owen@example.com",
		});
	});

	it("accepts anonymous global dismissals without storing a receipt", async () => {
		const {
			POST,
			getCanonicalUserSessionFromCookieHeader,
			markNoticeReceipt,
		} = await loadRoute();
		getCanonicalUserSessionFromCookieHeader.mockResolvedValue({
			isAuthenticated: false,
			userId: null,
			email: null,
		});

		const response = await POST(
			new Request("https://example.com/api/user/notices", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					noticeId: "notice_1",
					action: "dismiss",
				}),
			}),
		);
		const payload = (await response.json()) as { success: boolean };

		expect(response.status).toBe(202);
		expect(payload).toEqual({ success: true });
		expect(markNoticeReceipt).not.toHaveBeenCalled();
	});

	it("returns empty notices when notice storage is unavailable", async () => {
		const { GET, setRepository } = await loadRoute();
		setRepository(null);

		const response = await GET(
			new Request("https://example.com/api/user/notices"),
		);
		const payload = (await response.json()) as {
			success: boolean;
			notices: unknown[];
		};

		expect(response.status).toBe(200);
		expect(payload).toEqual({ success: true, notices: [] });
	});
});
