import "server-only";

import type { Sql } from "postgres";
import { getPostgresClient } from "./postgres-client";

declare global {
	var __ooocFeteFinderUserEventRelationshipRepository:
		| UserEventRelationshipRepository
		| undefined;
}

export const USER_EVENT_RELATIONSHIP_TYPES = [
	"saved",
	"calendar_added",
	"notify_me",
	"dismissed",
] as const;

export type UserEventRelationshipType =
	(typeof USER_EVENT_RELATIONSHIP_TYPES)[number];

export interface UserEventRelationshipInput {
	userId: string;
	eventKey: string;
	relationshipType: UserEventRelationshipType;
	source?: string | null;
	notifyOnChanges?: boolean;
}

const cleanString = (
	value: string | null | undefined,
	maxLength: number,
): string | null => {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	return trimmed.slice(0, maxLength);
};

export class UserEventRelationshipRepository {
	private readonly sql: Sql;
	private readonly ensureTablePromise: Promise<void>;

	constructor(sql: Sql) {
		this.sql = sql;
		this.ensureTablePromise = this.ensureTable();
	}

	private async ensureTable(): Promise<void> {
		await this.sql`
			CREATE TABLE IF NOT EXISTS app_user_event_relationships (
				id BIGSERIAL PRIMARY KEY,
				user_id TEXT NOT NULL,
				event_key TEXT NOT NULL,
				relationship_type TEXT NOT NULL CHECK (relationship_type IN ('saved', 'calendar_added', 'notify_me', 'dismissed')),
				source TEXT,
				notify_on_changes BOOLEAN NOT NULL DEFAULT FALSE,
				last_notified_at TIMESTAMPTZ,
				created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
				UNIQUE (user_id, event_key, relationship_type)
			)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_user_event_relationships_event
			ON app_user_event_relationships (event_key, relationship_type, updated_at DESC)
		`;

		await this.sql`
			CREATE INDEX IF NOT EXISTS idx_app_user_event_relationships_user
			ON app_user_event_relationships (user_id, updated_at DESC)
		`;
	}

	private async ready(): Promise<void> {
		await this.ensureTablePromise;
	}

	async upsertRelationship(input: UserEventRelationshipInput): Promise<void> {
		await this.ready();
		const userId = cleanString(input.userId, 80);
		const eventKey = cleanString(input.eventKey, 220)?.toLowerCase();
		if (!userId || !eventKey) {
			throw new Error("User id and event key are required");
		}

		await this.sql`
			INSERT INTO app_user_event_relationships (
				user_id,
				event_key,
				relationship_type,
				source,
				notify_on_changes,
				updated_at
			)
			VALUES (
				${userId},
				${eventKey},
				${input.relationshipType},
				${cleanString(input.source, 80)},
				${input.notifyOnChanges ?? false},
				NOW()
			)
			ON CONFLICT (user_id, event_key, relationship_type)
			DO UPDATE SET
				source = COALESCE(EXCLUDED.source, app_user_event_relationships.source),
				notify_on_changes = app_user_event_relationships.notify_on_changes OR EXCLUDED.notify_on_changes,
				updated_at = NOW()
		`;
	}

	async deleteRelationship(input: UserEventRelationshipInput): Promise<void> {
		await this.ready();
		const userId = cleanString(input.userId, 80);
		const eventKey = cleanString(input.eventKey, 220)?.toLowerCase();
		if (!userId || !eventKey) {
			throw new Error("User id and event key are required");
		}

		await this.sql`
			DELETE FROM app_user_event_relationships
			WHERE user_id = ${userId}
				AND event_key = ${eventKey}
				AND relationship_type = ${input.relationshipType}
		`;
	}

	async listEventKeysForUser(input: {
		userId: string;
		relationshipType: UserEventRelationshipType;
		limit?: number;
	}): Promise<string[]> {
		await this.ready();
		const userId = cleanString(input.userId, 80);
		if (!userId) {
			throw new Error("User id is required");
		}
		const limit = Math.min(Math.max(input.limit ?? 500, 1), 1000);
		const rows = await this.sql<{ event_key: string }[]>`
			SELECT event_key
			FROM app_user_event_relationships
			WHERE user_id = ${userId}
				AND relationship_type = ${input.relationshipType}
			ORDER BY updated_at DESC
			LIMIT ${limit}
		`;

		return rows.map((row) => row.event_key);
	}
}

export const getUserEventRelationshipRepository =
	(): UserEventRelationshipRepository | null => {
		if (
			globalThis.__ooocFeteFinderUserEventRelationshipRepository &&
			globalThis.__ooocFeteFinderUserEventRelationshipRepository instanceof
				UserEventRelationshipRepository
		) {
			return globalThis.__ooocFeteFinderUserEventRelationshipRepository;
		}

		const sql = getPostgresClient();
		if (!sql) return null;

		const repository = new UserEventRelationshipRepository(sql);
		globalThis.__ooocFeteFinderUserEventRelationshipRepository = repository;
		return repository;
	};
