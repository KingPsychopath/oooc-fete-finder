import { describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";

type SqlCall = {
	text: string;
	values: unknown[];
};

const createSqlMock = () => {
	const calls: SqlCall[] = [];
	const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
		const text = strings.raw.join("?");
		calls.push({ text, values });
		if (text.includes("INSERT INTO app_user_notices")) {
			return Promise.resolve([
				{
					id: "notice_1",
					target_type: "user",
					target_user_id: "019b0000-0000-7000-8000-000000000001",
					target_email_normalized: null,
					segment_key: null,
					title: "Please stop that",
					body: "Test hi hello",
					severity: "warning",
					cta_label: "Open",
					cta_href: "https://google.com/",
					requires_ack: true,
					dismissible: true,
					starts_at: "2026-06-06T23:37:00.000Z",
					expires_at: null,
					created_by: "Admin",
					created_at: "2026-06-06T23:37:00.000Z",
					revoked_at: null,
					revoked_by: null,
					internal_note: "",
					is_active: true,
				},
			]);
		}
		return Promise.resolve([]);
	}) as unknown as Sql;
	return { calls, sql };
};

describe("UserPolicyRepository", () => {
	it("uses the current timestamp when notice startsAt is blank", async () => {
		vi.resetModules();
		vi.doMock("server-only", () => ({}));
		vi.doMock("@/lib/platform/postgres/postgres-client", () => ({
			getPostgresClient: () => null,
		}));
		const { UserPolicyRepository } = await import(
			"@/features/users/policy-repository"
		);
		const { calls, sql } = createSqlMock();
		const repository = new UserPolicyRepository(sql);

		await repository.createNotice({
			targetType: "user",
			targetUserId: "019b0000-0000-7000-8000-000000000001",
			title: "Please stop that",
			body: "Test hi hello",
			severity: "warning",
			ctaLabel: "Open",
			ctaHref: "google.com",
			startsAt: null,
			expiresAt: null,
			requiresAck: true,
			dismissible: true,
			createdBy: "Admin",
		});

		const insertCall = calls.find((call) =>
			call.text.includes("INSERT INTO app_user_notices"),
		);
		expect(insertCall?.text).toContain("COALESCE(?::timestamptz, NOW())");
	});

	it("rejects notices that cannot be acknowledged, dismissed, or expired", async () => {
		vi.resetModules();
		vi.doMock("server-only", () => ({}));
		vi.doMock("@/lib/platform/postgres/postgres-client", () => ({
			getPostgresClient: () => null,
		}));
		const { UserPolicyRepository } = await import(
			"@/features/users/policy-repository"
		);
		const { sql } = createSqlMock();
		const repository = new UserPolicyRepository(sql);

		await expect(
			repository.createNotice({
				targetType: "user",
				targetUserId: "019b0000-0000-7000-8000-000000000001",
				title: "Persistent notice",
				body: "This would never close.",
				severity: "warning",
				startsAt: null,
				expiresAt: null,
				requiresAck: false,
				dismissible: false,
				createdBy: "Admin",
			}),
		).rejects.toThrow("dismissible");
	});

	it("hides acknowledgement notices by acknowledgement and ordinary notices by dismissal", async () => {
		vi.resetModules();
		vi.doMock("server-only", () => ({}));
		vi.doMock("@/lib/platform/postgres/postgres-client", () => ({
			getPostgresClient: () => null,
		}));
		const { UserPolicyRepository } = await import(
			"@/features/users/policy-repository"
		);
		const { calls, sql } = createSqlMock();
		const repository = new UserPolicyRepository(sql);

		await repository.listActivePublicNotices({
			userId: "019b0000-0000-7000-8000-000000000001",
			email: "test@gmail.com",
		});

		const publicNoticeCall = calls.find((call) =>
			call.text.includes("FROM app_user_notices notices"),
		);
		expect(publicNoticeCall?.text).toContain(
			"notices.requires_ack = TRUE AND receipts.acknowledged_at IS NULL",
		);
		expect(publicNoticeCall?.text).toContain(
			"notices.requires_ack = FALSE AND receipts.dismissed_at IS NULL",
		);
		expect(publicNoticeCall?.text).not.toContain(
			"receipts.dismissed_at IS NULL\n\t\t\t\t\tOR notices.requires_ack",
		);
	});

	it("counts only unresolved direct notices on the admin users list", async () => {
		vi.resetModules();
		vi.doMock("server-only", () => ({}));
		vi.doMock("@/lib/platform/postgres/postgres-client", () => ({
			getPostgresClient: () => null,
		}));
		const { UserPolicyRepository } = await import(
			"@/features/users/policy-repository"
		);
		const { calls, sql } = createSqlMock();
		const repository = new UserPolicyRepository(sql);

		await repository.listAdminUsersPage({ activity: "has_notices" });

		const usersPageCall = calls.find((call) =>
			call.text.includes("WITH base AS"),
		);
		expect(usersPageCall?.text).toContain("LEFT JOIN LATERAL");
		expect(usersPageCall?.text).toContain("notice_receipt.acknowledged_at");
		expect(usersPageCall?.text).toContain("notice_receipt.dismissed_at");
		expect(usersPageCall?.text).toContain("notices.target_user_id = users.id");
		expect(usersPageCall?.text).not.toContain(
			"notices.target_type IN ('global', 'authenticated_users')",
		);
	});

	it("loads recipient receipt state for admin user notice drilldowns", async () => {
		vi.resetModules();
		vi.doMock("server-only", () => ({}));
		vi.doMock("@/lib/platform/postgres/postgres-client", () => ({
			getPostgresClient: () => null,
		}));
		const { UserPolicyRepository } = await import(
			"@/features/users/policy-repository"
		);
		const { calls, sql } = createSqlMock();
		const repository = new UserPolicyRepository(sql);

		await repository.listNoticesForUser({
			userId: "019b0000-0000-7000-8000-000000000001",
			email: "test@gmail.com",
		});

		const noticesForUserCall = calls.find((call) =>
			call.text.includes("recipient_receipt.read_at AS recipient_read_at"),
		);
		expect(noticesForUserCall?.text).toContain(
			"recipient_receipt.acknowledged_at AS recipient_acknowledged_at",
		);
		expect(noticesForUserCall?.text).toContain(
			"notices.target_type = 'segment'",
		);
		expect(noticesForUserCall?.text).toContain(
			"recipient_receipt.acknowledged_at IS NULL",
		);
	});
});
