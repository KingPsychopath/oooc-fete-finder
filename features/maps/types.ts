export type MapProvider = "system" | "google" | "apple" | "ask";

export interface MapOption {
	id: MapProvider;
	name: string;
	icon: string;
	description: string;
}

export interface MapPreferenceState {
	mapPreference: MapProvider;
	setMapPreference: (preference: MapProvider) => void;
	isLoaded: boolean;
}

export interface LocationData {
	location: string;
	arrondissement?: number | "unknown";
}
