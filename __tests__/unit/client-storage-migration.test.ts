import { migrateUserScopedLocalStorageKeys } from "@/features/auth/client-storage-migration";
import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

describe("client storage migration", () => {
	beforeEach(() => {
		storage.clear();
		vi.stubGlobal("window", {
			localStorage: {
				getItem: (key: string) => storage.get(key) ?? null,
				setItem: (key: string, value: string) => {
					storage.set(key, value);
				},
				removeItem: (key: string) => {
					storage.delete(key);
				},
			},
		});
	});

	it("moves user-scoped saved events and app settings from email to user id", () => {
		storage.set(
			"oooc:saved-events:v1:user:owen@example.com",
			JSON.stringify(["evt_1", "evt_2"]),
		);
		storage.set(
			"oooc:saved-events:v1:user:019b0000-0000-7000-8000-000000000001",
			JSON.stringify(["evt_2", "evt_3"]),
		);
		storage.set(
			"oooc_app_settings_profile_v1:user:owen@example.com",
			JSON.stringify({ themeMode: "dark" }),
		);
		storage.set("oooc_app_settings_active_profile_v1", "user:owen@example.com");

		migrateUserScopedLocalStorageKeys({
			email: " OWEN@EXAMPLE.COM ",
			userId: "019b0000-0000-7000-8000-000000000001",
		});

		expect(
			storage.get("oooc:saved-events:v1:user:owen@example.com"),
		).toBeUndefined();
		expect(
			JSON.parse(
				storage.get(
					"oooc:saved-events:v1:user:019b0000-0000-7000-8000-000000000001",
				) ?? "[]",
			),
		).toEqual(["evt_2", "evt_3", "evt_1"]);
		expect(
			storage.get("oooc_app_settings_profile_v1:user:owen@example.com"),
		).toBeUndefined();
		expect(
			storage.get(
				"oooc_app_settings_profile_v1:user:019b0000-0000-7000-8000-000000000001",
			),
		).toBe(JSON.stringify({ themeMode: "dark" }));
		expect(storage.get("oooc_app_settings_active_profile_v1")).toBe(
			"user:019b0000-0000-7000-8000-000000000001",
		);
	});
});
