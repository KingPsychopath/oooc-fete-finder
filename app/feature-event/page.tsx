/**
 * Feature Event Page - Countdown Implementation
 *
 * This page shows a real countdown for currently featured events based on timestamps
 * from your Excel/Google Sheets data.
 *
 * SETUP REQUIRED:
 * 1. Use the "Featured" column in your spreadsheet
 * 2. For timestamp-based featuring: Enter a valid timestamp (automatic expiration)
 * 3. For manual featuring: Enter any text like "Yes", "urgent", etc. (permanent until removed)
 * 4. Supported timestamp formats (UK format prioritized for European app):
 *    - ISO format: "2025-06-07T20:00:00" (RECOMMENDED - no ambiguity)
 *    - Month name: "7-Jun-2025 20:00:00" or "Jun-7-2025 20:00:00"
 *    - ISO without T: "2025-06-07 20:00:00"
 *    - UK Excel format: "07/06/2025 20:00:00" (DD/MM/YYYY - prioritized)
 *    - US Excel format: "06/07/2025 20:00:00" (MM/DD/YYYY - only if unambiguous)
 *
 * HOW IT WORKS:
 * - The system auto-detects if "Featured" column contains a timestamp or text
 * - Timestamp values (past/present): Start featuring from that time, expire after 48 hours
 * - Timestamp values (future): Start featuring NOW, expire after 48 hours (future dates auto-corrected)
 * - Text values: Display permanently with green theme until manually removed
 * - Shows real-time countdown for timestamp-based featured events
 *
 * IMPORTANT: Featured column = WHEN TO START FEATURING, not the event date!
 */

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Euro, Star, CheckCircle, Calendar, Target, Copy } from "lucide-react";
import { FEATURED_EVENTS_CONFIG } from "@/components/featured-events/constants";
import { FeatureCountdown } from "@/components/featured-events/components/FeatureCountdown";
import { getFeaturedEvents } from "@/lib/events/events-service";
import Link from "next/link";
import type { Metadata } from "next";
import { CopyEmailButton } from "./components/CopyEmailButton";

export const metadata: Metadata = {
	title: "Feature Your Event | OOOC Fete Finder",
	description: `Get maximum visibility for your Paris event with our featured placement. Only €${FEATURED_EVENTS_CONFIG.FEATURE_PRICE} for ${FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours of top placement.`,
	keywords: [
		"feature event",
		"paris events",
		"event promotion",
		"event marketing",
	],
};

