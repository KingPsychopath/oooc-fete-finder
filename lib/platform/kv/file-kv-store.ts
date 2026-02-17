import "server-only";

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { KeyValueStore } from "./kv-types";

type FileKVPayload = {
	version: 1;
	updatedAt: string;
	data: Record<string, string>;
};

const EMPTY_PAYLOAD: FileKVPayload = {
	version: 1,
	updatedAt: new Date(0).toISOString(),
	data: {},
};

export class FileKVStore implements KeyValueStore {
	private lock: Promise<void> = Promise.resolve();
	private readonly absoluteFilePath: string;

	constructor(filePath: string) {
		this.absoluteFilePath = path.resolve(filePath);
	}

	private async ensureFile(): Promise<void> {
		const dir = path.dirname(this.absoluteFilePath);
		await mkdir(dir, { recursive: true });
		try {
			await readFile(this.absoluteFilePath, "utf8");
		} catch {
			await writeFile(
				this.absoluteFilePath,
				JSON.stringify(EMPTY_PAYLOAD, null, 2),
				"utf8",
			);
		}
	}

	private async readPayload(): Promise<FileKVPayload> {
		await this.ensureFile();
		const raw = await readFile(this.absoluteFilePath, "utf8");
		try {
			const parsed = JSON.parse(raw) as Partial<FileKVPayload>;
			if (!parsed || typeof parsed !== "object") {
				return { ...EMPTY_PAYLOAD };
			}
			if (!parsed.data || typeof parsed.data !== "object") {
				return { ...EMPTY_PAYLOAD };
			}
			return {
				version: 1,
				updatedAt:
					typeof parsed.updatedAt === "string"
						? parsed.updatedAt
						: new Date().toISOString(),
				data: Object.fromEntries(
					Object.entries(parsed.data).map(([key, value]) => [
						key,
						typeof value === "string" ? value : JSON.stringify(value),
					]),
				),
			};
		} catch {
			return { ...EMPTY_PAYLOAD };
		}
	}

	private async writePayload(payload: FileKVPayload): Promise<void> {
		await writeFile(this.absoluteFilePath, JSON.stringify(payload, null, 2), "utf8");
	}

	private async withLock<T>(task: () => Promise<T>): Promise<T> {
		const run = this.lock.then(task, task);
		this.lock = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}

	async get(key: string): Promise<string | null> {
		return this.withLock(async () => {
			const payload = await this.readPayload();
			return payload.data[key] ?? null;
		});
	}

	async set(key: string, value: string): Promise<void> {
		await this.withLock(async () => {
			const payload = await this.readPayload();
			payload.data[key] = value;
			payload.updatedAt = new Date().toISOString();
			await this.writePayload(payload);
		});
	}

	async delete(key: string): Promise<void> {
		await this.withLock(async () => {
			const payload = await this.readPayload();
			delete payload.data[key];
			payload.updatedAt = new Date().toISOString();
			await this.writePayload(payload);
		});
	}

	async list(prefix = ""): Promise<string[]> {
		return this.withLock(async () => {
			const payload = await this.readPayload();
			const keys = Object.keys(payload.data);
			if (!prefix) {
				return keys.sort((left, right) => left.localeCompare(right));
			}
			return keys
				.filter((key) => key.startsWith(prefix))
				.sort((left, right) => left.localeCompare(right));
		});
	}
}
