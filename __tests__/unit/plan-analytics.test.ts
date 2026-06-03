import { beforeEach, describe, expect, it, vi } from "vitest";

const clientTracking = vi.hoisted(() => ({
	flushDiscoveryAnalytics: vi.fn(),
	trackDiscoveryAnalytics: vi.fn(),
}));

vi.mock("@/features/events/engagement/client-tracking", () => clientTracking);

describe("trackPlanAnalytics", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("records plan actions with normalized detail", async () => {
		const { trackPlanAnalytics } = await import("@/features/plans/analytics");

		trackPlanAnalytics({
			action: "share_copy",
			surface: "share",
			planId: "Plan ABC 123",
			planDate: "2026-06-20",
			stopCount: 3,
			value: "copied link",
		});

		expect(clientTracking.trackDiscoveryAnalytics).toHaveBeenCalledWith({
			actionType: "plan_action",
			filterGroup: "plan:share",
			filterValue: "share_copy",
			searchQuery:
				"date=2026-06-20;plan=plan_abc_123;stops=3;value=copied_link",
		});
		expect(clientTracking.flushDiscoveryAnalytics).not.toHaveBeenCalled();
	});

	it("flushes high-intent actions immediately when requested", async () => {
		const { trackPlanAnalytics } = await import("@/features/plans/analytics");

		trackPlanAnalytics({
			action: "route_map_open",
			surface: "export",
			planId: "route-1",
			planDate: "2026-06-20",
			stopCount: 4,
			value: "google:full-route",
			flushImmediately: true,
		});

		expect(clientTracking.trackDiscoveryAnalytics).toHaveBeenCalledWith({
			actionType: "plan_action",
			filterGroup: "plan:export",
			filterValue: "route_map_open",
			searchQuery:
				"date=2026-06-20;plan=route-1;stops=4;value=google:full-route",
		});
		expect(clientTracking.flushDiscoveryAnalytics).toHaveBeenCalledWith(true);
	});
});
