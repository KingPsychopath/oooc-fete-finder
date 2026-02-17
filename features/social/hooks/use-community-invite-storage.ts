"use client";

import { useCallback, useEffect, useState } from "react";
import { COMMUNITY_INVITE_CONFIG } from "../config";
import type {
	UseCommunityInviteStorageOptions,
	CommunityInviteStorageReturn,
} from "../types";

const COOKIE_MAX_AGE_DAYS = 4;
const COOKIE_MAX_AGE_SECONDS = COOKIE_MAX_AGE_DAYS * 24 * 60 * 60;

type CookieState = {
	d?: number; // dismissedAt
	c?: number; // clickedAt
};

function getCookie(name: string): string | null {
	if (typeof document === "undefined") return null;
	const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAgeSeconds: number): void {
	if (typeof document === "undefined") return;
	document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAgeSeconds}; SameSite=Lax`;
}

export function useCommunityInviteStorage({
	delayAfterChatClick = COMMUNITY_INVITE_CONFIG.DELAYS.AFTER_CHAT_CLICK,
	delayAfterDismiss = COMMUNITY_INVITE_CONFIG.DELAYS.AFTER_DISMISS,
	initialDelay = COMMUNITY_INVITE_CONFIG.DELAYS.INITIAL_DELAY,
}: UseCommunityInviteStorageOptions = {}): CommunityInviteStorageReturn {
	const [shouldShow, setShouldShow] = useState(false);
	const [forceUpdate, setForceUpdate] = useState(0);
	const cookieName = COMMUNITY_INVITE_CONFIG.COOKIE_NAME;

	const getState = useCallback((): CookieState => {
		const raw = getCookie(cookieName);
		if (!raw) return {};
		try {
			const parsed = JSON.parse(raw) as CookieState;
			return typeof parsed === "object" && parsed !== null ? parsed : {};
		} catch {
			return {};
		}
	}, [cookieName]);

	const setState = useCallback(
		(state: CookieState): void => {
			setCookie(cookieName, JSON.stringify(state), COOKIE_MAX_AGE_SECONDS);
		},
		[cookieName],
	);

	const checkShouldShow = useCallback((): boolean => {
		const { d: dismissedAt, c: clickedAt } = getState();
		const now = Date.now();

		if (clickedAt != null && now - clickedAt < delayAfterChatClick) {
			return false;
		}
		if (dismissedAt != null && now - dismissedAt < delayAfterDismiss) {
			return false;
		}
		return true;
	}, [delayAfterChatClick, delayAfterDismiss, getState]);

	const markChatClicked = useCallback((): void => {
		setState({ c: Date.now() });
		setForceUpdate((prev) => prev + 1);
	}, [setState]);

	const markDismissed = useCallback((): void => {
		setState({ d: Date.now() });
		setForceUpdate((prev) => prev + 1);
	}, [setState]);

	const clearStorage = useCallback((): void => {
		setCookie(cookieName, "", 0);
		setForceUpdate((prev) => prev + 1);
	}, [cookieName]);

	useEffect(() => {
		const timer = setTimeout(() => setShouldShow(checkShouldShow()), initialDelay);
		return () => clearTimeout(timer);
	}, [initialDelay, checkShouldShow]);

	useEffect(() => {
		if (forceUpdate > 0) setShouldShow(checkShouldShow());
	}, [forceUpdate, checkShouldShow]);

	return {
		shouldShow,
		markChatClicked,
		markDismissed,
		clearStorage,
		checkShouldShow,
	};
}
