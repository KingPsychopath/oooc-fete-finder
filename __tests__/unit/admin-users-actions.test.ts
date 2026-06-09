import { beforeEach, describe, expect, it, vi } from "vitest";

type RepositoryMock = {
	getAdminAudienceOverview: ReturnType<typeof vi.fn>;
	listAdminUsersPage: ReturnType<typeof vi.fn>;
	listActiveRestrictions: ReturnType<typeof vi.fn>;
	listGlobalNotices: ReturnType<typeof vi.fn>;
	listRecentAdminNotes: ReturnType<typeof vi.fn>;
	createNotice: ReturnType<typeof vi.fn>;
	updateUserStatus: ReturnType<typeof vi.fn>;
};

const createRepositoryMock = (): RepositoryMock => ({
	getAdminAudienceOverview: vi.fn().mockResolvedValue({
		supported: true,
		totalUsers: 1539,
		segmentCounts: {
			"has-activity": 1135,
			"missing-context": 346,
		},
	}),
	listAdminUsersPage: vi
		.fn()
		.mockResolvedValueOnce({
			users: [
				{
					userId: "019b0000-0000-7000-8000-000000000001",
					email: "owner@example.com",
					firstName: "Owner",
					lastName: "One",
					status: "active",
					source: "auth",
					firstSeenAt: "2026-06-01T09:00:00.000Z",
					lastSeenAt: "2026-06-02T09:00:00.000Z",
					lastAuthenticatedAt: "2026-06-02T09:00:00.000Z",
					marketingConsent: true,
					eventUpdateConsent: true,
					activeRestrictionCount: 0,
					openNoticeCount: 1,
					adminNoteCount: 0,
					ticketListingCount: 2,
					activeTicketListingCount: 1,
					openTicketReportCount: 0,
					ticketReportCount: 3,
					ticketReportsMadeCount: 1,
					ticketReportsAgainstListingCount: 2,
					eventSubmissionCount: 1,
					planCount: 1,
					savedEventCount: 4,
				},
			],
			totalCount: 12,
			page: 2,
			pageSize: 50,
			totalPages: 1,
		})
		.mockResolvedValueOnce({
			users: [],
			totalCount: 5,
			page: 1,
			pageSize: 1,
			totalPages: 5,
		}),
	listActiveRestrictions: vi.fn().mockResolvedValue([]),
	listGlobalNotices: vi.fn().mockResolvedValue([]),
	listRecentAdminNotes: vi.fn().mockResolvedValue([]),
	createNotice: vi.fn().mockResolvedValue({
		id: "notice_1",
		targetType: "global",
		targetUserId: null,
		targetEmail: null,
		segmentKey: null,
		title: "Scheduled work",
		body: "Listing posting pauses tonight.",
		severity: "warning",
		ctaLabel: null,
		ctaHref: null,
		requiresAck: false,
		dismissible: true,
		startsAt: "2026-06-07T20:00:00.000Z",
		expiresAt: null,
		createdBy: "Admin",
		createdAt: "2026-06-06T09:00:00.000Z",
		revokedAt: null,
		revokedBy: null,
		internalNote: "",
		isActive: false,
	}),
	updateUserStatus: vi.fn().mockResolvedValue({
		userId: "019b0000-0000-7000-8000-000000000001",
		email: "owner@example.com",
		firstName: "Owner",
		lastName: "One",
		status: "deleted",
		source: "auth",
		firstSeenAt: "2026-06-01T09:00:00.000Z",
		lastSeenAt: "2026-06-02T09:00:00.000Z",
		lastAuthenticatedAt: "2026-06-02T09:00:00.000Z",
		marketingConsent: true,
		eventUpdateConsent: true,
		activeRestrictionCount: 0,
		openNoticeCount: 0,
		adminNoteCount: 0,
		ticketListingCount: 0,
		activeTicketListingCount: 0,
		openTicketReportCount: 0,
		ticketReportCount: 0,
		ticketReportsMadeCount: 0,
		ticketReportsAgainstListingCount: 0,
		eventSubmissionCount: 0,
		planCount: 0,
		savedEventCount: 0,
	}),
});

const loadActions = async (repository: RepositoryMock) => {
	vi.resetModules();
	const recordAdminActivity = vi.fn().mockResolvedValue(undefined);
	const revalidatePath = vi.fn();

	vi.doMock("@/features/auth/admin-validation", () => ({
		validateAdminAccessFromServerContext: vi.fn().mockResolvedValue(true),
	}));
	vi.doMock("@/lib/platform/postgres/user-repository", () => ({
		getUserRepository: () => ({
			ensureReady: vi.fn().mockResolvedValue(undefined),
		}),
	}));
	vi.doMock("@/features/users/policy-repository", () => ({
		getUserPolicyRepository: () => repository,
	}));
	vi.doMock("@/features/admin/activity/record", () => ({
		getCurrentAdminActivityActor: vi.fn().mockResolvedValue({
			actorLabel: "Admin",
		}),
		recordAdminActivity,
	}));
	vi.doMock("next/cache", () => ({
		revalidatePath,
		unstable_cache: (callback: unknown) => callback,
	}));

	const actions = await import("@/features/users/admin-actions");
	return { actions, recordAdminActivity, revalidatePath };
};

