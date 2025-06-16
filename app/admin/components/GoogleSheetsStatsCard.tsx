"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getSessionToken } from "@/lib/admin/admin-session";
import { GoogleAppsScript } from "@/lib/google/apps-script";
import {
	Activity,
	AlertTriangle,
	BarChart3,
	Database,
	RefreshCw,
	UserCheck,
	Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type SheetsStats = {
	totalUsers: number;
	totalWithNames: number;
	totalLegacy: number;
	duplicateEmails: number;
	recentActivity: string;
	sheetHealth: string;
};

type GoogleSheetsStatsCardProps = {
	isAuthenticated: boolean;
};

export const GoogleSheetsStatsCard = ({
	isAuthenticated,
}: GoogleSheetsStatsCardProps) => {
	const [stats, setStats] = useState<SheetsStats | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [lastUpdate, setLastUpdate] = useState<string>("");

	const loadStats = useCallback(async () => {
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
			const result = await GoogleAppsScript.getAdminStats(sessionToken);

			if (result.success && result.stats) {
				setStats(result.stats);
				setLastUpdate(new Date().toLocaleTimeString());
			} else {
				setError(result.error || "Failed to load stats");
			}
		} catch {
			setError("Error loading statistics");
		} finally {
			setLoading(false);
		}
	}, [isAuthenticated]);

	// Auto-refresh every 30 seconds, but only when authenticated
	useEffect(() => {
		if (!isAuthenticated) {
			setStats(null);
			setError("");
			return;
		}

		loadStats(); // Initial load

		const interval = setInterval(loadStats, 30000);
		return () => clearInterval(interval);
	}, [loadStats, isAuthenticated]);

	const getHealthColor = (health: string) => {
		if (
			health.toLowerCase().includes("excellent") ||
			health.toLowerCase().includes("good")
		) {
			return "bg-green-100 text-green-800 border-green-200";
		}
		if (
			health.toLowerCase().includes("warning") ||
			health.toLowerCase().includes("moderate")
		) {
			return "bg-yellow-100 text-yellow-800 border-yellow-200";
		}
		return "bg-red-100 text-red-800 border-red-200";
	};

	// Show placeholder when not authenticated
	if (!isAuthenticated) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<BarChart3 className="h-5 w-5" />
						Google Sheets Statistics
					</CardTitle>
					<CardDescription>
						Live statistics from your Google Sheet
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8 text-muted-foreground">
						<Database className="h-8 w-8 mx-auto mb-2" />
						<p>Please authenticate to view statistics</p>
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
						<BarChart3 className="h-5 w-5" />
						Google Sheets Statistics
					</CardTitle>
					<CardDescription>
						Live statistics from your Google Sheet
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-center py-4 text-red-600">
						<AlertTriangle className="h-8 w-8 mx-auto mb-2" />
						<p>{error}</p>
						<Button
							onClick={loadStats}
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
							<BarChart3 className="h-5 w-5" />
							Google Sheets Statistics
						</CardTitle>
						<CardDescription>
							Live statistics from your Google Sheet
							{lastUpdate && (
								<span className="text-xs text-muted-foreground ml-2">
									• Updated {lastUpdate}
								</span>
							)}
						</CardDescription>
					</div>
					<Button
						onClick={loadStats}
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
				{loading && !stats ? (
					<div className="text-center py-8">
						<RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
						<p className="text-muted-foreground">Loading statistics...</p>
					</div>
				) : stats ? (
					<div className="space-y-6">
						{/* Main Stats Grid */}
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<div className="text-center space-y-2">
								<div className="flex items-center justify-center">
									<Users className="h-5 w-5 text-blue-600 mr-2" />
									<span className="text-2xl font-bold text-blue-600">
										{stats.totalUsers}
									</span>
								</div>
								<p className="text-sm text-muted-foreground">Total Users</p>
							</div>

							<div className="text-center space-y-2">
								<div className="flex items-center justify-center">
									<UserCheck className="h-5 w-5 text-green-600 mr-2" />
									<span className="text-2xl font-bold text-green-600">
										{stats.totalWithNames}
									</span>
								</div>
								<p className="text-sm text-muted-foreground">With Names</p>
							</div>

							<div className="text-center space-y-2">
								<div className="flex items-center justify-center">
									<Activity className="h-5 w-5 text-orange-600 mr-2" />
									<span className="text-2xl font-bold text-orange-600">
										{stats.totalLegacy}
									</span>
								</div>
								<p className="text-sm text-muted-foreground">Legacy Entries</p>
							</div>

							<div className="text-center space-y-2">
								<div className="flex items-center justify-center">
									<AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
									<span className="text-2xl font-bold text-red-600">
										{stats.duplicateEmails}
									</span>
								</div>
								<p className="text-sm text-muted-foreground">Duplicates</p>
							</div>
						</div>

						<Separator />

						{/* Health Status */}
						<div className="space-y-3">
							<div className="flex items-center justify-between">
								<span className="text-sm font-medium">Sheet Health</span>
								<Badge className={getHealthColor(stats.sheetHealth)}>
									{stats.sheetHealth}
								</Badge>
							</div>

							<div className="flex items-center justify-between">
								<span className="text-sm font-medium">Recent Activity</span>
								<span className="text-sm text-muted-foreground">
									{stats.recentActivity}
								</span>
							</div>
						</div>

						{/* Progress Bar for Names vs Legacy */}
						<div className="space-y-2">
							<div className="flex justify-between text-sm">
								<span>Data Quality</span>
								<span>
									{stats.totalUsers > 0
										? Math.round(
												(stats.totalWithNames / stats.totalUsers) * 100,
											)
										: 0}
									% with names
								</span>
							</div>
							<div className="w-full bg-gray-200 rounded-full h-2">
								<div
									className="bg-green-600 h-2 rounded-full transition-all duration-300"
									style={{
										width:
											stats.totalUsers > 0
												? `${(stats.totalWithNames / stats.totalUsers) * 100}%`
												: "0%",
									}}
								/>
							</div>
						</div>

						{/* Actions */}
						{stats.duplicateEmails > 0 && (
							<div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
								<div className="flex items-center">
									<AlertTriangle className="h-5 w-5 text-yellow-600 mr-2" />
									<span className="text-sm font-medium text-yellow-800">
										{stats.duplicateEmails} duplicate email
										{stats.duplicateEmails > 1 ? "s" : ""} detected
									</span>
								</div>
								<p className="text-xs text-yellow-700 mt-1">
									Consider cleaning up duplicates to improve data quality
								</p>
							</div>
						)}
					</div>
				) : (
					<div className="text-center py-8 text-muted-foreground">
						<Database className="h-8 w-8 mx-auto mb-2" />
						<p>No statistics available</p>
						<Button
							onClick={loadStats}
							variant="outline"
							size="sm"
							className="mt-2"
						>
							<RefreshCw className="h-4 w-4 mr-2" />
							Load Stats
						</Button>
					</div>
				)}
			</CardContent>
		</Card>
	);
};