export default async function FeatureEventPage() {
	// Get current featured events to show real countdown
	const featuredEvents = await getFeaturedEvents();

	return (
		<div className="container mx-auto px-4 py-8 max-w-4xl">
			{/* Header */}
			<div className="text-center mb-8">
				<h1 className="text-4xl font-bold mb-4">Feature Your Event</h1>
				<p className="text-lg text-muted-foreground">
					Get maximum visibility for your event in Paris with our featured
					placement
				</p>
			</div>

			{/* Current Feature Period Status */}
			<FeatureCountdown featuredEvents={featuredEvents} />

			{/* Setup Instructions (only show if no valid featured events) */}
			{featuredEvents.length === 0 && (
				<Card className="mb-8 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
					<CardHeader>
						<CardTitle>💡 How to Feature Events</CardTitle>
					</CardHeader>
					<CardContent>
						<ol className="list-decimal list-inside space-y-2 text-sm">
							<li>Use the "Featured" column in your Excel/Google Sheets</li>
							<li>
								<strong>For automatic expiration:</strong> Enter when to START
								featuring
								<br />
								<span className="text-xs text-green-600 ml-4">
									✅ Now: "2025-01-18T10:30:00" (current time to start
									immediately)
								</span>
								<br />
								<span className="text-xs text-blue-600 ml-4">
									📍 UK format: "18/01/2025 10:30:00" = Start featuring on 18th
									Jan (DD/MM/YYYY)
								</span>
								<br />
								<span className="text-xs text-purple-600 ml-4">
									🔄 Future dates: Automatically start featuring NOW instead of
									waiting
								</span>
								<br />
								<span className="text-xs text-orange-600 ml-4">
									⚠️ Don't put event date here - this is for FEATURING start
									time!
								</span>
							</li>
							<li>
								<strong>For permanent featuring:</strong> Enter any text (e.g.,
								"Yes", "urgent", "premium")
							</li>
							<li>
								The system automatically detects the type and shows appropriate
								countdown/status
							</li>
						</ol>
						<p className="text-xs text-muted-foreground mt-3">
							Timestamp-based events expire after{" "}
							{FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours. Text-based
							events stay featured until manually removed.
						</p>
					</CardContent>
				</Card>
			)}

			<div className="grid md:grid-cols-2 gap-8 mb-8">
				{/* Pricing Card */}
				<Card className="border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800">
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Euro className="h-5 w-5 text-green-600" />
							Simple Pricing
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold text-green-700 dark:text-green-300 mb-2">
							€{FEATURED_EVENTS_CONFIG.FEATURE_PRICE}
						</div>
						<p className="text-sm text-muted-foreground mb-4">
							One-time payment for{" "}
							{FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours of featured
							placement
						</p>
						<div className="space-y-2">
							<div className="flex items-center gap-2 text-sm">
								<CheckCircle className="h-4 w-4 text-green-600" />
								<span>Top placement in Featured Events section</span>
							</div>
							<div className="flex items-center gap-2 text-sm">
								<CheckCircle className="h-4 w-4 text-green-600" />
								<span>Increased visibility on homepage and search results</span>
							</div>
							<div className="flex items-center gap-2 text-sm">
								<CheckCircle className="h-4 w-4 text-green-600" />
								<span>Special featured badge (📌) on your event</span>
							</div>
						</div>
					</CardContent>
				</Card>

				{/* How It Works Card */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Star className="h-5 w-5 text-yellow-600" />
							How It Works
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="space-y-4">
							<div className="flex gap-3">
								<div className="bg-blue-100 dark:bg-blue-900 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">
									1
								</div>
								<div>
									<h4 className="font-semibold text-sm">Submit Payment</h4>
									<p className="text-sm text-muted-foreground">
										Pay €{FEATURED_EVENTS_CONFIG.FEATURE_PRICE} via our secure
										payment system
									</p>
								</div>
							</div>
							<div className="flex gap-3">
								<div className="bg-blue-100 dark:bg-blue-900 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">
									2
								</div>
								<div>
									<h4 className="font-semibold text-sm">Get Featured</h4>
									<p className="text-sm text-muted-foreground">
										Your event gets featured within 2 hours of payment
									</p>
								</div>
							</div>
							<div className="flex gap-3">
								<div className="bg-blue-100 dark:bg-blue-900 rounded-full w-6 h-6 flex items-center justify-center text-sm font-semibold">
									3
								</div>
								<div>
									<h4 className="font-semibold text-sm">Stay Featured</h4>
									<p className="text-sm text-muted-foreground">
										Remain featured for{" "}
										{FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours
										guaranteed
									</p>
								</div>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Benefits Section */}
			<Card className="mb-8">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Target className="h-5 w-5 text-purple-600" />
						Why Feature Your Event?
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid sm:grid-cols-2 gap-6">
						<div className="space-y-4">
							<div>
								<h4 className="font-semibold mb-2">🎯 Maximum Visibility</h4>
								<p className="text-sm text-muted-foreground">
									Featured events appear at the top of our homepage, getting 5x
									more views than regular listings.
								</p>
							</div>
							<div>
								<h4 className="font-semibold mb-2">📱 Mobile Optimized</h4>
								<p className="text-sm text-muted-foreground">
									Your featured event looks great on all devices, with special
									highlighting and badges.
								</p>
							</div>
						</div>
						<div className="space-y-4">
							<div>
								<h4 className="font-semibold mb-2">⚡ Instant Activation</h4>
								<p className="text-sm text-muted-foreground">
									No waiting periods - your event gets featured within 2 hours
									of payment confirmation.
								</p>
							</div>
							<div>
								<h4 className="font-semibold mb-2">📊 Analytics Included</h4>
								<p className="text-sm text-muted-foreground">
									<span className="line-through">
										Track clicks, views, and engagement for your featured event
										during the feature period.
									</span>
								</p>
								<div className="mt-2 px-3 py-1 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-md">
									<span className="text-sm font-semibold text-blue-700 dark:text-blue-300">
										🚀 Coming Soon
									</span>
								</div>
							</div>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* Feature Period Details */}
			<Card className="mb-8">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Calendar className="h-5 w-5 text-indigo-600" />
						Feature Period Details
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-3">
						<div className="flex justify-between items-center">
							<span className="font-medium">Feature Duration:</span>
							<Badge variant="secondary">
								{FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours
							</Badge>
						</div>
						<div className="flex justify-between items-center">
							<span className="font-medium">Maximum Featured Events:</span>
							<Badge variant="secondary">
								{FEATURED_EVENTS_CONFIG.MAX_FEATURED_EVENTS} at a time
							</Badge>
						</div>
						<div className="flex justify-between items-center">
							<span className="font-medium">Rotation Period:</span>
							<Badge variant="secondary">
								Every {FEATURED_EVENTS_CONFIG.FEATURE_DURATION_HOURS} hours
							</Badge>
						</div>
						<div className="flex justify-between items-center">
							<span className="font-medium">Next Available Slot:</span>
							<Badge variant="outline" className="text-green-600">
								When current period ends
							</Badge>
						</div>
					</div>
				</CardContent>
			</Card>

			{/* CTA Section */}
			<div className="text-center">
				<Button
					asChild
					size="lg"
					className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
				>
					<a href="mailto:hello@outofofficecollective.co.uk?subject=Fete%20Finder:%20Feature%20My%20Event%20Inquiry%20[YOUR_EVENT_NAME_HERE]">
						Feature My Event - €{FEATURED_EVENTS_CONFIG.FEATURE_PRICE}
					</a>
				</Button>
				<p className="text-sm text-muted-foreground">
					<br />
					You can also email us directly at hello@outofofficecollective.co.uk
					<CopyEmailButton email="hello@outofofficecollective.co.uk" />
				</p>
				<div className="mt-4">
					<Link
						href="/"
						className="text-sm text-muted-foreground hover:underline"
					>
						← Back to Events
					</Link>
				</div>
			</div>
		</div>
	);
}
