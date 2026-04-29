import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	POST: typeof import("@/app/api/admin/music-genre-taxonomy/route").POST;
	validateAdminKeyForApiRoute: ReturnType<typeof vi.fn>;
	createMusicGenreFromEditor: ReturnType<typeof vi.fn>;
	mapMusicGenreAliasFromEditor: ReturnType<typeof vi.fn>;
};

const loadRoute = async (): Promise<Setup> => {
	vi.resetModules();

	const validateAdminKeyForApiRoute = vi.fn().mockResolvedValue(true);
	const createMusicGenreFromEditor = vi.fn().mockResolvedValue({
		success: true,
		genreKey: "soca",
		genreTaxonomy: { genres: [], aliases: [] },
		message: "Soca added to the genre list",
	});
	const removeMusicGenreFromEditor = vi.fn().mockResolvedValue({
		success: true,
		genreTaxonomy: { genres: [], aliases: [] },
	});
	const mapMusicGenreAliasFromEditor = vi.fn().mockResolvedValue({
		success: true,
		genreTaxonomy: { genres: [], aliases: [] },
	});
	const removeMusicGenreAliasFromEditor = vi.fn().mockResolvedValue({
		success: true,
		genreTaxonomy: { genres: [], aliases: [] },
	});

	vi.doMock("@/features/auth/admin-validation", () => ({
		validateAdminKeyForApiRoute,
	}));
	vi.doMock("@/features/data-management/actions", () => ({
		createMusicGenreFromEditor,
		removeMusicGenreFromEditor,
		mapMusicGenreAliasFromEditor,
		removeMusicGenreAliasFromEditor,
	}));

	const route = await import("@/app/api/admin/music-genre-taxonomy/route");
	return {
		POST: route.POST,
		validateAdminKeyForApiRoute,
		createMusicGenreFromEditor,
		mapMusicGenreAliasFromEditor,
	};
};

describe("/api/admin/music-genre-taxonomy route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("requires admin auth before mutating taxonomy", async () => {
		const { POST, validateAdminKeyForApiRoute, createMusicGenreFromEditor } =
			await loadRoute();
		validateAdminKeyForApiRoute.mockResolvedValue(false);

		const response = await POST(
			new NextRequest("https://example.com/api/admin/music-genre-taxonomy", {
				method: "POST",
				body: JSON.stringify({ action: "create-genre", label: "Soca" }),
			}),
		);

		expect(response.status).toBe(401);
		expect(createMusicGenreFromEditor).not.toHaveBeenCalled();
		expect(response.headers.get("cache-control")).toContain("no-store");
	});

	it("creates genres through the stable route contract", async () => {
		const { POST, createMusicGenreFromEditor } = await loadRoute();

		const response = await POST(
			new NextRequest("https://example.com/api/admin/music-genre-taxonomy", {
				method: "POST",
				headers: { authorization: "Bearer admin-token" },
				body: JSON.stringify({ action: "create-genre", label: "Soca" }),
			}),
		);
		const payload = (await response.json()) as {
			success: boolean;
			genreKey: string;
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.genreKey).toBe("soca");
		expect(createMusicGenreFromEditor).toHaveBeenCalledWith(
			"Soca",
			"admin-token",
		);
		expect(response.headers.get("cache-control")).toContain("no-store");
	});

	it("maps aliases only when required fields are present", async () => {
		const { POST, mapMusicGenreAliasFromEditor } = await loadRoute();

		const response = await POST(
			new NextRequest("https://example.com/api/admin/music-genre-taxonomy", {
				method: "POST",
				body: JSON.stringify({ action: "map-alias", alias: "Afro" }),
			}),
		);
		const payload = (await response.json()) as {
			success: boolean;
			error: string;
		};

		expect(response.status).toBe(400);
		expect(payload.success).toBe(false);
		expect(payload.error).toBe("Choose an unknown genre and a target genre");
		expect(mapMusicGenreAliasFromEditor).not.toHaveBeenCalled();
	});
});
