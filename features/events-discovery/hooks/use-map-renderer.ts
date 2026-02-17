"use client";

import { useCallback, useEffect, useState } from "react";

const MAP_RENDERER_STORAGE_KEY = "fete:preferred-map";

type MapRenderer = "classic" | "maplibre";

export const useMapRenderer = () => {
	const [renderer, setRendererState] = useState<MapRenderer>("maplibre");

	useEffect(() => {
		const savedPreference = localStorage.getItem(MAP_RENDERER_STORAGE_KEY);
		if (savedPreference === "classic" || savedPreference === "maplibre") {
			setRendererState(savedPreference);
		}
	}, []);

	const setRenderer = useCallback((nextRenderer: MapRenderer) => {
		setRendererState(nextRenderer);
		localStorage.setItem(MAP_RENDERER_STORAGE_KEY, nextRenderer);
	}, []);

	return {
		renderer,
		useMapLibre: renderer === "maplibre",
		setRenderer,
	};
};
