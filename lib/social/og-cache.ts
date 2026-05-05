import "server-only";

import { getKVStore } from "@/lib/platform/kv/kv-store-factory";
import { log } from "@/lib/platform/logger";

export const OG_IMAGE_CACHE_PREFIX = "og-image:v3:";

export const purgeOGImageCache = async (): Promise<number> => {
	try {
		const kv = await getKVStore();
		const keys = await kv.list(OG_IMAGE_CACHE_PREFIX);
		await Promise.all(keys.map((key) => kv.delete(key)));
		return keys.length;
	} catch (error) {
		log.warn("og-image", "Unable to purge OG image cache", {
			error: error instanceof Error ? error.message : "unknown",
		});
		return 0;
	}
};
