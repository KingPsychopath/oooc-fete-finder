"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
	Clock,
	Users,
	RefreshCw,
	User,
	Mail,
	Calendar,
	Check,
	AlertTriangle,
	Database,
} from "lucide-react";
import { GoogleAppsScript } from "@/lib/google/apps-script";
import { getSessionToken } from "@/lib/admin/admin-session";

type RecentEntry = {
	firstName: string;
	lastName: string;
	email: string;
	timestamp: string;
	consent: boolean;
	source: string;
};

type RecentEntriesCardProps = {
	isAuthenticated: boolean;
	limit?: number;
};

export const RecentEntriesCard = ({
	isAuthenticated,
	limit = 5,
}: RecentEntriesCardProps) => {
	const [entries, setEntries] = useState<RecentEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [lastUpdate, setLastUpdate] = useState<string>("");

	const loadEntries = useCallback(async () => {
		// Don't load if not authenticated
		if (!isAuthenticated) {
			return;
		}

		// Get session token - this should be available if user is authenticated
		const sessionToken = getSessionToken();
		if (!sessionToken) {
			setError("No valid session found. Please re-authenticate.");
			return;
		}

		setLoading(true);
		setError("");

		try {
			const result = await GoogleAppsScript.getRecentEntries(sessionToken, limit);

			if (result.success && result.entries) {
				setEntries(result.entries);
				setLastUpdate(new Date().toLocaleTimeString());
			} else {
				setError(result.error || "Failed to load recent entries");
			}
		} catch {
			setError("Error loading recent entries");
		} finally {
			setLoading(false);
		}
	}, [limit, isAuthenticated]);

	// Auto-refresh every 60 seconds, but only when authenticated
	useEffect(() => {
		if (!isAuthenticated) {
			setEntries([]);
			setError("");
			return;
		}

		loadEntries(); // Initial load

		const interval = setInterval(loadEntries, 60000); // Every minute
		return () => clearInterval(interval);
	}, [loadEntries, isAuthenticated]);

	const formatTimestamp = (timestamp: string) => {
		try {
			const date = new Date(timestamp);
			return date.toLocaleString();
		} catch {
			return timestamp;
		}
	};

	const getSourceBadgeColor = (source: string) => {
		if (source.includes("auth")) {
			return "bg-blue-100 text-blue-800 border-blue-200";
		}
		if (source.includes("newsletter")) {
			return "bg-green-100 text-green-800 border-green-200";
		}
		return "bg-gray-100 text-gray-800 border-gray-200";
	};

	// Show placeholder when not authenticated
	if (!isAuthenticated) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Clock className="h-5 w-5" />
						Recent Entries
					</CardTitle>
					<CardDescription>
						Latest user registrations from Google Sheets
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8 text-muted-foreground">
						<Users className="h-8 w-8 mx-auto mb-2" />
						<p>Please authenticate to view recent entries</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Clock className="h-5 w-5" />
						Recent Entries
					</CardTitle>
					<CardDescription>
						Latest user registrations from Google Sheets
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-center py-4 text-red-600">
						<AlertTriangle className="h-8 w-8 mx-auto mb-2" />
						<p>{error}</p>
						<Button
							onClick={loadEntries}
							variant="outline"
							size="sm"
							className="mt-2"
						>
							<RefreshCw className="h-4 w-4 mr-2" />
							Retry
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<Clock className="h-5 w-5" />
							Recent Entries
						</CardTitle>
						<CardDescription>
							Latest {limit} user registrations from Google Sheets
							{lastUpdate && (
								<span className="text-xs text-muted-foreground ml-2">
									• Updated {lastUpdate}
								</span>
							)}
						</CardDescription>
					</div>
					<Button
						onClick={loadEntries}
						variant="outline"
						size="sm"
						disabled={loading}
					>
						<RefreshCw
							className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
						/>
						Refresh
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				{loading && entries.length === 0 ? (
					<div className="text-center py-8">
						<RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
						<p className="text-muted-foreground">Loading recent entries...</p>
					</div>
				) : entries.length > 0 ? (
					<div className="space-y-4">
						{entries.map((entry, index) => (
							<div
								key={index}
								className="border border-gray-200 rounded-lg p-4"
							>
								<div className="flex items-start justify-between mb-2">
									<div className="flex items-center gap-2">
										<User className="h-4 w-4 text-muted-foreground" />
										<span className="font-medium">
											{entry.firstName} {entry.lastName}
										</span>
										{entry.consent && (
											<div title="Consented">
												<Check className="h-4 w-4 text-green-600" />
											</div>
										)}
									</div>
									<Badge className={getSourceBadgeColor(entry.source)}>
										{entry.source}
									</Badge>
								</div>

								<div className="space-y-1 text-sm text-muted-foreground">
									<div className="flex items-center gap-2">
										<Mail className="h-3 w-3" />
										{entry.email}
									</div>
									<div className="flex items-center gap-2">
										<Calendar className="h-3 w-3" />
										{formatTimestamp(entry.timestamp)}
									</div>
								</div>
							</div>
						))}

						{entries.length >= limit && (
							<div className="text-center">
								<Separator className="mb-4" />
								<p className="text-xs text-muted-foreground">
									Showing latest {limit} entries
								</p>
							</div>
						)}
					</div>
				) : (
					<div className="text-center py-8 text-muted-foreground">
						<Database className="h-8 w-8 mx-auto mb-2" />
						<p>No recent entries found</p>
						<Button
							onClick={loadEntries}
							variant="outline"
							size="sm"
							className="mt-2"
						>
							<RefreshCw className="h-4 w-4 mr-2" />
							Load Entries
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
};
