import {
	getUserAuthCookieOptions,
	getUserSessionFromCookieHeader,
	signUserSessionToken,
} from "@/features/auth/user-session-cookie";
import { describe, expect, it } from "vitest";

describe("user session cookie helpers", () => {
	it("signs a normalized 30-day user session token", () => {
		const token = signUserSessionToken(
			"  OWEN@example.com ",
			"019b0000-0000-7000-8000-000000000001",
		);
		const session = getUserSessionFromCookieHeader(token);

		expect(session).toEqual({
			isAuthenticated: true,
			email: "owen@example.com",
			userId: "019b0000-0000-7000-8000-000000000001",
		});
		expect(getUserAuthCookieOptions()).toMatchObject({
			httpOnly: true,
			sameSite: "lax",
			path: "/",
			maxAge: 60 * 60 * 24 * 30,
		});
	});

	it("rejects missing or tampered tokens", () => {
		const token = signUserSessionToken(
			"owen@example.com",
			"019b0000-0000-7000-8000-000000000001",
		);
		const tamperedToken = `${token.slice(0, -1)}x`;

		expect(getUserSessionFromCookieHeader(undefined)).toEqual({
			isAuthenticated: false,
			email: null,
			userId: null,
		});
		expect(getUserSessionFromCookieHeader(tamperedToken)).toEqual({
			isAuthenticated: false,
			email: null,
			userId: null,
		});
	});

	it("preserves a canonical user id in v2 tokens", () => {
		const token = signUserSessionToken(
			"owen@example.com",
			"019b0000-0000-7000-8000-000000000001",
		);

		expect(getUserSessionFromCookieHeader(token)).toEqual({
			isAuthenticated: true,
			email: "owen@example.com",
			userId: "019b0000-0000-7000-8000-000000000001",
		});
	});

	it("requires a valid user id when signing", () => {
		expect(() => signUserSessionToken("owen@example.com", "")).toThrow(
			"A valid userId is required",
		);
	});
});
