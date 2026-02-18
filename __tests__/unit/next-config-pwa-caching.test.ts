import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const NEXT_CONFIG_PATH = path.resolve(process.cwd(), "next.config.ts");

describe("next-pwa runtime caching guardrails", () => {
	it("keeps sensitive APIs network-only and avoids broad over-caching rules", () => {
		const configSource = fs.readFileSync(NEXT_CONFIG_PATH, "utf8");

		expect(configSource).toContain("urlPattern: /\\/api\\/auth\\/.*$/i");
		expect(configSource).toContain("urlPattern: /\\/api\\/admin\\/.*$/i");
		expect(configSource).toContain('handler: "NetworkOnly"');
		expect(configSource).toContain('request.mode === "navigate"');
		expect(configSource).not.toContain("/^https://.*\\.(?:json)$/i");
		expect(configSource).not.toContain("urlPattern: /.*/");
	});
});
