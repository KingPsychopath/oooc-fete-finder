import "server-only";

import { getPostgresClient } from "@/lib/platform/postgres/postgres-client";
import type { KeyValueStore } from "./kv-types";

const TABLE_NAME = "app_kv_store";

export class PostgresKVStore implements KeyValueStore {
	private readonly ensureTablePromise: Promise<void>;

	constructor() {
		this.ensureTablePromise = this.ensureTable();
	}

	private async ensureTable(): Promise<void> {
		const sql = getPostgresClient();
		if (!sql) {
			throw new Error("Postgres client is not available");
		}

		await sql`
			CREATE TABLE IF NOT EXISTS app_kv_store (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL,
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
			)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureTablePromise;
	}

	async get(key: string): Promise<string | null> {
		await this.ready();
		const sql = getPostgresClient();
		if (!sql) return null;

		const rows = await sql<{ value: string }[]>`
			SELECT value
			FROM app_kv_store
			WHERE key = ${key}
			LIMIT 1
		`;

		return rows[0]?.value ?? null;
	}

	async set(key: string, value: string): Promise<void> {
		await this.ready();
		const sql = getPostgresClient();
		if (!sql) {
			throw new Error("Postgres client is not available");
		}

		await sql`
			INSERT INTO app_kv_store (key, value, updated_at)
			VALUES (${key}, ${value}, NOW())
			ON CONFLICT (key)
			DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
		`;
	}

	async delete(key: string): Promise<void> {
		await this.ready();
		const sql = getPostgresClient();
		if (!sql) {
			throw new Error("Postgres client is not available");
		}

		await sql`
			DELETE FROM app_kv_store
			WHERE key = ${key}
		`;
	}

	async list(prefix = ""): Promise<string[]> {
		await this.ready();
		const sql = getPostgresClient();
		if (!sql) return [];

		if (!prefix) {
			const rows = await sql<{ key: string }[]>`
				SELECT key
				FROM app_kv_store
				ORDER BY key ASC
			`;
			return rows.map((row) => row.key);
		}

		const rows = await sql<{ key: string }[]>`
			SELECT key
			FROM app_kv_store
			WHERE key LIKE ${`${prefix}%`}
			ORDER BY key ASC
		`;
		return rows.map((row) => row.key);
	}

	static getTableName(): string {
		return TABLE_NAME;
	}
}
