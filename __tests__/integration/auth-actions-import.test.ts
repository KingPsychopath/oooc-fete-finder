import type * as AuthActions from "@/features/auth/actions";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	importCollectedEmails: typeof AuthActions.importCollectedEmails;
	deleteCollectedEmails: typeof AuthActions.deleteCollectedEmails;
	revokeAdminTokenSessionByJti: typeof AuthActions.revokeAdminTokenSessionByJti;
	revokeAllAdminTokenSessionsAction: typeof AuthActions.revokeAllAdminTokenSessionsAction;
	addOrUpdate: ReturnType<typeof vi.fn>;
	deleteByEmails: ReturnType<typeof vi.fn>;
	revokeAdminSessionByJti: ReturnType<typeof vi.fn>;
	revokeAllAdminSessions: ReturnType<typeof vi.fn>;
	recordAdminActivity: ReturnType<typeof vi.fn>;
};

const loadActions = async (): Promise<Setup> => {
	vi.resetModules();

	const addOrUpdate = vi.fn().mockResolvedValue({ alreadyExisted: false });
	const deleteByEmails = vi.fn().mockResolvedValue(2);
	const revokeAdminSessionByJti = vi.fn().mockResolvedValue(true);
	const revokeAllAdminSessions = vi.fn().mockResolvedValue(4);
	const recordAdminActivity = vi.fn().mockResolvedValue(undefined);
	const getStatus = vi.fn().mockResolvedValue({
		provider: "postgres",
		location: "test",
		totalUsers: 1,
		lastUpdatedAt: "2026-06-03T00:00:00.000Z",
	});

	vi.doMock("@/features/auth/user-collection-store", () => ({
		UserCollectionStore: {
			addOrUpdate,
			deleteByEmails,
			getStatus,
		},
	}));

	vi.doMock("@/features/auth/admin-validation", () => ({
		validateAdminAccessFromServerContext: vi.fn().mockResolvedValue(true),
		validateDirectAdminKey: vi.fn().mockResolvedValue(true),
	}));

	vi.doMock("@/features/admin/activity/record", () => ({
		recordAdminActivity,
	}));

	vi.doMock("@/features/auth/admin-auth-token", () => ({
		clearAdminSessionCookie: vi.fn(),
		createAdminSessionWithCookie: vi.fn(),
		getCurrentAdminSession: vi.fn(),
		getCurrentTokenVersion: vi.fn(),
		listAdminTokenSessions: vi.fn(),
		revokeAdminSessionByJti,
		revokeAllAdminSessions,
	}));

	vi.doMock("@/lib/config/env", () => ({
		isAdminAuthEnabled: vi.fn(() => true),
	}));

	vi.doMock("@/lib/platform/logger", () => ({
		log: {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		},
	}));

	const actions = await import("@/features/auth/actions");
	return {
		importCollectedEmails: actions.importCollectedEmails,
		deleteCollectedEmails: actions.deleteCollectedEmails,
		revokeAdminTokenSessionByJti: actions.revokeAdminTokenSessionByJti,
		revokeAllAdminTokenSessionsAction:
			actions.revokeAllAdminTokenSessionsAction,
		addOrUpdate,
		deleteByEmails,
		revokeAdminSessionByJti,
		revokeAllAdminSessions,
		recordAdminActivity,
	};
};

