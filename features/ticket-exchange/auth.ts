import "server-only";

import {
	USER_AUTH_COOKIE_NAME,
	getCanonicalUserSessionFromCookieHeader,
} from "@/features/auth/user-session-cookie";
import { cookies } from "next/headers";

export const getTicketExchangeSession = async () => {
	const cookieStore = await cookies();
	return getCanonicalUserSessionFromCookieHeader(
		cookieStore.get(USER_AUTH_COOKIE_NAME)?.value,
	);
};

