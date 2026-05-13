"use client";

import { useOptionalAuth } from "@/features/auth/auth-context";
import { EventsSearchFiltersProvider } from "@/features/events/components/events-search-filters-provider";
import { SavedEventsProvider } from "@/features/events/components/saved-events-provider";
import type { SpotlightRotationContext } from "@/features/events/featured/selection";
import type { ReactNode, RefObject } from "react";
import { Suspense, lazy, useCallback, useRef, useState } from "react";

const EmailGateModal = lazy(
	() => import("@/features/auth/components/EmailGateModal"),
);

const NoopSuspenseFallback = (
	<span className="sr-only" aria-hidden="true">
		Loading
	</span>
);

interface AuthGatedControlsValue {
	allEventsRef: RefObject<HTMLDivElement | null>;
	authMode: string;
	canUseProtectedDiscovery: boolean;
	isAuthResolved: boolean;
	isAuthenticated: boolean;
	isOnline: boolean;
	offlineGraceExpiresAt: number | null;
	onAuthRequired: () => void;
}

interface AuthGatedControlsIslandProps {
	children: (authControls: AuthGatedControlsValue) => ReactNode;
	spotlightRotationContext: SpotlightRotationContext;
}

export function AuthGatedControlsIsland({
	children,
	spotlightRotationContext,
}: AuthGatedControlsIslandProps) {
	const [showEmailGate, setShowEmailGate] = useState(false);
	const allEventsRef = useRef<HTMLDivElement>(null);
	const {
		isAuthenticated,
		isAuthResolved,
		isOnline,
		authMode,
		canUseProtectedDiscovery,
		offlineGraceExpiresAt,
		refreshSession,
	} = useOptionalAuth();

	const handleAuthRequired = useCallback(() => {
		if (!isOnline) return;
		setShowEmailGate(true);
	}, [isOnline]);

	const requireAuth = useCallback(() => {
		if (!canUseProtectedDiscovery) {
			handleAuthRequired();
			return false;
		}
		return true;
	}, [canUseProtectedDiscovery, handleAuthRequired]);

	const handleEmailSubmit = useCallback(async () => {
		const hasConfirmedSession = await refreshSession();
		if (hasConfirmedSession) {
			setShowEmailGate(false);
			return true;
		}

		await new Promise((resolve) => {
			setTimeout(resolve, 350);
		});
		const retryAfterDelay = await refreshSession();

		if (retryAfterDelay) {
			setShowEmailGate(false);
			return true;
		}
		return false;
	}, [refreshSession]);

	const scrollToAllEvents = useCallback(() => {
		allEventsRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
	}, []);

	const handleEmailGateClose = useCallback(() => {
		setShowEmailGate(false);
	}, []);

	return (
		<EventsSearchFiltersProvider
			canUseProtectedDiscovery={canUseProtectedDiscovery}
			isAuthenticated={isAuthenticated}
			onAuthRequired={handleAuthRequired}
			onScrollToAllEvents={scrollToAllEvents}
			requireAuth={requireAuth}
			initialSpotlightRotationContext={spotlightRotationContext}
		>
			<SavedEventsProvider>
				{children({
					allEventsRef,
					authMode,
					canUseProtectedDiscovery,
					isAuthResolved,
					isAuthenticated,
					isOnline,
					offlineGraceExpiresAt,
					onAuthRequired: handleAuthRequired,
				})}
			</SavedEventsProvider>
			{showEmailGate && (
				<Suspense fallback={NoopSuspenseFallback}>
					<EmailGateModal
						isOpen={showEmailGate}
						onClose={handleEmailGateClose}
						onEmailSubmit={handleEmailSubmit}
					/>
				</Suspense>
			)}
		</EventsSearchFiltersProvider>
	);
}
