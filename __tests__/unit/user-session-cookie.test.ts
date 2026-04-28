import {
	getUserAuthCookieOptions,
	getUserSessionFromCookieHeader,
	signUserSessionToken,
} from "@/features/auth/user-session-cookie";
import { describe, expect, it } from "vitest";

describe("user session cookie helpers", () => {
	it("signs a normalized 30-day user session token", () => {
		const token = signUserSessionToken("  OWEN@example.com ");
		const session = getUserSessionFromCookieHeader(token);

		expect(session).toEqual({
			isAuthenticated: true,
			email: "owen@example.com",
		});
		expect(getUserAuthCookieOptions()).toMatchObject({
			httpOnly: true,
			sameSite: "lax",
			path: "/",
			maxAge: 60 * 60 * 24 * 30,
		});
	});

	it("rejects missing or tampered tokens", () => {
		const token = signUserSessionToken("owen@example.com");
		const tamperedToken = `${token.slice(0, -1)}x`;

		expect(getUserSessionFromCookieHeader(undefined)).toEqual({
			isAuthenticated: false,
			email: null,
		});
		expect(getUserSessionFromCookieHeader(tamperedToken)).toEqual({
			isAuthenticated: false,
			email: null,
		});
	});
});
