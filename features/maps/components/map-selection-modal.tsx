"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppHaptics } from "@/hooks/useAppHaptics";
import { MapPin, Settings, X } from "lucide-react";
import React from "react";
import { MAP_OPTIONS } from "../constants/map-options";
import type { MapProvider } from "../types";

interface MapSelectionModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSelect: (provider: MapProvider) => void;
	title?: string;
	description?: string;
	showRememberOption?: boolean;
	onRememberPreference?: (provider: MapProvider) => void;
}

export const MapSelectionModal: React.FC<MapSelectionModalProps> = ({
	isOpen,
	onClose,
	onSelect,
	title = "🗺️ Choose Your Map App",
	description = "How would you like to open this location?",
	showRememberOption = true,
	onRememberPreference,
}) => {
	const haptics = useAppHaptics();

	if (!isOpen) return null;

	const handleSelect = (provider: MapProvider, remember: boolean = false) => {
		haptics.success();
		if (remember && onRememberPreference) {
			onRememberPreference(provider);
		}
		onSelect(provider);
		onClose();
	};

	return (
		<div
			className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50"
			style={{
				paddingTop: "max(env(safe-area-inset-top), 1rem)",
				paddingRight: "max(env(safe-area-inset-right), 1rem)",
				paddingBottom: "max(env(safe-area-inset-bottom), 1rem)",
				paddingLeft: "max(env(safe-area-inset-left), 1rem)",
			}}
			onPointerDown={(pointerEvent) => {
				if (pointerEvent.target !== pointerEvent.currentTarget) return;
				haptics.light();
				onClose();
			}}
		>
			<Card className="max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] w-full max-w-md overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-200">
				<CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
					<div className="flex-1">
						<CardTitle className="text-lg flex items-center gap-2">
							<MapPin className="h-5 w-5 text-primary" />
							{title}
						</CardTitle>
						{description && (
							<p className="text-sm text-muted-foreground mt-1">
								{description}
							</p>
						)}
						<div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg">
							<p className="text-xs text-blue-700 dark:text-blue-300">
								💡 <strong>First time?</strong> Choose your preferred map app or
								set a default for future use.
							</p>
						</div>
					</div>
					<Button
						variant="outline"
						size="icon"
						onClick={() => {
							haptics.light();
							onClose();
						}}
						className="h-8 w-8"
					>
						<X className="h-4 w-4" />
					</Button>
				</CardHeader>

				<CardContent className="space-y-3">
					{MAP_OPTIONS.filter((option) => option.id !== "ask").map((option) => (
						<div
							key={option.id}
							className="flex items-center justify-between gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
						>
							<div className="flex items-center gap-3 flex-1">
								<span className="text-xl">{option.icon}</span>
								<div className="flex-1">
									<div className="font-medium">{option.name}</div>
									<div className="text-xs text-muted-foreground">
										{option.description}
									</div>
								</div>
							</div>
							<div className="flex gap-2">
								{showRememberOption && onRememberPreference && (
									<Button
										variant="outline"
										size="sm"
										onClick={() => handleSelect(option.id, true)}
										className="text-xs"
									>
										<Settings className="h-3 w-3 mr-1" />
										Set Default
									</Button>
								)}
								<Button
									variant={option.id === "system" ? "default" : "outline"}
									size="sm"
									onClick={() => handleSelect(option.id, false)}
								>
									Open
								</Button>
							</div>
						</div>
					))}

					<div className="pt-3 border-t">
						<Button
							variant="outline"
							onClick={() => {
								haptics.light();
								onClose();
							}}
							className="w-full"
						>
							Cancel
						</Button>
					</div>

					{showRememberOption && (
						<div className="text-xs text-muted-foreground bg-muted p-3 rounded-lg">
							<p className="font-medium mb-1">⚡ Quick tip</p>
							<p>
								Click <strong>"Set Default"</strong> to remember your choice, or{" "}
								<strong>"Open"</strong> for just this time. You can always
								change your preference in settings later.
							</p>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
};
