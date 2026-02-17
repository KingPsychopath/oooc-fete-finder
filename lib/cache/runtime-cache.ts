type LoaderResult<TValue, TMeta> = {
	value: TValue;
	meta: TMeta;
};

type RuntimeCacheState<TValue, TMeta> = {
	value: TValue | null;
	lastLoadedAt: number;
	lastSuccessAt: number;
	lastErrorMessage: string;
	meta: TMeta | null;
	inflight: Promise<LoaderResult<TValue, TMeta>> | null;
};

type RuntimeCacheOptions<TValue, TMeta> = {
	ttlMs: number;
	estimateBytes?: (value: TValue | null) => number;
	initialMeta?: TMeta;
};

export class RuntimeCache<TValue, TMeta> {
	private readonly ttlMs: number;
	private readonly estimateBytes: (value: TValue | null) => number;
	private readonly initialMeta: TMeta | null;
	private readonly state: RuntimeCacheState<TValue, TMeta>;

	constructor(options: RuntimeCacheOptions<TValue, TMeta>) {
		this.ttlMs = options.ttlMs;
		this.estimateBytes = options.estimateBytes ?? (() => 0);
		this.initialMeta = options.initialMeta ?? null;
		this.state = {
			value: null,
			lastLoadedAt: 0,
			lastSuccessAt: 0,
			lastErrorMessage: "",
			meta: this.initialMeta,
			inflight: null,
		};
	}

	private isFresh(): boolean {
		if (this.state.value === null || this.state.lastLoadedAt === 0) return false;
		return Date.now() - this.state.lastLoadedAt < this.ttlMs;
	}

	private async runLoader(
		loader: () => Promise<LoaderResult<TValue, TMeta>>,
	): Promise<LoaderResult<TValue, TMeta>> {
		if (this.state.inflight) {
			return this.state.inflight;
		}

		const request = loader()
			.then((result) => {
				this.state.value = result.value;
				this.state.meta = result.meta;
				this.state.lastLoadedAt = Date.now();
				this.state.lastSuccessAt = this.state.lastLoadedAt;
				this.state.lastErrorMessage = "";
				return result;
			})
			.catch((error) => {
				this.state.lastErrorMessage =
					error instanceof Error ? error.message : "Unknown cache loader error";
				throw error;
			})
			.finally(() => {
				if (this.state.inflight === request) {
					this.state.inflight = null;
				}
			});

		this.state.inflight = request;
		return request;
	}

	async get(
		loader: () => Promise<LoaderResult<TValue, TMeta>>,
		options?: { forceRefresh?: boolean },
	): Promise<{ value: TValue; meta: TMeta; fromCache: boolean }> {
		const forceRefresh = Boolean(options?.forceRefresh);
		if (!forceRefresh && this.isFresh() && this.state.value !== null && this.state.meta) {
			return { value: this.state.value, meta: this.state.meta, fromCache: true };
		}

		const loaded = await this.runLoader(loader);
		return { value: loaded.value, meta: loaded.meta, fromCache: false };
	}

	setError(message: string): void {
		this.state.lastErrorMessage = message;
	}

	setStaleMeta(meta: TMeta): void {
		this.state.meta = meta;
	}

	getSnapshot(): {
		value: TValue | null;
		meta: TMeta | null;
		lastLoadedAt: number;
		lastSuccessAt: number;
		lastErrorMessage: string;
		memoryUsageBytes: number;
	} {
		return {
			value: this.state.value,
			meta: this.state.meta,
			lastLoadedAt: this.state.lastLoadedAt,
			lastSuccessAt: this.state.lastSuccessAt,
			lastErrorMessage: this.state.lastErrorMessage,
			memoryUsageBytes: this.estimateBytes(this.state.value),
		};
	}

	clear(): void {
		this.state.value = null;
		this.state.lastLoadedAt = 0;
		this.state.lastSuccessAt = 0;
		this.state.lastErrorMessage = "";
		this.state.meta = this.initialMeta;
		this.state.inflight = null;
	}
}
