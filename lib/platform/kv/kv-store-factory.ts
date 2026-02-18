import "server-only";

import path from "path";
import { isPostgresConfigured } from "@/lib/platform/postgres/postgres-client";
import { log } from "@/lib/platform/logger";
import { FileKVStore } from "./file-kv-store";
import type { KeyValueStore, KVProviderInfo } from "./kv-types";
import { MemoryKVStore } from "./memory-kv-store";
import { PostgresKVStore } from "./postgres-kv-store";

let storeSingleton: Promise<{ store: KeyValueStore; info: KVProviderInfo }> | null =
	null;

const isVercelDeployRuntime = (): boolean => {
	if (process.env.VERCEL !== "1") {
		return false;
	}

	return (
		process.env.VERCEL_ENV === "production" ||
		process.env.VERCEL_ENV === "preview"
	);
};

const createPostgresStore = async (): Promise<{
	store: KeyValueStore;
	info: KVProviderInfo;
}> => {
	const postgresStore = new PostgresKVStore();
	await postgresStore.get("__kv-init-check__");
	return {
		store: postgresStore,
		info: {
			provider: "postgres",
			location: "Postgres table app_kv_store (DATABASE_URL)",
		},
	};
};

const createStore = async (): Promise<{
	store: KeyValueStore;
	info: KVProviderInfo;
}> => {
	const strictRuntime = isVercelDeployRuntime();
	const isEdgeRuntime = process.env.NEXT_RUNTIME === "edge";
	const postgresConfigured = isPostgresConfigured();

	if (strictRuntime) {
		if (isEdgeRuntime) {
			const message =
				"KV strict mode requires a Node.js runtime in Vercel preview/production.";
			log.error("kv", message, {
				runtime: process.env.NEXT_RUNTIME ?? "unknown",
				vercelEnv: process.env.VERCEL_ENV ?? "unknown",
			});
			throw new Error(message);
		}

		if (!postgresConfigured) {
			const message =
				"KV strict mode is active in Vercel preview/production. Configure DATABASE_URL for Postgres KV.";
			log.error("kv", message, {
				vercelEnv: process.env.VERCEL_ENV ?? "unknown",
			});
			throw new Error(message);
		}

		try {
			return await createPostgresStore();
		} catch (error) {
			const message =
				"Failed to initialize Postgres KV store in strict mode. Deployment is blocked until Postgres KV is healthy.";
			log.error(
				"kv",
				message,
				{
					vercelEnv: process.env.VERCEL_ENV ?? "unknown",
				},
				error,
			);
			throw new Error(message);
		}
	}

	const shouldPreferPostgres =
		!isEdgeRuntime && postgresConfigured;

	if (shouldPreferPostgres) {
		try {
			return await createPostgresStore();
		} catch (error) {
			log.warn("kv", "Failed to initialize Postgres KV store; falling back to file", {
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	if (!isEdgeRuntime) {
		const filePath = path.join(process.cwd(), "data", "local-kv-store.json");

		try {
			const fileStore = new FileKVStore(filePath);
			await fileStore.list();
			return {
				store: fileStore,
				info: { provider: "file", location: filePath },
			};
		} catch (error) {
			log.warn("kv", "Failed to initialize file KV store; falling back to memory", {
				error: error instanceof Error ? error.message : "Unknown error",
			});
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
