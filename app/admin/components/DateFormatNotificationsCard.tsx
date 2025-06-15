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
	AlertTriangle,
	Calendar,
	Clock,
	CheckCircle,
	Copy,
	RefreshCw,
	HelpCircle,
	Database,
} from "lucide-react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { analyzeDateFormats } from "@/lib/data-management/actions";
import { getSessionToken } from "@/lib/admin/admin-session";
import type { DateFormatWarning } from "@/lib/data-management/event-transformer";

type DateFormatNotificationsCardProps = {
	isAuthenticated: boolean;
};

export const DateFormatNotificationsCard = ({
	isAuthenticated,
}: DateFormatNotificationsCardProps) => {
	const [realWarnings, setRealWarnings] = useState<DateFormatWarning[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [lastUpdate, setLastUpdate] = useState<string>("");

	// Example data for demonstration/education purposes
	const exampleWarnings: DateFormatWarning[] = [
		{
			originalValue: "06/07/2025 20:07:39",
			eventName: "Summer Jazz Festival",
			columnType: "featured",
			warningType: "ambiguous",
			potentialFormats: {
				us: {
					date: "2025-06-07T20:07:39.000Z",
					description: "US: Jun 07, 2025 8:07 PM",
				},
				uk: {
					date: "2025-07-06T20:07:39.000Z",
					description: "UK: 06 Jul, 2025 8:07 PM",
				},
				iso: "2025-07-06T20:07:39",
			},
			detectedFormat: "UK (DD/MM/YYYY) - ASSUMED",
			recommendedAction: "Use ISO format or month name to avoid ambiguity",
			rowIndex: 1,
		},
		{
			originalValue: "15/06/2025 14:30:00",
			eventName: "Outdoor Market",
			columnType: "featured",
			warningType: "future_featured",
			potentialFormats: {
				us: {
					date: "Invalid (month 15)",
					description: "Invalid US format",
				},
				uk: {
					date: "2025-06-15T14:30:00.000Z",
					description: "UK: 15 Jun, 2025 2:30 PM",
				},
				iso: "2025-06-15T14:30:00",
			},
			detectedFormat: "UK (DD/MM/YYYY) - CLEAR",
			recommendedAction: "Future date detected - featuring started immediately",
			rowIndex: 2,
		},
		{
			originalValue: "32/13/2025 25:00:00",
			eventName: "Invalid Event",
			columnType: "date",
			warningType: "invalid",
			potentialFormats: {
				us: {
					date: "Invalid",
					description: "Invalid: month 32, day 13",
				},
				uk: {
					date: "Invalid",
					description: "Invalid: day 32, month 13",
				},
				iso: "Invalid format",
			},
			detectedFormat: "INVALID",
			recommendedAction: "Fix date format - values exceed valid ranges",
			rowIndex: 3,
		},
	];

	const loadDateWarnings = useCallback(async () => {
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
			const result = await analyzeDateFormats(sessionToken);

			if (result.success) {
				setRealWarnings(result.warnings || []);
				setLastUpdate(new Date().toLocaleTimeString());
			} else {
				setError(result.error || "Failed to analyze date formats");
			}
		} catch {
			setError("Error loading date format warnings");
		} finally {
			setLoading(false);
		}
	}, [isAuthenticated]);

	// Auto-refresh every 2 minutes (less frequent than other stats), but only when authenticated
	useEffect(() => {
		if (!isAuthenticated) {
			setRealWarnings([]);
			setError("");
			return;
		}

		loadDateWarnings(); // Initial load

		const interval = setInterval(loadDateWarnings, 120000);
		return () => clearInterval(interval);
	}, [loadDateWarnings, isAuthenticated]);

	const getWarningColor = (warningType: string) => {
		switch (warningType) {
			case "ambiguous":
				return "bg-yellow-100 text-yellow-800 border-yellow-200";
			case "future_featured":
				return "bg-blue-100 text-blue-800 border-blue-200";
			case "invalid":
				return "bg-red-100 text-red-800 border-red-200";
			default:
				return "bg-gray-100 text-gray-800 border-gray-200";
		}
	};

	const getWarningIcon = (warningType: string) => {
		switch (warningType) {
			case "ambiguous":
				return <AlertTriangle className="h-4 w-4" />;
			case "future_featured":
				return <Calendar className="h-4 w-4" />;
			case "invalid":
				return <AlertTriangle className="h-4 w-4" />;
			default:
				return <Clock className="h-4 w-4" />;
		}
	};

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		// You could add a toast notification here
	};

	const renderWarning = (warning: DateFormatWarning, index: number) => (
		<div key={index} className="border rounded-lg p-4 space-y-3">
			{/* Warning Header */}
			<div className="flex items-start justify-between">
				<div className="flex items-start gap-2">
					<Badge
						className={`${getWarningColor(warning.warningType)} flex items-center gap-1`}
					>
						{getWarningIcon(warning.warningType)}
						{warning.warningType.toUpperCase()}
					</Badge>
					<div>
						<p className="font-medium">
							{warning.eventName || "Unknown Event"}
						</p>
						<p className="text-sm text-muted-foreground">
							{warning.columnType} column: "
							<code className="bg-gray-100 px-1 rounded">
								{warning.originalValue}
							</code>
							"
						</p>
					</div>
				</div>
			</div>

			{/* Format Interpretations */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
				<div className="space-y-2">
					<h4 className="text-sm font-medium">Potential Interpretations:</h4>
					<div className="space-y-1 text-sm">
						<div className="flex justify-between items-center p-2 bg-blue-50 rounded">
							<span>🇺🇸 US Format:</span>
							<code className="text-xs">
								{warning.potentialFormats.us.description}
							</code>
						</div>
						<div className="flex justify-between items-center p-2 bg-green-50 rounded">
							<span>🇬🇧 UK Format:</span>
							<code className="text-xs">
								{warning.potentialFormats.uk.description}
							</code>
						</div>
					</div>
				</div>

				<div className="space-y-2">
					<h4 className="text-sm font-medium">Recommended Solutions:</h4>
					<div className="space-y-2">
						<div className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
							<span>✅ ISO Format:</span>
							<div className="flex items-center gap-1">
								<code className="text-xs">{warning.potentialFormats.iso}</code>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => copyToClipboard(warning.potentialFormats.iso)}
									className="h-6 w-6 p-0"
								>
									<Copy className="h-3 w-3" />
								</Button>
							</div>
						</div>
						<div className="text-xs text-muted-foreground">
							💡 {warning.recommendedAction}
						</div>
					</div>
				</div>
			</div>

			{/* Detection Result */}
			<div className="pt-2 border-t">
				<div className="flex items-center justify-between text-sm">
					<span>Current Detection:</span>
					<Badge variant="outline">{warning.detectedFormat}</Badge>
				</div>
			</div>
		</div>
	);

	// Show placeholder when not authenticated
	if (!isAuthenticated) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Calendar className="h-5 w-5" />
						Date Format Notifications
					</CardTitle>
					<CardDescription>
						Notifications about ambiguous or problematic date formats
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-center py-8 text-muted-foreground">
						<Database className="h-8 w-8 mx-auto mb-2" />
						<p>Please authenticate to view date format analysis</p>
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
						<Calendar className="h-5 w-5" />
						Date Format Notifications
					</CardTitle>
					<CardDescription>
						Notifications about ambiguous or problematic date formats
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="text-center py-4 text-red-600">
						<AlertTriangle className="h-8 w-8 mx-auto mb-2" />
						<p>{error}</p>
						<Button
							onClick={loadDateWarnings}
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
							<Calendar className="h-5 w-5" />
							Date Format Notifications
							{realWarnings.length > 0 && (
								<Badge variant="secondary" className="ml-2">
									{realWarnings.length}
								</Badge>
							)}
						</CardTitle>
						<CardDescription>
							Ambiguous date formats and recommendations for clarity
							{lastUpdate && (
								<span className="text-xs text-muted-foreground ml-2">
									• Updated {lastUpdate}
								</span>
							)}
						</CardDescription>
					</div>
					<Button
						onClick={loadDateWarnings}
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
				{loading && realWarnings.length === 0 ? (
					<div className="text-center py-8">
						<RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
						<p className="text-muted-foreground">Analyzing date formats...</p>
					</div>
				) : (
					<div className="space-y-6">
						{/* Real Warnings Section */}
						{realWarnings.length > 0 ? (
							<div className="space-y-4">
								<h3 className="text-lg font-semibold flex items-center gap-2">
									<AlertTriangle className="h-5 w-5 text-orange-600" />
									Current Issues Detected ({realWarnings.length})
								</h3>
								{realWarnings.map((warning, index) =>
									renderWarning(warning, index),
								)}
							</div>
						) : (
							<div className="text-center py-4">
								<CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
								<p className="text-green-600 font-medium">
									All date formats look good!
								</p>
								<p className="text-sm text-muted-foreground mt-1">
									No ambiguous or problematic date formats detected in your
									current data.
								</p>
							</div>
						)}

						<Separator />

						{/* Examples Section in Accordion */}
						<Accordion type="single" collapsible className="w-full">
							<AccordionItem value="examples">
								<AccordionTrigger className="text-base font-medium">
									<div className="flex items-center gap-2">
										<HelpCircle className="h-4 w-4" />
										Common Date Format Issues (Examples)
									</div>
								</AccordionTrigger>
								<AccordionContent>
									<div className="space-y-4">
										<p className="text-sm text-muted-foreground mb-4">
											These examples show common date format issues you might
											encounter:
										</p>
										{exampleWarnings.map((warning, index) =>
											renderWarning(warning, index),
										)}
									</div>
								</AccordionContent>
							</AccordionItem>
						</Accordion>

						{/* Help Section */}
						<div className="bg-blue-50 p-4 rounded-lg">
							<h4 className="font-medium mb-2 flex items-center gap-2">
								<CheckCircle className="h-4 w-4 text-blue-600" />
								Best Practices for Date Formats
							</h4>
							<div className="space-y-2 text-sm text-blue-800">
								<div>
									<strong>✅ Recommended:</strong> ISO format{" "}
									<code className="bg-blue-100 px-1 rounded">
										2025-07-06T20:07:39
									</code>
								</div>
								<div>
									<strong>✅ Alternative:</strong> Month names{" "}
									<code className="bg-blue-100 px-1 rounded">
										06-Jul-2025 20:07
									</code>
								</div>
								<div>
									<strong>⚠️ Ambiguous:</strong> Numeric{" "}
									<code className="bg-yellow-100 px-1 rounded">
										06/07/2025 20:07:39
									</code>{" "}
									(could be Jun 7 or Jul 6)
								</div>
								<div>
									<strong>💡 For European apps:</strong> UK format (DD/MM/YYYY)
									is assumed by default
								</div>
							</div>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
};
