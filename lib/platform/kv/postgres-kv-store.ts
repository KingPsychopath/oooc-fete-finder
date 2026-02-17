import "server-only";

import {
	getAppKVStoreRepository,
	getAppKVStoreTableName,
	type AppKVStoreRepository,
} from "@/lib/platform/postgres/app-kv-store-repository";
import type { KeyValueStore } from "./kv-types";

export class PostgresKVStore implements KeyValueStore {
	private readonly repository: AppKVStoreRepository;

	constructor() {
		const repository = getAppKVStoreRepository();
		if (!repository) {
			throw new Error("Postgres client is not available");
		}
		this.repository = repository;
	}

	async get(key: string): Promise<string | null> {
		return this.repository.getValue(key);
	}

	async set(key: string, value: string): Promise<void> {
		await this.repository.upsertValue(key, value);
	}

	async delete(key: string): Promise<void> {
		await this.repository.deleteKey(key);
	}

	async list(prefix = ""): Promise<string[]> {
		return this.repository.listKeys({ prefix });
	}

	static getTableName(): string {
		return getAppKVStoreTableName();
	}
}
