import { getUserProfileStorageKey } from "@/features/auth/user-profile-storage-key";
import { describe, expect, it } from "vitest";

describe("user profile storage key", () => {
	it("prefers the authenticated user id when available", () => {
		expect(
			getUserProfileStorageKey({
				userId: "  019b0000-0000-7000-8000-000000000001  ",
				email: "USER@Example.com",
				isAuthenticated: true,
				anonymousKey: "anon",
			}),
		).toBe("user:019b0000-0000-7000-8000-000000000001");
	});

	it("falls back to normalized email for legacy authenticated sessions", () => {
		expect(
			getUserProfileStorageKey({
				userId: null,
				email: "USER@Example.com",
				isAuthenticated: true,
				anonymousKey: "anon",
			}),
		).toBe("user:user@example.com");
	});

	it("uses the feature's anonymous key when the user is signed out or email is blank", () => {
		expect(
			getUserProfileStorageKey({
				userId: "019b0000-0000-7000-8000-000000000001",
				email: "user@example.com",
				isAuthenticated: false,
				anonymousKey: "anon",
			}),
		).toBe("anon");
		expect(
			getUserProfileStorageKey({
				userId: " ",
				email: " ",
				isAuthenticated: true,
				anonymousKey: "anonymous",
			}),
		).toBe("anonymous");
	});
});
