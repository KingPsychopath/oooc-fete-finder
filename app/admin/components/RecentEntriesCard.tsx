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
import {
	Clock,
	Users,
	RefreshCw,
	User,
	Mail,
	Check,
	AlertTriangle,
} from "lucide-react";
import { getRecentSheetEntries } from "@/app/actions";

type RecentEntry = {
	firstName: string;
	lastName: string;
	email: string;
	timestamp: string;
	consent: boolean;
	source: string;
};

type RecentEntriesCardProps = {
	adminKey: string;
	limit?: number;
};

export const RecentEntriesCard = ({
	adminKey,
	limit = 5,
}: RecentEntriesCardProps) => {
	const [entries, setEntries] = useState<RecentEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [lastUpdate, setLastUpdate] = useState<string>("");

	const loadEntries = useCallback(async () => {
		setLoading(true);
		setError("");

		try {
			const result = await getRecentSheetEntries(adminKey, limit);

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
	}, [adminKey, limit]);

	// Auto-refresh every 30 seconds
	useEffect(() => {
		loadEntries(); // Initial load

		const interval = setInterval(loadEntries, 30000);
		return () => clearInterval(interval);
	}, [loadEntries]);

	const formatTime = (timestamp: string) => {
		try {
			const date = new Date(timestamp);
			const now = new Date();
			const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

			if (diffInHours < 1) {
				const diffInMinutes = Math.floor(diffInHours * 60);
				return `${diffInMinutes}m ago`;
			} else if (diffInHours < 24) {
				const hours = Math.floor(diffInHours);
				return `${hours}h ago`;
			} else {
				const days = Math.floor(diffInHours / 24);
				return `${days}d ago`;
			}
		} catch {
			return "Unknown time";
		}
	};

	const getSourceColor = (source: string) => {
		if (source.includes("fete-finder")) {
			return "bg-blue-100 text-blue-800 border-blue-200";
		}
		return "bg-gray-100 text-gray-800 border-gray-200";
	};

	if (error) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Clock className="h-5 w-5" />
						Recent Entries
					</CardTitle>
					<CardDescription>
						Latest user registrations from Google Sheet
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
							Latest {limit} user registrations from Google Sheet
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
								key={`${entry.email}-${entry.timestamp}-${index}`}
								className="flex items-start space-x-3 p-4 border border-border rounded-lg hover:bg-muted/30 transition-colors"
							>
								<div className="flex-shrink-0">
									<div className="w-10 h-10 bg-gradient-to-br from-primary/10 to-primary/5 rounded-full border border-primary/20 flex items-center justify-center">
										<User className="h-4 w-4 text-primary" />
									</div>
								</div>

								<div className="flex-grow min-w-0">
									<div className="flex items-center justify-between">
										<div className="flex-grow">
											{entry.firstName && entry.lastName ? (
												<h4 className="text-sm font-semibold text-foreground">
													{entry.firstName} {entry.lastName}
												</h4>
											) : (
												<h4 className="text-sm font-semibold text-muted-foreground italic">
													Anonymous User
												</h4>
											)}
											<div className="flex items-center gap-2 mt-1">
												<Mail className="h-3 w-3 text-muted-foreground" />
												<span className="text-sm text-muted-foreground font-mono">
													{entry.email}
												</span>
											</div>
										</div>

										<div className="flex items-center gap-2 flex-shrink-0">
											{entry.consent && (
												<div className="flex items-center gap-1">
													<Check className="h-3 w-3 text-green-600" />
													<span className="text-xs text-green-600">
														Consent
													</span>
												</div>
											)}
											<Badge
												className={getSourceColor(entry.source)}
												variant="outline"
											>
												{entry.source.replace("fete-finder-", "")}
											</Badge>
										</div>
									</div>

									<div className="flex items-center gap-2 mt-2">
										<Clock className="h-3 w-3 text-muted-foreground" />
										<span className="text-xs text-muted-foreground">
											{formatTime(entry.timestamp)}
										</span>
									</div>
								</div>
							</div>
						))}

						{entries.length === limit && (
							<div className="text-center pt-2">
								<p className="text-xs text-muted-foreground">
									Showing latest {limit} entries
								</p>
							</div>
						)}
					</div>
				) : (
					<div className="text-center py-8 text-muted-foreground">
						<Users className="h-8 w-8 mx-auto mb-2" />
						<p>No recent entries found</p>
						<p className="text-xs mt-1">New registrations will appear here</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
};
