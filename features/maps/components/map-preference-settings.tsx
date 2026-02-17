"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Settings } from "lucide-react";
import React from "react";
import { MAP_OPTIONS } from "../constants/map-options";
import { useMapPreference } from "../hooks/use-map-preference";
import type { MapProvider } from "../types";

interface MapPreferenceSettingsProps {
	className?: string;
	showTitle?: boolean;
	compact?: boolean;
}

export const MapPreferenceSettings: React.FC<MapPreferenceSettingsProps> = ({
	className = "",
	showTitle = true,
	compact = false,
}) => {
	const { mapPreference, setMapPreference, isLoaded } = useMapPreference();

	if (!isLoaded) {
		return compact ? (
			<div className={`animate-pulse ${className}`}>
				<div className="h-8 bg-muted rounded"></div>
			</div>
		) : (
			<Card className={className}>
				<CardContent className="p-4">
					<div className="animate-pulse space-y-2">
						<div className="h-4 bg-muted rounded w-1/2"></div>
						<div className="h-8 bg-muted rounded"></div>
					</div>
				</CardContent>
			</Card>
		);
	}

	const currentOption = MAP_OPTIONS.find(
		(option) => option.id === mapPreference,
	);

	if (compact) {
		return (
			<div className={`space-y-2 ${className}`}>
				{showTitle && (
					<div className="flex items-center gap-2">
						<Settings className="h-4 w-4 text-muted-foreground" />
						<span className="text-sm font-medium">Map Preference</span>
					</div>
				)}
				<Select
					value={mapPreference}
					onValueChange={(value: MapProvider) => setMapPreference(value)}
				>
					<SelectTrigger className="w-full">
						<SelectValue>
							<div className="flex items-center gap-2">
								<span>{currentOption?.icon}</span>
								<span className="text-sm">{currentOption?.name}</span>
							</div>
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{MAP_OPTIONS.map((option) => (
							<SelectItem key={option.id} value={option.id}>
								<div className="flex items-center gap-2">
									<span>{option.icon}</span>
									<div>
										<div className="font-medium">{option.name}</div>
										<div className="text-xs text-muted-foreground">
											{option.description}
										</div>
									</div>
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		);
	}

	return (
		<Card className={className}>
			{showTitle && (
				<CardHeader className="pb-3">
					<CardTitle className="text-base flex items-center gap-2">
						<Settings className="h-4 w-4" />
						Map Preference
					</CardTitle>
				</CardHeader>
			)}
			<CardContent className="space-y-3">
				<div className="text-sm text-muted-foreground">
					Choose how you'd like to open locations in maps:
				</div>

				<Select
					value={mapPreference}
					onValueChange={(value: MapProvider) => setMapPreference(value)}
				>
					<SelectTrigger>
						<SelectValue>
							<div className="flex items-center gap-2">
								<span>{currentOption?.icon}</span>
								<span>{currentOption?.name}</span>
							</div>
						</SelectValue>
					</SelectTrigger>
					<SelectContent>
						{MAP_OPTIONS.map((option) => (
							<SelectItem key={option.id} value={option.id}>
								<div className="flex items-center gap-3">
									<span className="text-lg">{option.icon}</span>
									<div>
										<div className="font-medium">{option.name}</div>
										<div className="text-xs text-muted-foreground">
											{option.description}
										</div>
									</div>
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
					<p className="font-medium mb-1">💡 How it works</p>
					<ul className="space-y-1">
						<li>
							<strong>Auto-detect:</strong> Uses Apple Maps on iOS/Mac, Google
							Maps elsewhere
						</li>
						<li>
							<strong>Google Maps:</strong> Always opens in Google Maps (web or
							app)
						</li>
						<li>
							<strong>Apple Maps:</strong> Uses Apple Maps app, falls back to
							Google Maps
						</li>
						<li>
							<strong>Ask me each time:</strong> Shows a selection modal when
							you click locations
						</li>
					</ul>
				</div>

				{mapPreference === "ask" && (
					<div className="text-xs text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
						<p className="font-medium mb-1">🎯 Test the Modal</p>
						<p>
							With "Ask me each time" selected, click any location in an event
							modal to see the map selection options.
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
};
