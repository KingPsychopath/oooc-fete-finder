import { UserRepository } from "@/lib/platform/postgres/user-repository";
import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";

const createSqlMock = (appUserIdColumnType: string) => {
	const unsafeCalls: string[] = [];
	const sql = vi.fn((strings: TemplateStringsArray) => {
		const query = strings.join("?");
		if (query.includes("format_type(attribute.atttypid")) {
			return [{ column_type: appUserIdColumnType }];
		}
		return [];
	});
	Object.assign(sql, {
		unsafe: vi.fn((query: string) => {
			unsafeCalls.push(query);
			return [];
		}),
	});
	return { sql: sql as unknown as Sql, unsafeCalls };
};

describe("UserRepository", () => {
	it("creates auth identities with UUID user ids when app_users already uses UUID ids", async () => {
		const { sql, unsafeCalls } = createSqlMock("uuid");

		await new UserRepository(sql).ensureReady();

		expect(unsafeCalls.join("\n")).toContain("user_id UUID NOT NULL");
	});

	it("creates auth identities with TEXT user ids for the canonical app schema", async () => {
		const { sql, unsafeCalls } = createSqlMock("text");

		await new UserRepository(sql).ensureReady();

		expect(unsafeCalls.join("\n")).toContain("user_id TEXT NOT NULL");
	});
});