describe("admin user actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns paginated users plus a dashboard-level needs-attention count", async () => {
		const repository = createRepositoryMock();
		const { actions } = await loadActions(repository);

		const dashboard = await actions.getAdminUsersDashboard({
			query: "owner",
			status: "active",
			activity: "has_ticket_reports",
			sortKey: "ticket_reports",
			sortDirection: "desc",
			page: 2,
			pageSize: 50,
		});

		expect(dashboard.supported).toBe(true);
		expect(dashboard.totalUsers).toBe(12);
		expect(dashboard.attentionUserCount).toBe(5);
		expect(dashboard.query).toMatchObject({
			query: "owner",
			status: "active",
			activity: "has_ticket_reports",
			sortKey: "ticket_reports",
			sortDirection: "desc",
			page: 2,
			pageSize: 50,
		});
		expect(repository.listAdminUsersPage).toHaveBeenNthCalledWith(2, {
			query: "owner",
			status: "active",
			activity: "needs_attention",
			audienceSignal: "all",
			sortKey: "ticket_reports",
			sortDirection: "desc",
			page: 1,
			pageSize: 1,
		});
	});

	it("returns the canonical audience overview without loading dashboard pages", async () => {
		const repository = createRepositoryMock();
		const { actions } = await loadActions(repository);

		const overview = await actions.getAdminAudienceOverview();

		expect(overview).toEqual({
			supported: true,
			totalUsers: 1539,
			segmentCounts: {
				"has-activity": 1135,
				"missing-context": 346,
			},
		});
		expect(repository.getAdminAudienceOverview).toHaveBeenCalledTimes(1);
		expect(repository.listAdminUsersPage).not.toHaveBeenCalled();
	});

	it("creates scheduled notices with the start time in storage and audit metadata", async () => {
		const repository = createRepositoryMock();
		const { actions, recordAdminActivity, revalidatePath } =
			await loadActions(repository);

		const result = await actions.createUserNoticeAsAdmin({
			targetType: "global",
			title: "Scheduled work",
			body: "Listing posting pauses tonight.",
			severity: "warning",
			startsAt: "2026-06-07T20:00:00.000Z",
			expiresAt: null,
			requiresAck: false,
			dismissible: true,
		});

		expect(result).toEqual({ success: true });
		expect(repository.createNotice).toHaveBeenCalledWith(
			expect.objectContaining({
				targetType: "global",
				startsAt: "2026-06-07T20:00:00.000Z",
				expiresAt: null,
				createdBy: "Admin",
			}),
		);
		expect(recordAdminActivity).toHaveBeenCalledWith(
			expect.objectContaining({
				metadata: expect.objectContaining({
					noticeId: "notice_1",
					startsAt: "2026-06-07T20:00:00.000Z",
				}),
			}),
		);
		expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
	});

	it("normalizes bare notice CTA domains before storage", async () => {
		const repository = createRepositoryMock();
		const { actions } = await loadActions(repository);

		const result = await actions.createUserNoticeAsAdmin({
			targetType: "user",
			targetUserId: "019b0000-0000-7000-8000-000000000001",
			title: "Please stop that",
			body: "Test hi hello",
			severity: "warning",
			ctaLabel: "Cta goes here",
			ctaHref: "google.com",
		});

		expect(result).toEqual({ success: true });
		expect(repository.createNotice).toHaveBeenCalledWith(
			expect.objectContaining({
				ctaLabel: "Cta goes here",
				ctaHref: "https://google.com/",
			}),
		);
	});

	it("marks managed users deleted through the status action with audit metadata", async () => {
		const repository = createRepositoryMock();
		const { actions, recordAdminActivity, revalidatePath } =
			await loadActions(repository);

		const result = await actions.updateManagedUserStatusAsAdmin({
			userId: "019b0000-0000-7000-8000-000000000001",
			email: "owner@example.com",
			status: "deleted",
			reason: "User requested account closure.",
		});

		expect(result).toEqual({ success: true });
		expect(repository.updateUserStatus).toHaveBeenCalledWith({
			userId: "019b0000-0000-7000-8000-000000000001",
			email: "owner@example.com",
			status: "deleted",
		});
		expect(recordAdminActivity).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "user.status.updated",
				metadata: {
					status: "deleted",
					reason: "User requested account closure.",
				},
				severity: "warning",
			}),
		);
		expect(revalidatePath).toHaveBeenCalledWith("/admin/users");
		expect(revalidatePath).toHaveBeenCalledWith(
			"/admin/users/019b0000-0000-7000-8000-000000000001",
		);
	});
});
