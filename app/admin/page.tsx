"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
	getCollectedEmails,
	forceRefreshEvents,
	getCacheStatus,
	setDynamicSheet,
	getDynamicSheetConfig,
	getGoogleSheetsStats,
	getRecentSheetEntries,
} from "@/app/actions";

// Import local components
import { AuthForm } from "./components/AuthForm";
import { CacheManagementCard } from "./components/CacheManagementCard";
import { DateFormatNotificationsCard } from "./components/DateFormatNotificationsCard";
import { DynamicSheetCard } from "./components/DynamicSheetCard";
import { EmailCollectionCard } from "./components/EmailCollectionCard";
import { GoogleSheetsStatsCard } from "./components/GoogleSheetsStatsCard";
import { OGImageTestCard } from "./components/OGImageTestCard";
import { RecentEntriesCard } from "./components/RecentEntriesCard";
import { SheetActionsCard } from "./components/SheetActionsCard";

// Import types
import { EmailRecord, CacheStatus, DynamicSheetConfig } from "./types";

// Get base path from environment variable
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function AdminPage() {
	const router = useRouter();
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	const [adminKey, setAdminKey] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [emails, setEmails] = useState<EmailRecord[]>([]);
	const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
	const [refreshing, setRefreshing] = useState(false);
	const [refreshMessage, setRefreshMessage] = useState("");
	const [statusRefreshing, setStatusRefreshing] = useState(false);
	const [dynamicConfig, setDynamicConfig] = useState<DynamicSheetConfig | null>(
		null,
	);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		// Log Google Sheets configuration status for admin
		console.log("🔐 Admin panel access attempt");
		console.log("📊 Checking Google Sheets configuration...");
		const sheetsConfigured = Boolean(process.env.GOOGLE_SHEETS_URL);
		if (!sheetsConfigured) {
			console.warn(
				"⚠️ WARNING: Google Sheets integration not configured in admin panel check",
			);
		} else {
			console.log("✅ Google Sheets integration appears to be configured");
		}

		try {
			const result = await getCollectedEmails(adminKey);

			if (result.success) {
				setIsAuthenticated(true);
				setEmails(result.emails || []);
				await loadCacheStatus();
				await loadDynamicConfig();

				console.log(
					`✅ Admin authenticated successfully. Found ${result.emails?.length || 0} collected users.`,
				);
			} else {
				setError(result.error || "Invalid admin key");
				console.error("❌ Admin authentication failed:", result.error);
			}
		} catch (error) {
			setError("Something went wrong");
			console.error("❌ Admin panel error:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const loadCacheStatus = useCallback(async () => {
		try {
			console.log("🔄 Loading cache status...");
			const status = await getCacheStatus();
			console.log("📊 Cache status loaded:", {
				cacheAge: status.cacheAge,
				lastFetchTime: status.lastFetchTime,
				dataSource: status.dataSource,
				eventCount: status.eventCount
			});
			setCacheStatus(status);
			return status;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			console.error("❌ Failed to load cache status:", errorMessage);
			throw error; // Re-throw so calling code can handle
		}
	}, []);

	const handleStatusRefresh = useCallback(async () => {
		setStatusRefreshing(true);
		try {
			console.log("📊 Manual cache status refresh triggered...");
			await loadCacheStatus();
			console.log("✅ Manual cache status refresh completed");
		} catch (error) {
			console.error("❌ Manual cache status refresh failed:", error);
		} finally {
			setStatusRefreshing(false);
		}
	}, [loadCacheStatus]);

	const loadDynamicConfig = async () => {
		try {
			const config = await getDynamicSheetConfig();
			setDynamicConfig({
				hasDynamicOverride: config.isActive,
				sheetId: config.sheetId,
				range: config.range,
				envSheetId: process.env.GOOGLE_SHEET_ID || null,
				envRange: process.env.GOOGLE_SHEET_RANGE || "A:Z",
			});
		} catch {
			console.error("Failed to load dynamic config");
		}
	};

	// Auto-refresh cache status every 30 seconds when authenticated
	useEffect(() => {
		if (!isAuthenticated) return;

		const interval = setInterval(loadCacheStatus, 30000);
		return () => clearInterval(interval);
	}, [isAuthenticated, loadCacheStatus]);

	const handleRefresh = async () => {
		setRefreshing(true);
		setRefreshMessage("");

		try {
			console.log("🔄 Starting full revalidation via CacheManager...");

			// Use the centralized cache manager for full revalidation
			// This handles both cache refresh and page revalidation in a single operation
			try {
				const baseUrl = window.location.origin;
				const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
				const revalidateUrl = `${baseUrl}${basePath}/api/revalidate`;

				console.log("📡 Revalidate URL:", revalidateUrl);

				const revalidatePayload = {
					adminKey: adminKey,
					path: "/",
				};

				const revalidateResponse = await fetch(revalidateUrl, {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(revalidatePayload),
					signal: AbortSignal.timeout(30000), // 30 second timeout for full revalidation
				});

				console.log(
					"📡 Revalidate response status:",
					revalidateResponse.status,
				);

				if (revalidateResponse.ok) {
					const revalidateData = await revalidateResponse.json();
					const timingInfo = revalidateData.processingTimeMs
						? `${revalidateData.processingTimeMs}ms`
						: "completed";

					const successMessage = `✅ Full revalidation completed (${timingInfo}). Cache: ${revalidateData.cacheRefreshed ? "refreshed" : "failed"}, Page: ${revalidateData.pageRevalidated ? "revalidated" : "failed"}`;
					setRefreshMessage(successMessage);
					console.log("✅ Full revalidation successful:", revalidateData);

					// ✅ IMPROVED: Multiple attempts to reload cache status
					// Clear any existing cache status immediately to show loading state
					setCacheStatus(null);
					
					// Try loading cache status multiple times with progressive delays
					const reloadCacheStatusRobustly = async () => {
						const maxAttempts = 3;
						let lastError: Error | null = null;
						
						for (let attempt = 1; attempt <= maxAttempts; attempt++) {
							try {
								// Progressive delay: 1s, 2s, 3s
								await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
								
								console.log(`🔄 Loading cache status (attempt ${attempt}/${maxAttempts})...`);
								await loadCacheStatus();
								console.log(`✅ Cache status loaded successfully on attempt ${attempt}`);
								break;
							} catch (error) {
								lastError = error instanceof Error ? error : new Error('Unknown error');
								console.warn(`⚠️ Cache status load attempt ${attempt} failed:`, lastError.message);
								
								if (attempt === maxAttempts) {
									console.error("❌ All cache status load attempts failed:", lastError);
									setRefreshMessage(prev => `${prev} (Note: Cache status may need manual refresh)`);
								}
							}
						}
					};
					
					// Start the robust reload process
					reloadCacheStatusRobustly();
				} else {
					// Enhanced error handling
					let errorDetails = `Status: ${revalidateResponse.status}`;
					let errorData: { message?: string; error?: string } | null = null;

					try {
						errorData = await revalidateResponse.json();
						errorDetails += ` - ${errorData?.message || "Unknown error"}`;
						if (errorData?.error) {
							errorDetails += ` (${errorData.error})`;
						}
						console.error("❌ Revalidation failed with data:", errorData);
					} catch (parseError) {
						errorDetails += ` - ${revalidateResponse.statusText}`;
						console.error(
							"❌ Failed to parse revalidation error response:",
							parseError,
						);
					}

					console.warn("⚠️ Full revalidation failed:", errorDetails);
					setRefreshMessage(`❌ Revalidation failed: ${errorDetails}`);
				}
			} catch (revalidateError) {
				console.error("❌ Revalidation request error:", revalidateError);

				let errorMsg = "Unknown error";
				if (revalidateError instanceof Error) {
					errorMsg = revalidateError.message;
					// Handle specific error types
					if (revalidateError.name === "AbortError") {
						errorMsg = "Request timed out";
					} else if (revalidateError.name === "TypeError") {
						errorMsg = "Network error - check connection";
					}
				}

				setRefreshMessage(`❌ Revalidation error: ${errorMsg}`);
			}

			// ✅ IMPROVED: Always ensure cache status is refreshed after any operation
			const ensureCacheStatusRefresh = async () => {
				try {
					// Small delay to ensure backend state has stabilized
					await new Promise(resolve => setTimeout(resolve, 1500));
					console.log("🔄 Final cache status refresh after operation...");
					await loadCacheStatus();
					console.log("✅ Final cache status refresh completed");
				} catch (error) {
					console.warn("⚠️ Final cache status refresh failed:", error);
					// Don't throw - this is just cleanup
				}
			};
			
			ensureCacheStatusRefresh();
		} catch (error) {
			console.error("❌ Overall refresh error:", error);
			setRefreshMessage(
				`❌ Failed to refresh: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		} finally {
			setRefreshing(false);
		}
	};

	const handleDynamicSheetSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		try {
			const formData = new FormData(e.target as HTMLFormElement);
			formData.set("adminKey", adminKey);

			const result = await setDynamicSheet(formData);

			if (result.success) {
				setRefreshMessage(result.message);
				await loadDynamicConfig();
				await loadCacheStatus();
			} else {
				setError(result.message);
			}
		} catch {
			setError("Failed to set dynamic sheet");
		} finally {
			setIsLoading(false);
		}
	};

	const exportAsCSV = () => {
		const csvContent = [
			["First Name", "Last Name", "Email", "Timestamp", "Consent", "Source"],
			...emails.map((user) => [
				user.firstName,
				user.lastName,
				user.email,
				user.timestamp,
				user.consent.toString(),
				user.source,
			]),
		];

		const csvString = csvContent.map((row) => row.join(",")).join("\n");
		const blob = new Blob([csvString], { type: "text/csv" });
		const url = URL.createObjectURL(blob);

		const a = document.createElement("a");
		a.href = url;
		a.download = `fete-finder-users-${new Date().toISOString().split("T")[0]}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const copyEmails = () => {
		const emailList = emails.map((e) => e.email).join("\n");
		navigator.clipboard.writeText(emailList);
		alert("Emails copied to clipboard!");
	};

	const handleBackToHome = () => {
		const homeUrl = basePath || "/";
		router.push(homeUrl);
	};

	if (!isAuthenticated) {
		return (
			<AuthForm
				onSubmit={handleSubmit}
				isLoading={isLoading}
				error={error}
				adminKey={adminKey}
				setAdminKey={setAdminKey}
			/>
		);
	}

	if (!cacheStatus || !dynamicConfig) {
		return (
			<div className="container mx-auto py-8 space-y-8">
				<div className="flex justify-between items-center">
					<h1 className="text-3xl font-bold">Admin Panel</h1>
					<div className="flex gap-2">
						<Button onClick={handleBackToHome} variant="outline" size="sm">
							← Back to Home
						</Button>
						<Button onClick={handleStatusRefresh} variant="outline" size="sm" disabled={!cacheStatus || statusRefreshing}>
							{statusRefreshing ? "⏳ Refreshing..." : "📊 Refresh Status"}
						</Button>
					</div>
				</div>
				<div className="text-center py-8">
					<div className="animate-spin inline-block w-6 h-6 border-[3px] border-current border-t-transparent text-blue-600 rounded-full mb-4" role="status" aria-label="loading">
					</div>
					<div className="text-lg font-medium">Loading cache status...</div>
					<div className="text-sm text-gray-500 mt-2">
						{!cacheStatus ? "Fetching cache information..." : "Loading dynamic configuration..."}
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="container mx-auto py-8 space-y-8">
			<div className="flex justify-between items-center">
				<h1 className="text-3xl font-bold">Admin Panel</h1>
				<div className="flex gap-2">
					<Button onClick={handleBackToHome} variant="outline" size="sm">
						← Back to Home
					</Button>
					<Button onClick={handleStatusRefresh} variant="outline" size="sm" disabled={statusRefreshing || refreshing}>
						{statusRefreshing ? "⏳ Refreshing..." : "📊 Refresh Status"}
					</Button>
				</div>
			</div>

			{/* Cache Management Section */}
			<CacheManagementCard
				cacheStatus={cacheStatus}
				refreshing={refreshing}
				refreshMessage={refreshMessage}
				onRefresh={handleRefresh}
			/>

			<Separator />

			{/* Google Sheets Live Data Section */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<GoogleSheetsStatsCard adminKey={adminKey} />
				<RecentEntriesCard adminKey={adminKey} limit={5} />
			</div>

			<Separator />

			{/* Date Format Notifications Section */}
			<DateFormatNotificationsCard adminKey={adminKey} />

			<Separator />

			{/* Sheet Maintenance Section */}
			<SheetActionsCard
				adminKey={adminKey}
				onActionComplete={() => {
					// Refresh all data when maintenance actions complete
					loadCacheStatus();
					setRefreshMessage("Sheet maintenance completed - data refreshed");
				}}
			/>

			<Separator />

			{/* Dynamic Sheet Override Section */}
			<DynamicSheetCard
				dynamicConfig={dynamicConfig}
				adminKey={adminKey}
				isLoading={isLoading}
				onSubmit={handleDynamicSheetSubmit}
			/>

			{/* Email Collection Section */}
			<EmailCollectionCard
				emails={emails}
				onCopyEmails={copyEmails}
				onExportCSV={exportAsCSV}
			/>

			<Separator />

			{/* OG:Image Testing Section */}
			<OGImageTestCard />
		</div>
	);
}
