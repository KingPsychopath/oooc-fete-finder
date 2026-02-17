import type { Event } from "@/features/events/types";
import React from "react";

interface SelectedEventDisplayProps {
	selectedEvent: Event | null;
	onClose: () => void;
}

export const SelectedEventDisplay: React.FC<SelectedEventDisplayProps> = ({
	selectedEvent,
	onClose,
}) => {
	if (!selectedEvent) return null;

	return (
		<div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
			<div className="flex items-center justify-between mb-4">
				<h3 className="text-xl font-semibold text-gray-900 dark:text-white">
					Selected Event
				</h3>
				<button
					onClick={onClose}
					className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
				>
					✕
				</button>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<h4 className="font-semibold text-gray-900 dark:text-white mb-2">
						{selectedEvent.name}
						{selectedEvent.isOOOCPick && <span className="ml-2">🌟</span>}
					</h4>
					<div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
						<p>
							<strong>Day:</strong> {selectedEvent.day}
						</p>
						<p>
							<strong>Time:</strong> {selectedEvent.time}
						</p>
						<p>
							<strong>Location:</strong> {selectedEvent.location || "TBA"}
						</p>
						<p>
							<strong>Arrondissement:</strong> {selectedEvent.arrondissement}e
						</p>
						<p>
							<strong>Price:</strong> {selectedEvent.price}
						</p>
						<p>
							<strong>Genres:</strong> {selectedEvent.genre.join(", ")}
						</p>
					</div>
				</div>
				<div>
					<h5 className="font-semibold text-gray-900 dark:text-white mb-2">
						Technical Details
					</h5>
					<div className="space-y-1 text-sm text-gray-600 dark:text-gray-300">
						<p>
							<strong>Has Coordinates:</strong>{" "}
							{selectedEvent.coordinates ? "Yes" : "No"}
						</p>
						{selectedEvent.coordinates && (
							<>
								<p>
									<strong>Latitude:</strong>{" "}
									{selectedEvent.coordinates.lat.toFixed(4)}
								</p>
								<p>
									<strong>Longitude:</strong>{" "}
									{selectedEvent.coordinates.lng.toFixed(4)}
								</p>
							</>
						)}
						<p>
							<strong>Venue Type:</strong> {selectedEvent.venueTypes.join(", ")}
						</p>
						<p>
							<strong>Verified:</strong> {selectedEvent.verified ? "Yes" : "No"}
						</p>
					</div>
				</div>
			</div>
		</div>
	);
};
