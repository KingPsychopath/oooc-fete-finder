import "server-only";

import path from "path";
import { isPostgresConfigured } from "@/lib/platform/postgres/postgres-client";
import { FileKVStore } from "./file-kv-store";
import type { KeyValueStore, KVProviderInfo } from "./kv-types";
import { MemoryKVStore } from "./memory-kv-store";
import { PostgresKVStore } from "./postgres-kv-store";

let storeSingleton: Promise<{ store: KeyValueStore; info: KVProviderInfo }> | null =
	null;

const createStore = async (): Promise<{
	store: KeyValueStore;
	info: KVProviderInfo;
}> => {
	const shouldPreferPostgres =
		process.env.NEXT_RUNTIME !== "edge" &&
		isPostgresConfigured();

	if (shouldPreferPostgres) {
		try {
			const postgresStore = new PostgresKVStore();
			await postgresStore.list();
			return {
				store: postgresStore,
				info: {
					provider: "postgres",
					location: "Postgres table app_kv_store (DATABASE_URL)",
				},
			};
		} catch (error) {
			console.warn(
				"Failed to initialize Postgres KV store. Falling back to file provider:",
				error instanceof Error ? error.message : "Unknown error",
			);
		}
	}

	if (process.env.NEXT_RUNTIME !== "edge") {
		const filePath = path.join(process.cwd(), "data", "local-kv-store.json");

		try {
			const fileStore = new FileKVStore(filePath);
			await fileStore.list();
			return {
				store: fileStore,
				info: { provider: "file", location: filePath },
			};
		} catch (error) {
			console.warn(
				"Failed to initialize file KV store. Falling back to memory provider:",
				error instanceof Error ? error.message : "Unknown error",
			);
		}
	}

	return {
		store: new MemoryKVStore(),
		info: { provider: "memory", location: "in-memory fallback" },
	};
};

const getStoreBundle = async (): Promise<{
	store: KeyValueStore;
	info: KVProviderInfo;
}> => {
	if (!storeSingleton) {
		storeSingleton = createStore();
	}
	return storeSingleton;
};

export const getKVStore = async (): Promise<KeyValueStore> => {
	const bundle = await getStoreBundle();
	return bundle.store;
};

export const getKVStoreInfo = async (): Promise<KVProviderInfo> => {
	const bundle = await getStoreBundle();
	return bundle.info;
};
