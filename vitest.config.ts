import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		include: ["__tests__/unit/**/*.test.ts", "__tests__/integration/**/*.test.ts"],
		exclude: ["node_modules", ".next", "dist"],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			include: [
				"features/data-management/**/*.ts",
				"lib/platform/postgres/**/*.ts",
				"features/auth/**/*.ts",
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
