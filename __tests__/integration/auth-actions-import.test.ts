import type * as AuthActions from "@/features/auth/actions";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	importCollectedEmails: typeof AuthActions.importCollectedEmails;
	addOrUpdate: ReturnType<typeof vi.fn>;
};

const loadActions = async (): Promise<Setup> => {
	vi.resetModules();

	const addOrUpdate = vi.fn().mockResolvedValue({ alreadyExisted: false });
	const getStatus = vi.fn().mockResolvedValue({
		provider: "postgres",
		location: "test",
		totalUsers: 1,
		lastUpdatedAt: "2026-06-03T00:00:00.000Z",
	});

	vi.doMock("@/features/auth/user-collection-store", () => ({
		UserCollectionStore: {
			addOrUpdate,
			getStatus,
		},
	}));

	vi.doMock("@/features/auth/admin-validation", () => ({
		validateAdminAccessFromServerContext: vi.fn().mockResolvedValue(true),
		validateDirectAdminKey: vi.fn().mockResolvedValue(true),
	}));

	vi.doMock("@/features/admin/activity/record", () => ({
		recordAdminActivity: vi.fn().mockResolvedValue(undefined),
	}));

	vi.doMock("@/features/auth/admin-auth-token", () => ({
		clearAdminSessionCookie: vi.fn(),
		createAdminSessionWithCookie: vi.fn(),
		getCurrentAdminSession: vi.fn(),
		getCurrentTokenVersion: vi.fn(),
		listAdminTokenSessions: vi.fn(),
		revokeAdminSessionByJti: vi.fn(),
		revokeAllAdminSessions: vi.fn(),
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
		addOrUpdate,
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
});
