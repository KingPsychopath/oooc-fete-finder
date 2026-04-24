import { log } from "@/lib/platform/logger";

export async function fetchLocalCSV(): Promise<string> {
	const fs = await import("fs/promises");
	const path = await import("path");

	const csvPath = path.join(process.cwd(), "data", "events.csv");

	try {
		log.info("data-fetch", "Loading local CSV", { path: csvPath });
		const csvContent = await fs.readFile(csvPath, "utf-8");

		if (!csvContent || csvContent.trim().length === 0) {
			throw new Error("Local CSV file is empty");
		}

		const rowCount = csvContent.split("\n").length - 1;
		log.info("data-fetch", "Loaded local CSV", { rowCount });
		return csvContent;
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : "Unknown error";

		if (errorMessage.includes("ENOENT")) {
			log.error(
				"data-fetch",
				"Local CSV file not found",
				{ path: csvPath },
				error,
			);
		}

		throw new Error(`Failed to read local CSV: ${errorMessage}`);
	}
}
