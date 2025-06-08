import React from "react";
import Header from "@/components/Header";
import { EventsClient } from "@/app/events-client";
import { CacheManager } from "@/lib/cache-management/cache-management";

// Use ISR with a reasonable revalidation time (e.g., 1 hour)
// This can be overridden with on-demand revalidation
export const revalidate = 3600; // 1 hour in seconds

// Make the page component async to allow server-side data fetching
export default async function Home() {
	// Fetch events using centralized cache manager
	const result = await CacheManager.getEvents();

	if (result.error) {
		console.error("Error loading events:", result.error);
		// You might want to show an error UI here
	}

	return (
		<div className="min-h-screen bg-background">
			<Header />
			<main className="container mx-auto px-4 py-8">
				<EventsClient initialEvents={result.data} />
			</main>
		</div>
	);
}
