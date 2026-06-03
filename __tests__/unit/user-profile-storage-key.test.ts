import { getUserProfileStorageKey } from "@/features/auth/user-profile-storage-key";
import { describe, expect, it } from "vitest";

describe("user profile storage key", () => {
	it("prefers the authenticated user id when available", () => {
		expect(
				getUserProfileStorageKey({
					userId: "  019b0000-0000-7000-8000-000000000001  ",
					isAuthenticated: true,
					anonymousKey: "anon",
				}),
		).toBe("user:019b0000-0000-7000-8000-000000000001");
	});

	it("uses the anonymous key when an authenticated session has no user id", () => {
		expect(
			getUserProfileStorageKey({
				userId: null,
				isAuthenticated: true,
				anonymousKey: "anon",
			}),
		).toBe("anon");
	});

	it("uses the feature's anonymous key when the user is signed out or email is blank", () => {
		expect(
				getUserProfileStorageKey({
					userId: "019b0000-0000-7000-8000-000000000001",
					isAuthenticated: false,
					anonymousKey: "anon",
				}),
		).toBe("anon");
		expect(
				getUserProfileStorageKey({
					userId: " ",
					isAuthenticated: true,
					anonymousKey: "anonymous",
				}),
		).toBe("anonymous");
	});
});
