"use client";

import React, { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle, Database } from "lucide-react";
import { DynamicSheetConfig } from "../types";
import { setDynamicSheet } from "@/app/actions";
import { getSessionToken } from "@/lib/admin-session";

type DynamicSheetCardProps = {
	dynamicConfig: DynamicSheetConfig;
	isAuthenticated: boolean;
	onConfigUpdate?: () => void;
};

export const DynamicSheetCard = ({
	dynamicConfig,
	isAuthenticated,
	onConfigUpdate,
}: DynamicSheetCardProps) => {
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [successMessage, setSuccessMessage] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		// Don't proceed if not authenticated
		if (!isAuthenticated) {
			setError("Authentication required to modify sheet configuration");
			return;
		}

		// Get session token - this should be available if user is authenticated
		const sessionToken = getSessionToken();
		if (!sessionToken) {
			setError("No valid session found. Please re-authenticate.");
			return;
		}

		setIsLoading(true);
		setError("");
		setSuccessMessage("");

		try {
			const formData = new FormData(e.target as HTMLFormElement);
			formData.set("adminKey", sessionToken); // Use session token for authentication

			const result = await setDynamicSheet(formData);

			if (result.success) {
				setSuccessMessage(result.message);
				// Notify parent component to refresh its data
				if (onConfigUpdate) {
					onConfigUpdate();
				}
			} else {
				setError(result.message);
			}
		} catch {
			setError("Failed to set dynamic sheet");
		} finally {
			setIsLoading(false);
		}
	};

	const clearMessages = () => {
		setError("");
		setSuccessMessage("");
	};

	// Show placeholder when not authenticated
	if (!isAuthenticated) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>📊 Dynamic Google Sheet Override</CardTitle>
					<CardDescription>
						Temporarily override the Google Sheet source for testing different
						data
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8 text-muted-foreground">
						<Database className="h-8 w-8 mx-auto mb-2" />
						<p>Please authenticate to access sheet configuration</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>📊 Dynamic Google Sheet Override</CardTitle>
				<CardDescription>
					Temporarily override the Google Sheet source for testing different
					data
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				{/* Status Messages */}
				{error && (
					<Alert className="border-red-500">
						<AlertTriangle className="h-4 w-4 text-red-600" />
						<AlertDescription className="flex justify-between items-center">
							<span>
								<strong>Error:</strong> {error}
							</span>
							<Button
								onClick={clearMessages}
								variant="ghost"
								size="sm"
								className="ml-2"
							>
								×
							</Button>
						</AlertDescription>
					</Alert>
				)}

				{successMessage && (
					<Alert className="border-green-500">
						<CheckCircle className="h-4 w-4 text-green-600" />
						<AlertDescription className="flex justify-between items-center">
							<span>
								<strong>Success:</strong> {successMessage}
							</span>
							<Button
								onClick={clearMessages}
								variant="ghost"
								size="sm"
								className="ml-2"
							>
								×
							</Button>
						</AlertDescription>
					</Alert>
				)}

				<div className="p-4 bg-muted rounded-lg">
					<h3 className="font-medium mb-2">Current Configuration:</h3>
					<div className="space-y-1 text-sm">
						{dynamicConfig.hasDynamicOverride ? (
							<>
								<p>
									<strong>🔄 Active Override:</strong> {dynamicConfig.sheetId}
								</p>
								<p>
									<strong>Range:</strong> {dynamicConfig.range}
								</p>
								<p className="text-muted-foreground">
									Environment sheet:{" "}
									{dynamicConfig.envSheetId || "Not configured"}
								</p>
							</>
						) : (
							<>
								<p>
									<strong>📝 Using Environment Variable:</strong>{" "}
									{dynamicConfig.envSheetId || "Not configured"}
								</p>
								<p>
									<strong>Range:</strong> {dynamicConfig.envRange}
								</p>
								<p className="text-muted-foreground">
									No dynamic override active
								</p>
							</>
						)}
					</div>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<Label htmlFor="sheetInput">Google Sheet URL or ID:</Label>
						<Input
							type="text"
							name="sheetInput"
							id="sheetInput"
							placeholder="https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/edit or just the ID"
							defaultValue={
								dynamicConfig.hasDynamicOverride
									? dynamicConfig.sheetId || ""
									: ""
							}
						/>
						<p className="text-xs text-muted-foreground mt-1">
							Leave empty to clear override and use environment variables
						</p>
					</div>

					<div>
						<Label htmlFor="sheetRange">Sheet Range (optional):</Label>
						<Input
							type="text"
							name="sheetRange"
							id="sheetRange"
							placeholder="A:Z (default)"
							defaultValue={dynamicConfig.range || "A:Z"}
						/>
					</div>

					<div className="flex gap-2">
						<Button type="submit" disabled={isLoading}>
							{isLoading ? "🔄 Setting..." : "🔄 Set Dynamic Sheet"}
						</Button>
					</div>
				</form>

				<div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
					<p className="text-sm text-blue-800">
						<strong>💡 How it works:</strong> This temporarily overrides the
						Google Sheet ID from your environment variables. Changes are stored
						in memory and will reset when the server restarts. Perfect for
						testing different sheets!
					</p>
				</div>
			</CardContent>
		</Card>
	);
};
