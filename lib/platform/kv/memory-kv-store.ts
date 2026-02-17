import type { KeyValueStore } from "./kv-types";

export class MemoryKVStore implements KeyValueStore {
	private readonly data = new Map<string, string>();

	async get(key: string): Promise<string | null> {
		return this.data.get(key) ?? null;
	}

	async set(key: string, value: string): Promise<void> {
		this.data.set(key, value);
	}

	async delete(key: string): Promise<void> {
		this.data.delete(key);
	}

	async list(prefix = ""): Promise<string[]> {
		const keys = Array.from(this.data.keys());
		if (!prefix) {
			return keys.sort((left, right) => left.localeCompare(right));
		}
		return keys
			.filter((key) => key.startsWith(prefix))
			.sort((left, right) => left.localeCompare(right));
	}
}
