export const OVERLAY_BODY_ATTRIBUTE = {
	EVENT_MODAL: "data-event-modal-open",
	FILTER_PANEL: "data-filter-panel-open",
	FETE_FINDER_TOUR: "data-fete-finder-tour-open",
	TICKET_EXCHANGE_MODAL: "data-ticket-exchange-modal-open",
} as const;

export function setBodyOverlayAttribute(
	attribute: string,
	isOpen: boolean,
): void {
	if (typeof document === "undefined") {
		return;
	}

	if (isOpen) {
		document.body.setAttribute(attribute, "true");
		return;
	}

	document.body.removeAttribute(attribute);
}

export function hasActiveBodyOverlay(): boolean {
	if (typeof document === "undefined") {
		return false;
	}

	return Object.values(OVERLAY_BODY_ATTRIBUTE).some((attribute) =>
		document.body.hasAttribute(attribute),
	);
}
