import { getUserProfileStorageKey } from "@/features/auth/user-profile-storage-key";
import { describe, expect, it } from "vitest";

describe("user profile storage key", () => {
	it("uses the normalized authenticated user key when an email is available", () => {
		expect(
			getUserProfileStorageKey({
				email: "USER@Example.com",
				isAuthenticated: true,
				anonymousKey: "anon",
			}),
		).toBe("user:user@example.com");
	});

	it("uses the feature's anonymous key when the user is signed out or email is blank", () => {
		expect(
			getUserProfileStorageKey({
				email: "user@example.com",
				isAuthenticated: false,
				anonymousKey: "anon",
			}),
		).toBe("anon");
		expect(
			getUserProfileStorageKey({
				email: " ",
				isAuthenticated: true,
				anonymousKey: "anonymous",
			}),
		).toBe("anonymous");
	});
});
