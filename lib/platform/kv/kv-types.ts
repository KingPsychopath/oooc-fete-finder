export interface KeyValueStore {
	get(key: string): Promise<string | null>;
	set(key: string, value: string): Promise<void>;
	delete(key: string): Promise<void>;
	list(prefix?: string): Promise<string[]>;
}

export interface KVProviderInfo {
	provider: "file" | "memory" | "postgres";
	location: string;
}