describe("auth admin import actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("does not overwrite marketing preferences for plain pasted emails", async () => {
		const { importCollectedEmails, addOrUpdate } = await loadActions();

		const result = await importCollectedEmails(
			"plain@example.com, Ada, Lovelace",
			"admin-key",
		);

		expect(result.success).toBe(true);
		expect(addOrUpdate).toHaveBeenCalledWith(
			expect.not.objectContaining({
				marketingPreferenceUpdated: true,
			}),
		);
	});

	it("marks marketing preferences explicit when CSV headers include them", async () => {
		const { importCollectedEmails, addOrUpdate } = await loadActions();

		const result = await importCollectedEmails(
			[
				"Email,First Name,Last Name,Marketing Allowed,Event Updates Allowed",
				"csv@example.com,Ada,Lovelace,false,true",
			].join("\n"),
			"admin-key",
		);

		expect(result.success).toBe(true);
		expect(addOrUpdate).toHaveBeenCalledWith(
			expect.objectContaining({
				email: "csv@example.com",
				marketingConsent: false,
				eventUpdateConsent: true,
				marketingPreferenceUpdated: true,
			}),
		);
	});

	it("requires a reason before clearing audience rows", async () => {
		const { deleteCollectedEmails, deleteByEmails, recordAdminActivity } =
			await loadActions();

		const result = await deleteCollectedEmails(["test@example.com"]);

		expect(result.success).toBe(false);
		expect(result.error).toContain("reason");
		expect(deleteByEmails).not.toHaveBeenCalled();
		expect(recordAdminActivity).not.toHaveBeenCalled();
	});

	it("records the clear reason when audience rows are cleared", async () => {
		const { deleteCollectedEmails, deleteByEmails, recordAdminActivity } =
			await loadActions();

		const result = await deleteCollectedEmails(
			["one@example.com", "two@example.com"],
			"admin-key",
			"removing test imports",
		);

		expect(result.success).toBe(true);
		expect(deleteByEmails).toHaveBeenCalledWith([
			"one@example.com",
			"two@example.com",
		]);
		expect(recordAdminActivity).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "audience.emails.deleted",
				severity: "destructive",
				metadata: expect.objectContaining({
					requestedCount: 2,
					deletedCount: 2,
					reason: "removing test imports",
				}),
			}),
		);
	});

	it("requires a reason before revoking one admin session", async () => {
		const {
			revokeAdminTokenSessionByJti,
			revokeAdminSessionByJti,
			recordAdminActivity,
		} = await loadActions();

		const result = await revokeAdminTokenSessionByJti("session-1");

		expect(result.success).toBe(false);
		expect(result.error).toContain("reason");
		expect(revokeAdminSessionByJti).not.toHaveBeenCalled();
		expect(recordAdminActivity).not.toHaveBeenCalled();
	});

	it("records the reason when revoking one admin session", async () => {
		const {
			revokeAdminTokenSessionByJti,
			revokeAdminSessionByJti,
			recordAdminActivity,
		} = await loadActions();

		const result = await revokeAdminTokenSessionByJti(
			"session-123456789",
			"admin-key",
			"shared machine cleanup",
		);

		expect(result.success).toBe(true);
		expect(revokeAdminSessionByJti).toHaveBeenCalledWith("session-123456789");
		expect(recordAdminActivity).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "auth.session.revoked",
				metadata: { reason: "shared machine cleanup" },
			}),
		);
	});

	it("requires a reason before revoking all admin sessions", async () => {
		const {
			revokeAllAdminTokenSessionsAction,
			revokeAllAdminSessions,
			recordAdminActivity,
		} = await loadActions();

		const result = await revokeAllAdminTokenSessionsAction();

		expect(result.success).toBe(false);
		expect(result.error).toContain("reason");
		expect(revokeAllAdminSessions).not.toHaveBeenCalled();
		expect(recordAdminActivity).not.toHaveBeenCalled();
	});

	it("records the reason when revoking all admin sessions", async () => {
		const {
			revokeAllAdminTokenSessionsAction,
			revokeAllAdminSessions,
			recordAdminActivity,
		} = await loadActions();

		const result = await revokeAllAdminTokenSessionsAction(
			"admin-key",
			"rotating admin access",
		);

		expect(result.success).toBe(true);
		expect(result.nextTokenVersion).toBe(4);
		expect(revokeAllAdminSessions).toHaveBeenCalledTimes(1);
		expect(recordAdminActivity).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "auth.sessions.revoked_all",
				metadata: expect.objectContaining({
					nextTokenVersion: 4,
					reason: "rotating admin access",
				}),
			}),
		);
	});
});
