"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getCollectedEmails, forceRefreshEvents, getCacheStatus } from "@/app/actions";

type EmailRecord = {
	email: string;
	timestamp: string;
	consent: boolean;
	source: string;
};

type CacheStatus = {
	hasCachedData: boolean;
	lastFetchTime: string | null;
	lastRemoteFetchTime: string | null;
	lastRemoteSuccessTime: string | null;
	lastRemoteErrorMessage: string;
	cacheAge: number;
	nextRemoteCheck: number;
	dataSource: 'remote' | 'local' | 'cached';
	useCsvData: boolean;
	eventCount: number;
	localCsvLastUpdated: string;
	remoteConfigured: boolean;
};

const AdminPage = () => {
	const [adminKey, setAdminKey] = useState("");
	const [emails, setEmails] = useState<EmailRecord[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [isAuthenticated, setIsAuthenticated] = useState(false);
	
	// Cache management state
	const [cacheStatus, setCacheStatus] = useState<CacheStatus | null>(null);
	const [refreshing, setRefreshing] = useState(false);
	const [refreshMessage, setRefreshMessage] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		try {
			const result = await getCollectedEmails(adminKey);
			
			if (result.success) {
				setEmails(result.emails || []);
				setIsAuthenticated(true);
				// Load cache status once authenticated
				loadCacheStatus();
			} else {
				setError(result.error || "Failed to fetch emails");
			}
		} catch {
			setError("Something went wrong");
		} finally {
			setIsLoading(false);
		}
	};

	const loadCacheStatus = async () => {
		try {
			const status = await getCacheStatus();
			setCacheStatus(status);
		} catch (error) {
			console.error("Failed to load cache status:", error);
		}
	};

	const handleForceRefresh = async () => {
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
			setRefreshMessage(`Failed to refresh: ${error instanceof Error ? error.message : 'Unknown error'}`);
		} finally {
			setRefreshing(false);
		}
	};

	// Auto-refresh cache status every 30 seconds when authenticated
	useEffect(() => {
		if (!isAuthenticated) return;
		
		const interval = setInterval(loadCacheStatus, 30000);
		return () => clearInterval(interval);
	}, [isAuthenticated]);

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
			case 'remote':
				return <Badge variant="default" className="bg-green-500">📡 Remote (Google Sheets)</Badge>;
			case 'local':
				return <Badge variant="secondary">📁 Local CSV</Badge>;
			case 'cached':
				return <Badge variant="outline">💾 Cached</Badge>;
			default:
				return <Badge variant="destructive">❓ Unknown</Badge>;
		}
	};

	const exportAsCSV = () => {
		const csvContent = [
			["Email", "Timestamp", "Consent", "Source"],
			...emails.map(email => [
				email.email,
				email.timestamp,
				email.consent.toString(),
				email.source
			])
		];
		
		const csvString = csvContent.map(row => row.join(",")).join("\n");
		const blob = new Blob([csvString], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		
		const a = document.createElement("a");
		a.href = url;
		a.download = `fete-finder-emails-${new Date().toISOString().split('T')[0]}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const copyEmails = () => {
		const emailList = emails.map(e => e.email).join("\n");
		navigator.clipboard.writeText(emailList);
		alert("Emails copied to clipboard!");
	};

	if (!isAuthenticated) {
		return (
			<div className="container mx-auto max-w-md py-8">
				<h1 className="text-2xl font-bold mb-6">Admin Access</h1>
				
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<Label htmlFor="adminKey">Admin Key</Label>
						<Input
							id="adminKey"
							type="password"
							value={adminKey}
							onChange={(e) => setAdminKey(e.target.value)}
							placeholder="Enter admin key"
						/>
					</div>
					
					{error && <p className="text-red-500 text-sm">{error}</p>}
					
					<Button type="submit" disabled={isLoading} className="w-full">
						{isLoading ? "Verifying..." : "Access Admin Panel"}
					</Button>
				</form>
				
				<p className="text-sm text-gray-500 mt-4">
					Default key: your-secret-key-123 (change via ADMIN_KEY env var)
				</p>
			</div>
		);
	}

	return (
		<div className="container mx-auto py-8 space-y-8">
			<div className="flex justify-between items-center">
				<h1 className="text-3xl font-bold">Admin Panel</h1>
				<Button 
					onClick={loadCacheStatus} 
					variant="outline"
					size="sm"
				>
					🔄 Refresh Status
				</Button>
			</div>

			{/* Cache Management Section */}
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
					{cacheStatus ? (
						<div className="space-y-6">
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								<div className="space-y-2">
									<Label className="text-sm font-medium">Data Source</Label>
									<div>{getDataSourceBadge(cacheStatus.dataSource)}</div>
								</div>
								
								<div className="space-y-2">
									<Label className="text-sm font-medium">Events Count</Label>
									<div className="text-2xl font-bold">{cacheStatus.eventCount}</div>
								</div>
								
								<div className="space-y-2">
									<Label className="text-sm font-medium">CSV Data Enabled</Label>
									<Badge variant={cacheStatus.useCsvData ? "default" : "secondary"}>
										{cacheStatus.useCsvData ? "✅ Enabled" : "❌ Disabled"}
									</Badge>
								</div>
								
								<div className="space-y-2">
									<Label className="text-sm font-medium">Remote URL Configured</Label>
									<Badge variant={cacheStatus.remoteConfigured ? "default" : "destructive"}>
										{cacheStatus.remoteConfigured ? "✅ Yes" : "❌ Not Set"}
									</Badge>
								</div>
								
								<div className="space-y-2">
									<Label className="text-sm font-medium">Cache Status</Label>
									<Badge variant={cacheStatus.hasCachedData ? "default" : "destructive"}>
										{cacheStatus.hasCachedData ? "💾 Active" : "❌ Empty"}
									</Badge>
								</div>
								
								<div className="space-y-2">
									<Label className="text-sm font-medium">Cache Age</Label>
									<div className="text-sm">
										{cacheStatus.cacheAge > 0 ? formatDuration(cacheStatus.cacheAge) : "Just refreshed"}
									</div>
								</div>
							</div>

							{/* Connection Status Section */}
							<div className="space-y-4">
								<Label className="text-lg font-semibold">Connection Status</Label>
								
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-2">
										<Label className="text-sm font-medium">Last Successful Remote Connection</Label>
										<div className="text-sm">
											{cacheStatus.lastRemoteSuccessTime 
												? new Date(cacheStatus.lastRemoteSuccessTime).toLocaleString()
												: "Never connected"
											}
										</div>
									</div>
									
									<div className="space-y-2">
										<Label className="text-sm font-medium">Next Remote Check</Label>
										<div className="text-sm">
											{cacheStatus.nextRemoteCheck > 0 
												? `in ${formatDuration(cacheStatus.nextRemoteCheck)}`
												: "Due now"
											}
										</div>
									</div>
								</div>

								{cacheStatus.lastRemoteErrorMessage && (
									<div className="p-3 rounded-md bg-yellow-50 text-yellow-800 border border-yellow-200">
										<Label className="text-sm font-medium">Last Remote Error:</Label>
										<div className="text-sm mt-1">{cacheStatus.lastRemoteErrorMessage}</div>
									</div>
								)}

								{cacheStatus.dataSource === 'local' && (
									<div className="p-3 rounded-md bg-orange-50 text-orange-800 border border-orange-200">
										<Label className="text-sm font-medium">Using Local Fallback Data</Label>
										<div className="text-sm mt-1">
											Local CSV data may be out of date. Last updated: {cacheStatus.localCsvLastUpdated}
										</div>
									</div>
								)}
							</div>
						</div>
					) : (
						<div className="text-center py-4">Loading cache status...</div>
					)}
					
					<Separator />
					
					<div className="flex flex-col sm:flex-row gap-4">
						<Button 
							onClick={handleForceRefresh}
							disabled={refreshing}
							className="flex-1"
						>
							{refreshing ? "🔄 Refreshing..." : "🔄 Force Refresh Events"}
						</Button>
						
						{cacheStatus?.lastFetchTime && (
							<div className="text-sm text-gray-500 flex items-center">
								Last updated: {new Date(cacheStatus.lastFetchTime).toLocaleString()}
							</div>
						)}
					</div>
					
					{refreshMessage && (
						<div className={`p-3 rounded-md text-sm ${
							refreshMessage.includes('Successfully') 
								? 'bg-green-50 text-green-700 border border-green-200' 
								: 'bg-red-50 text-red-700 border border-red-200'
						}`}>
							{refreshMessage}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Email Collection Section */}
			<Card>
				<CardHeader>
					<div className="flex justify-between items-center">
						<div>
							<CardTitle>📧 Collected Emails ({emails.length})</CardTitle>
							<CardDescription>User email addresses collected with consent</CardDescription>
						</div>
						<div className="space-x-2">
							<Button onClick={copyEmails} variant="outline" size="sm">
								📋 Copy All
							</Button>
							<Button onClick={exportAsCSV} size="sm">
								📥 Export CSV
							</Button>
						</div>
					</div>
				</CardHeader>
				<CardContent>
					{emails.length === 0 ? (
						<p className="text-gray-500 text-center py-8">No emails collected yet.</p>
					) : (
						<div className="space-y-3 max-h-96 overflow-y-auto">
							{emails.map((email, index) => (
								<div key={index} className="border p-3 rounded-lg">
									<div className="font-mono text-lg">{email.email}</div>
									<div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mt-1">
										<span>{new Date(email.timestamp).toLocaleString()}</span>
										<span>•</span>
										<Badge variant={email.consent ? "default" : "destructive"} className="text-xs">
											{email.consent ? "✅ Consented" : "❌ No Consent"}
										</Badge>
										<span>•</span>
										<span>{email.source}</span>
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
};

export default AdminPage; 