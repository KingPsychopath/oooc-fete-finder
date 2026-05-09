"use client";

import { useEventsOffline } from "@/features/events/components/events-offline-provider";
import { useMemo } from "react";

export function EventsDataStatusBanner() {
	const {
		events,
		eventDataSource,
		eventSnapshotError,
		eventSnapshotFreshness,
		eventSnapshotSavedAt,
		eventSnapshotSyncState,
	} = useEventsOffline();
	const savedAtLabel = useMemo(() => {
		if (!eventSnapshotSavedAt) return null;
		try {
			return new Intl.DateTimeFormat(undefined, {
				month: "short",
				day: "numeric",
				hour: "numeric",
				minute: "2-digit",
			}).format(new Date(eventSnapshotSavedAt));
		} catch {
			return null;
		}
	}, [eventSnapshotSavedAt]);

	if (eventSnapshotFreshness === "error") {
		return (
			<div className="mb-6 rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
				<strong>Saved events unavailable:</strong>{" "}
				{eventSnapshotError ??
					"Your saved event snapshot could not be read or updated."}{" "}
				Live browsing will continue when the network is available.
			</div>
		);
	}

	if (
		eventSnapshotFreshness === "missing" &&
		(eventDataSource !== "live" || events.length === 0)
	) {
		return (
			<div className="mb-6 rounded-md border border-border/70 bg-background/75 px-4 py-3 text-sm text-muted-foreground">
				<strong>No saved events yet:</strong> Reconnect once to save event data
				for offline browsing.
			</div>
		);
	}

	if (eventDataSource !== "saved" || !savedAtLabel) return null;

	const isStale = eventSnapshotFreshness === "stale";

	return (
		<div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
			<strong>{isStale ? "Stale saved events:" : "Saved events:"}</strong> You
			are viewing {isStale ? "an older" : "the latest"} saved event snapshot
			from {savedAtLabel}. Some live details may be unavailable until you are
			back online.
			{eventSnapshotSyncState === "refreshing" ? (
				<span> Refreshing saved event data…</span>
			) : null}
		</div>
	);
}
