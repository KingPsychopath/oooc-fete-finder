import type { MapOption } from "../types/map-preferences";

export const MAP_PREFERENCE_STORAGE_KEY = "fete_finder_map_preference";

export const MAP_OPTIONS: MapOption[] = [
	{
		id: "google",
		name: "Google Maps",
		icon: "🗺️",
		description: "Works on all platforms",
	},
	{
		id: "apple",
		name: "Apple Maps",
		icon: "🍎",
		description: "iOS & Mac native app",
	},
	{
		id: "system",
		name: "Auto-detect",
		icon: "🤖",
		description: "Choose based on your device",
	},
	{
		id: "ask",
		name: "Ask me each time",
		icon: "❓",
		description: "Show options every time",
	},
] as const;
