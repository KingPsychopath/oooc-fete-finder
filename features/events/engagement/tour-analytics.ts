export type TourInteractionAction =
	| "prompt_shown"
	| "prompt_dismissed"
	| "start"
	| "complete"
	| "skip"
	| "auth_required";

export type TourInteraction = {
	action: string;
	stepId: string | null;
	source: string | null;
};

const TOUR_STEP_LABELS: Record<string, string> = {
	picks: "Curated picks",
	map: "Map",
	filters: "Filters",
	search: "Search",
	events: "Event details",
};

const TOUR_STEP_ORDER = Object.keys(TOUR_STEP_LABELS);
const TOUR_STEP_COUNT = TOUR_STEP_ORDER.length;

const TOUR_SOURCE_LABELS: Record<string, string> = {
	auto: "auto prompt",
	backdrop: "backdrop",
	manual: "manual request",
	keyboard: "keyboard",
	skip_button: "skip button",
	close_button: "close button",
	done_button: "done button",
};

const SOURCE_ONLY_ACTIONS = new Set([
	"prompt_shown",
	"prompt_dismissed",
	"auth_required",
]);

const formatContextLabel = (value: string): string =>
	value
		.split(/[-_\s:]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");

export const serializeTourInteraction = (input: {
	action: TourInteractionAction;
	stepId?: string;
	source?: string;
}): string => [input.action, input.stepId ?? "", input.source ?? ""].join(":");

export const parseTourInteraction = (
	value: string | null | undefined,
): TourInteraction | null => {
	const normalized = value?.trim();
	if (!normalized) return null;
	const [action, stepId, source] = normalized
		.split(":", 3)
		.map((segment) => segment.trim());
	if (!action) return null;
	if (SOURCE_ONLY_ACTIONS.has(action) && stepId && !source) {
		return {
			action,
			stepId: null,
			source: stepId,
		};
	}
	return {
		action,
		stepId: stepId || null,
		source: source || null,
	};
};

export const getTourSourceLabel = (source: string | null): string => {
	if (!source) return "";
	return TOUR_SOURCE_LABELS[source] ?? source.replaceAll("_", " ");
};

export const getTourProgressLabel = (
	recentTourInteractions: TourInteraction[],
): string => {
	const latest = recentTourInteractions[0];
	if (!latest) return "No tour interaction";

	const action = latest.action.toLowerCase();
	const stepLabel = latest.stepId
		? (TOUR_STEP_LABELS[latest.stepId] ?? latest.stepId)
		: null;
	const stepIndex = latest.stepId
		? TOUR_STEP_ORDER.indexOf(latest.stepId) + 1
		: null;
	const stepProgress =
		stepIndex !== null && stepIndex > 0
			? ` (${stepLabel ?? latest.stepId}, step ${stepIndex} of ${TOUR_STEP_COUNT})`
			: "";
	const sourceLabel = getTourSourceLabel(latest.source);
	const sourceProgress = sourceLabel ? ` via ${sourceLabel}` : "";

	if (action === "complete") {
		return `Tour completed${stepProgress}${sourceProgress}`;
	}
	if (action === "skip") {
		return `Tour skipped${stepProgress}${sourceProgress}`;
	}
	if (action === "auth_required") {
		return `Tour requires auth to continue${sourceLabel ? ` (${sourceLabel})` : ""}`;
	}
	if (action === "start") {
		return `Tour in progress${stepProgress || ""}`;
	}
	if (action === "prompt_shown") {
		return `Tour prompt shown${sourceLabel ? ` (${sourceLabel})` : ""}`;
	}
	if (action === "prompt_dismissed") {
		return `Tour prompt dismissed${sourceLabel ? ` (${sourceLabel})` : ""}`;
	}
	return `Tour activity (${latest.action})`;
};

export const formatTourSignal = (
	value: string,
): { label: string; meta: string } => {
	const parsed = parseTourInteraction(value);
	if (!parsed) return { label: "Unknown tour activity", meta: "" };

	const source = getTourSourceLabel(parsed.source);
	const step = parsed.stepId
		? (TOUR_STEP_LABELS[parsed.stepId] ?? formatContextLabel(parsed.stepId))
		: null;
	const sourceMeta = source ? `via ${source}` : "";

	if (parsed.action === "prompt_shown") {
		return { label: "Prompt shown", meta: source || "Tour prompt" };
	}
	if (parsed.action === "prompt_dismissed") {
		return { label: "Prompt dismissed", meta: source || "Tour prompt" };
	}
	if (parsed.action === "start") {
		return { label: "Tour started", meta: sourceMeta };
	}
	if (parsed.action === "complete") {
		return {
			label: "Tour completed",
			meta: [step, sourceMeta].filter(Boolean).join(" / "),
		};
	}
	if (parsed.action === "skip") {
		return {
			label: step ? `Skipped at ${step}` : "Tour skipped",
			meta: sourceMeta,
		};
	}
	if (parsed.action === "auth_required") {
		return { label: "Auth required", meta: source || "Tour handoff" };
	}

	return { label: formatContextLabel(value), meta: "Tour activity" };
};
