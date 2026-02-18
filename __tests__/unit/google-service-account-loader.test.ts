import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

const restoreEnv = () => {
	process.env = { ...ORIGINAL_ENV };
	delete process.env.VERCEL;
	delete process.env.VERCEL_ENV;
};

const loadGoogleSheetsApi = async (config: {
	serviceAccountKey?: string;
	vercel?: string;
	vercelEnv?: string;
}) => {
	vi.resetModules();
	if (config.vercel !== undefined) {
		process.env.VERCEL = config.vercel;
	}
	if (config.vercelEnv !== undefined) {
		process.env.VERCEL_ENV = config.vercelEnv;
	}

	vi.doMock("@/lib/config/env", () => ({
		env: {
			GOOGLE_SERVICE_ACCOUNT_KEY: config.serviceAccountKey ?? "",
		},
	}));

	vi.doMock("@/lib/platform/logger", () => ({
		log: {
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		},
	}));

	return import("@/lib/google/sheets/api");
};

describe("google service account credential loading", () => {
	afterEach(() => {
		vi.clearAllMocks();
		restoreEnv();
	});

	it("rejects when GOOGLE_SERVICE_ACCOUNT_KEY is missing", async () => {
		const api = await loadGoogleSheetsApi({});

		await expect(api.loadServiceAccountCredentials()).rejects.toThrow(
			"GOOGLE_SERVICE_ACCOUNT_KEY is required for service account access.",
		);
	});

	it("loads credentials from GOOGLE_SERVICE_ACCOUNT_KEY JSON", async () => {
		const api = await loadGoogleSheetsApi({
			serviceAccountKey: JSON.stringify({
				client_email: "service-account@example.iam.gserviceaccount.com",
				private_key: "-----BEGIN PRIVATE KEY-----\nmock\n-----END PRIVATE KEY-----\n",
			}),
			vercel: "1",
			vercelEnv: "production",
		});

		const credentials = await api.loadServiceAccountCredentials();
		expect(credentials.client_email).toContain("@");
		expect(credentials.private_key).toContain("PRIVATE KEY");
	});
});
