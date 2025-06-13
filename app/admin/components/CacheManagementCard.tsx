import React from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CacheStatus } from "../types";

type CacheManagementCardProps = {
	cacheStatus: CacheStatus;
	refreshing: boolean;
	refreshMessage: string;
	onRefresh: () => void;
};

const formatDuration = (ms: number): string => {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) return `${hours}h ${minutes % 60}m`;
	if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
	return `${seconds}s`;
};

const getDataSourceBadge = (source: string) => {
	switch (source) {
		case "remote":
			return (
				<Badge variant="default" className="bg-green-500">
					📡 Remote (Google Sheets)
				</Badge>
			);
		case "local":
			return <Badge variant="secondary">📁 Local CSV</Badge>;
		case "cached":
			return <Badge variant="outline">💾 Cached</Badge>;
		default:
			return <Badge variant="destructive">❓ Unknown</Badge>;
	}
};

const getConfiguredDataSourceBadge = (source: string) => {
	switch (source) {
		case "remote":
			return (
				<Badge variant="default" className="bg-blue-500">
					🌐 Remote Mode
				</Badge>
			);
		case "local":
			return <Badge variant="secondary">📁 Local Mode</Badge>;
		case "static":
			return <Badge variant="outline">📦 Static Mode</Badge>;
		default:
			return <Badge variant="destructive">❓ Unknown</Badge>;
	}
};

export const CacheManagementCard = ({
	cacheStatus,
	refreshing,
	refreshMessage,
	onRefresh,
}: CacheManagementCardProps) => {
	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					📊 Events Data Management
				</CardTitle>
				<CardDescription>
					Monitor and manage the events data cache from Google Sheets CSV
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-6">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
						<div className="space-y-2">
							<Label className="text-sm font-medium">Current Data Source</Label>
							<div>{getDataSourceBadge(cacheStatus.dataSource)}</div>
						</div>

						<div className="space-y-2">
							<Label className="text-sm font-medium">Configured Mode</Label>
							<div>
								{getConfiguredDataSourceBadge(cacheStatus.configuredDataSource)}
							</div>
						</div>

						<div className="space-y-2">
							<Label className="text-sm font-medium">Events Count</Label>
							<div className="text-2xl font-bold">{cacheStatus.eventCount}</div>
						</div>

						<div className="space-y-2">
							<Label className="text-sm font-medium">
								Remote URL Configured
							</Label>
							<Badge
								variant={
									cacheStatus.remoteConfigured ? "default" : "destructive"
								}
							>
								{cacheStatus.remoteConfigured ? "✅ Yes" : "❌ Not Set"}
							</Badge>
						</div>

						<div className="space-y-2">
							<Label className="text-sm font-medium">Cache Status</Label>
							<Badge
								variant={cacheStatus.hasCachedData ? "default" : "destructive"}
							>
								{cacheStatus.hasCachedData ? "💾 Active" : "❌ Empty"}
							</Badge>
						</div>

						<div className="space-y-2">
							<Label className="text-sm font-medium">Cache Age</Label>
							<div className="text-sm">
								{cacheStatus.cacheAge > 0 ? (
									formatDuration(cacheStatus.cacheAge)
								) : (
									<span className="text-green-600 font-medium">
										✨ Just refreshed
									</span>
								)}
							</div>
						</div>
					</div>

					{/* Data Source Explanation */}
					<div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
						<Label className="text-sm font-medium text-blue-800">
							💡 Data Source Configuration:
						</Label>
						<div className="text-xs text-blue-700 mt-1 space-y-1">
							<div>
								<strong>🌐 Remote Mode:</strong> Fetches from Google Sheets with
								local CSV fallback (production)
							</div>
							<div>
								<strong>📁 Local Mode:</strong> Uses local CSV file only
								(development/testing)
							</div>
							<div>
								<strong>📦 Static Mode:</strong> Uses hardcoded events data
								(demo/offline)
							</div>
						</div>
						<div className="text-xs text-blue-600 mt-2 pt-2 border-t border-blue-200">
							<strong>Current Data Source:</strong> Where the data is actually
							coming from right now
						</div>
					</div>

					{/* Connection Status Section */}
					<div className="space-y-4">
						<Label className="text-lg font-semibold">Connection Status</Label>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label className="text-sm font-medium">
									Last Successful Remote Connection
								</Label>
								<div className="text-sm">
									{cacheStatus.lastRemoteSuccessTime
										? new Date(
												cacheStatus.lastRemoteSuccessTime,
											).toLocaleString()
										: "Never connected"}
								</div>
							</div>

							<div className="space-y-2">
								<Label className="text-sm font-medium">Next Remote Check</Label>
								<div className="text-sm">
									{cacheStatus.nextRemoteCheck > 0
										? `in ${formatDuration(cacheStatus.nextRemoteCheck)}`
										: "Due now"}
								</div>
							</div>
						</div>

						{cacheStatus.lastRemoteErrorMessage && (
							<div className="p-3 rounded-md bg-yellow-50 text-yellow-800 border border-yellow-200">
								<Label className="text-sm font-medium">
									Last Remote Error:
								</Label>
								<div className="text-sm mt-1">
									{cacheStatus.lastRemoteErrorMessage}
								</div>
							</div>
						)}

						{cacheStatus.dataSource === "local" && (
							<div className="p-3 rounded-md bg-orange-50 text-orange-800 border border-orange-200">
								<Label className="text-sm font-medium">
									Using Local Fallback Data
								</Label>
								<div className="text-sm mt-1">
									Local CSV data may be out of date. Last updated:{" "}
									{cacheStatus.localCsvLastUpdated}
								</div>
							</div>
						)}
					</div>
				</div>

				<Separator />

				<div className="flex flex-col sm:flex-row gap-4">
					<Button onClick={onRefresh} disabled={refreshing} className="flex-1">
						{refreshing ? "🔄 Refreshing..." : "🔄 Force Refresh Events"}
					</Button>

					{cacheStatus?.lastFetchTime && (
						<div className="text-sm text-gray-500 flex items-center">
							Last updated:{" "}
							{new Date(cacheStatus.lastFetchTime).toLocaleString()}
						</div>
					)}
				</div>

				{refreshMessage && (
					<div
						className={`p-3 rounded-md text-sm ${
							refreshMessage.includes("✅") ||
							refreshMessage.includes("completed") ||
							refreshMessage.includes("successful") ||
							refreshMessage.includes("Success") ||
							refreshMessage.includes("refreshed")
								? "bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
								: refreshMessage.includes("⚠️") ||
										refreshMessage.includes("warning") ||
										refreshMessage.includes("Warning")
									? "bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800"
									: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
						}`}
					>
						{refreshMessage}
					</div>
				)}
			</CardContent>
		</Card>
	);
};
