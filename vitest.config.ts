import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		include: ["lib/**/*.test.ts"],
		exclude: ["node_modules", ".next", "dist"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: [
				"lib/data-management/**/*.ts",
				"lib/platform/postgres/**/*.ts",
			],
		},
	},
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
			"server-only": path.resolve(__dirname, "test/mocks/server-only.ts"),
		},
	},
});
