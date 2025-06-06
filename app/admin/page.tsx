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
} from "@/app/actions";

// Import local components
import { AuthForm } from "./components/AuthForm";
import { CacheManagementCard } from "./components/CacheManagementCard";
import { DynamicSheetCard } from "./components/DynamicSheetCard";
import { EmailCollectionCard } from "./components/EmailCollectionCard";

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
	const [dynamicConfig, setDynamicConfig] = useState<DynamicSheetConfig | null>(
		null,
	);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		try {
			const result = await getCollectedEmails(adminKey);

			if (result.success) {
				setIsAuthenticated(true);
				setEmails(result.emails || []);
				await loadCacheStatus();
				await loadDynamicConfig();
			} else {
				setError(result.error || "Invalid admin key");
			}
		} catch {
			setError("Something went wrong");
		} finally {
			setIsLoading(false);
		}
	};

	const loadCacheStatus = useCallback(async () => {
		try {
			const status = await getCacheStatus();
			setCacheStatus(status);
		} catch {
			console.error("Failed to load cache status");
		}
	}, []);

	const loadDynamicConfig = async () => {
		try {
			const config = await getDynamicSheetConfig();
			setDynamicConfig(config);
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
			const result = await forceRefreshEvents();
			setRefreshMessage(result.message);

			// Reload cache status after refresh
			setTimeout(() => {
				loadCacheStatus();
			}, 1000);
		} catch (error) {
			setRefreshMessage(
				`Failed to refresh: ${error instanceof Error ? error.message : "Unknown error"}`,
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
			["Email", "Timestamp", "Consent", "Source"],
			...emails.map((email) => [
				email.email,
				email.timestamp,
				email.consent.toString(),
				email.source,
			]),
		];

		const csvString = csvContent.map((row) => row.join(",")).join("\n");
		const blob = new Blob([csvString], { type: "text/csv" });
		const url = URL.createObjectURL(blob);

		const a = document.createElement("a");
		a.href = url;
		a.download = `fete-finder-emails-${new Date().toISOString().split("T")[0]}.csv`;
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
		const homeUrl = basePath ? `${basePath}/` : "/";
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
						<Button onClick={loadCacheStatus} variant="outline" size="sm">
							🔄 Refresh Status
						</Button>
					</div>
				</div>
				<div className="text-center py-4">Loading cache status...</div>
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
					<Button onClick={loadCacheStatus} variant="outline" size="sm">
						🔄 Refresh Status
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
		</div>
	);
}
