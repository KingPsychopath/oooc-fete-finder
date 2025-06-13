"use client";

import React, { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Trash2,
	AlertTriangle,
	CheckCircle,
	Loader2,
	Settings,
	Database,
} from "lucide-react";
import { cleanupSheetDuplicates } from "@/app/actions";
import { getSessionToken } from "@/lib/admin-session";

type SheetActionsCardProps = {
	isAuthenticated: boolean;
	onActionComplete?: () => void;
};

export const SheetActionsCard = ({
	isAuthenticated,
	onActionComplete,
}: SheetActionsCardProps) => {
	const [cleanupLoading, setCleanupLoading] = useState(false);
	const [cleanupResult, setCleanupResult] = useState<{
		type: "success" | "error";
		message: string;
		removed?: number;
	} | null>(null);

	const handleCleanupDuplicates = async () => {
		// Don't proceed if not authenticated
		if (!isAuthenticated) {
			setCleanupResult({
				type: "error",
				message: "Authentication required to perform maintenance actions",
			});
			return;
		}

		// Get session token - this should be available if user is authenticated
		const sessionToken = getSessionToken();
		if (!sessionToken) {
			setCleanupResult({
				type: "error",
				message: "No valid session found. Please re-authenticate.",
			});
			return;
		}

		setCleanupLoading(true);
		setCleanupResult(null);

		try {
			const result = await cleanupSheetDuplicates(sessionToken);

			if (result.success) {
				setCleanupResult({
					type: "success",
					message: result.message || "Cleanup completed successfully",
					removed: result.removed || 0,
				});

				// Trigger refresh of other components
				if (onActionComplete) {
					onActionComplete();
				}
			} else {
				setCleanupResult({
					type: "error",
					message: result.error || "Failed to cleanup duplicates",
				});
			}
		} catch {
			setCleanupResult({
				type: "error",
				message: "Error during cleanup operation",
			});
		} finally {
			setCleanupLoading(false);
		}
	};

	const clearResult = () => {
		setCleanupResult(null);
	};

	// Show placeholder when not authenticated
	if (!isAuthenticated) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Settings className="h-5 w-5" />
						Sheet Maintenance
					</CardTitle>
					<CardDescription>
						Advanced maintenance actions for your Google Sheet
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8 text-muted-foreground">
						<Database className="h-8 w-8 mx-auto mb-2" />
						<p>Please authenticate to access maintenance actions</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Settings className="h-5 w-5" />
					Sheet Maintenance
				</CardTitle>
				<CardDescription>
					Advanced maintenance actions for your Google Sheet
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				{/* Cleanup Result Alert */}
				{cleanupResult && (
					<Alert
						className={
							cleanupResult.type === "success"
								? "border-green-500"
								: "border-red-500"
						}
					>
						<div className="flex items-center gap-2">
							{cleanupResult.type === "success" ? (
								<CheckCircle className="h-4 w-4 text-green-600" />
							) : (
								<AlertTriangle className="h-4 w-4 text-red-600" />
							)}
							<AlertDescription className="flex-grow">
								<strong>
									{cleanupResult.type === "success" ? "Success: " : "Error: "}
								</strong>
								{cleanupResult.message}
								{cleanupResult.removed !== undefined && (
									<span className="block text-sm mt-1">
										Removed {cleanupResult.removed} duplicate entries
									</span>
								)}
							</AlertDescription>
							<Button
								onClick={clearResult}
								variant="ghost"
								size="sm"
								className="ml-2"
							>
								×
							</Button>
						</div>
					</Alert>
				)}

				{/* Duplicate Cleanup Section */}
				<div className="space-y-4">
					<div className="flex items-start gap-4">
						<div className="flex-shrink-0">
							<div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
								<Trash2 className="h-5 w-5 text-red-600" />
							</div>
						</div>

						<div className="flex-grow space-y-3">
							<div>
								<h3 className="text-sm font-semibold text-foreground">
									Remove Duplicate Emails
								</h3>
								<p className="text-sm text-muted-foreground">
									Scan the Google Sheet and remove entries with duplicate email
									addresses. Keeps the most recent entry for each email.
								</p>
							</div>

							<div className="flex items-center gap-3">
								<Button
									onClick={handleCleanupDuplicates}
									variant="destructive"
									size="sm"
									disabled={cleanupLoading}
									className="flex items-center gap-2"
								>
									{cleanupLoading ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<Trash2 className="h-4 w-4" />
									)}
									{cleanupLoading ? "Cleaning..." : "Remove Duplicates"}
								</Button>

								{cleanupLoading && (
									<span className="text-sm text-muted-foreground">
										This may take a few moments...
									</span>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Warning Section */}
				<Alert>
					<AlertTriangle className="h-4 w-4" />
					<AlertDescription>
						<strong>Important:</strong> Maintenance actions directly modify your
						Google Sheet data. These operations cannot be undone. Use with
						caution and ensure you have backups if needed.
					</AlertDescription>
				</Alert>
			</CardContent>
		</Card>
	);
};
