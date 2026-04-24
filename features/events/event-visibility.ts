export const getVisibleEventCount = (
	totalEvents: number,
	options: {
		isAuthenticated: boolean;
		isAuthResolved: boolean;
	},
): number => {
	if (!options.isAuthResolved || options.isAuthenticated || totalEvents <= 2) {
		return totalEvents;
	}

	return Math.ceil(totalEvents / 2);
};
