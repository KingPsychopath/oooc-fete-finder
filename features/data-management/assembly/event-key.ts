import "server-only";

import { createHash } from "crypto";

const EVENT_KEY_PATTERN = /^evt_[a-z0-9]{12,20}$/;
const EVENT_KEY_MIN_HASH_LENGTH = 12;
const EVENT_KEY_MAX_HASH_LENGTH = 20;
const EVENT_KEY_DEFAULT_HASH_LENGTH = 16;
const EVENT_KEY_EXCLUDED_FINGERPRINT_KEYS = new Set(["eventKey"]);

const normalizeForFingerprint = (value: string): string => {
	return value
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim()
		.replace(/\s+/g, " ");
};

const clampHashLength = (length: number): number => {
	return Math.max(
		EVENT_KEY_MIN_HASH_LENGTH,
		Math.min(EVENT_KEY_MAX_HASH_LENGTH, Math.floor(length)),
	);
};

const toStringRecord = (row: Record<string, unknown>): Record<string, string> => {
	return Object.fromEntries(
		Object.entries(row).map(([key, value]) => [key, String(value ?? "")]),
	);
};

const buildFingerprint = (
	row: Record<string, string>,
	stableKeys?: readonly string[],
): string => {
	const keys =
		stableKeys?.length ?
			stableKeys.filter((key) => !EVENT_KEY_EXCLUDED_FINGERPRINT_KEYS.has(key))
		:	Object.keys(row)
				.filter((key) => !EVENT_KEY_EXCLUDED_FINGERPRINT_KEYS.has(key))
				.sort((left, right) => left.localeCompare(right));

	return keys
		.map((key) => `${key}:${normalizeForFingerprint(row[key] ?? "")}`)
		.join("|");
};

export const normalizeEventKey = (
	value: string | null | undefined,
): string | null => {
	if (!value) return null;
	const normalized = value.trim().toLowerCase();
	return EVENT_KEY_PATTERN.test(normalized) ? normalized : null;
};

export const generateEventKeyFromRow = (
	row: Record<string, string>,
	options?: {
		stableKeys?: readonly string[];
		salt?: number;
		hashLength?: number;
	},
): string => {
	const stableKeys = options?.stableKeys;
	const salt = Math.max(0, options?.salt ?? 0);
	const hashLength = clampHashLength(
		options?.hashLength ?? EVENT_KEY_DEFAULT_HASH_LENGTH,
	);
	const fingerprint = buildFingerprint(row, stableKeys);
	const payload = salt > 0 ? `${fingerprint}|salt:${salt}` : fingerprint;
	const hash = createHash("sha256").update(payload).digest("hex");
	return `evt_${hash.slice(0, hashLength)}`;
};

type KeyedRow = {
	eventKey?: string | null;
} & Record<string, unknown>;

export const ensureUniqueEventKeys = <TRow extends KeyedRow>(
	rows: readonly TRow[],
	options?: {
		stableKeys?: readonly string[];
	},
): {
	rows: Array<TRow & { eventKey: string }>;
	missingEventKeyCount: number;
	generatedEventKeyCount: number;
} => {
	const used = new Set<string>();
	const nextRows: Array<TRow & { eventKey: string }> = [];
	let missingEventKeyCount = 0;
	let generatedEventKeyCount = 0;

	for (const row of rows) {
		const normalizedExisting = normalizeEventKey(
			typeof row.eventKey === "string" ? row.eventKey : null,
		);
		const sourceRow = toStringRecord(row);
		let resolvedKey = normalizedExisting;

		if (!resolvedKey || used.has(resolvedKey)) {
			if (!normalizedExisting) {
				missingEventKeyCount += 1;
			}

			let salt = 0;
			let generated = generateEventKeyFromRow(sourceRow, {
				stableKeys: options?.stableKeys,
				salt,
			});
			while (used.has(generated)) {
				salt += 1;
				generated = generateEventKeyFromRow(sourceRow, {
					stableKeys: options?.stableKeys,
					salt,
				});
			}
			resolvedKey = generated;
			generatedEventKeyCount += 1;
		}

		used.add(resolvedKey);
		nextRows.push({
			...row,
			eventKey: resolvedKey,
		});
	}

	return {
		rows: nextRows,
		missingEventKeyCount,
		generatedEventKeyCount,
	};
};

export const buildEventSlug = (name: string): string => {
	const normalized = normalizeForFingerprint(name)
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	const trimmed = normalized.slice(0, 80).replace(/-+$/g, "");
	return trimmed || "event";
};

