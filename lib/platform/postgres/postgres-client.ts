import "server-only";

import postgres, { type Sql } from "postgres";
import { env } from "@/lib/config/env";

declare global {
	var __ooocFeteFinderPostgresClient: Sql | undefined;
}

export const isPostgresConfigured = (): boolean => {
	return Boolean(env.DATABASE_URL && env.DATABASE_URL.trim().length > 0);
};

export const getPostgresClient = (): Sql | null => {
	if (process.env.NEXT_RUNTIME === "edge") {
		return null;
	}

	const databaseUrl = env.DATABASE_URL;
	if (!databaseUrl || databaseUrl.trim().length === 0) {
		return null;
	}

	if (!globalThis.__ooocFeteFinderPostgresClient) {
		globalThis.__ooocFeteFinderPostgresClient = postgres(databaseUrl, {
			prepare: false,
			max: 1,
			connect_timeout: 5,
			idle_timeout: 20,
			max_lifetime: 60 * 10,
			onnotice: () => {},
		});
	}

	return globalThis.__ooocFeteFinderPostgresClient;
};
