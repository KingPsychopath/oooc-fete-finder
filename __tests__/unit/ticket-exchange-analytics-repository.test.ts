import { TicketExchangeAnalyticsRepository } from "@/lib/platform/postgres/ticket-exchange-analytics-repository";
import type { Sql } from "postgres";
import { describe, expect, it, vi } from "vitest";

describe("TicketExchangeAnalyticsRepository", () => {
	it("creates exchange analytics columns and action contract", async () => {
		const calls: Array<{ query: string; values: unknown[] }> = [];
		const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
			const query = strings.join("?");
			calls.push({ query, values });
			if (query.includes("exchangeViewCount")) {
				return [
					{
						exchangeViewCount: 2,
						uniqueExchangeViewSessionCount: 1,
						eventSelectCount: 1,
						eventDetailsOpenCount: 1,
						tabChangeCount: 1,
						sortChangeCount: 1,
						profileOpenCount: 1,
						profileSaveCount: 1,
						agreementOpenCount: 1,
						agreementAcceptCount: 1,
						listingFormOpenCount: 1,
						listingCreateCount: 1,
						contactUnlockCount: 1,
						contactLinkClickCount: 1,
						listingStatusUpdateCount: 1,
						listingRepostCount: 1,
						reportOpenCount: 1,
						reportSubmitCount: 1,
						flowBlockedCount: 1,
						validationErrorCount: 1,
						actionFailedCount: 1,
						emptyStateCtaCount: 1,
						uniqueActionSessionCount: 1,
						uniqueListingCreateSessionCount: 1,
						uniqueContactUnlockSessionCount: 1,
						uniqueReportSubmitSessionCount: 1,
						uniqueFrictionSessionCount: 1,
					},
				];
			}
			return [];
		});

		const repository = new TicketExchangeAnalyticsRepository(
			sql as unknown as Sql,
		);
		const summary = await repository.summarizeWindow({
			startAt: "2026-06-01T00:00:00.000Z",
			endAt: "2026-06-02T00:00:00.000Z",
		});

		expect(summary.exchangeViewCount).toBe(2);
		const queries = calls.map((call) => call.query).join("\n");
		expect(queries).toContain("ticket_exchange_analytics_stats");
		expect(queries).toContain("listing_create");
		expect(queries).toContain("contact_unlock");
		expect(queries).toContain("flow_blocked");
		expect(queries).toContain("validation_error");
		expect(queries).toContain("action_failed");
		expect(queries).toContain("report_submit");
		expect(queries).toContain("idx_ticket_exchange_analytics_event_time");
	});

	it("sanitizes user ids and lowercases event keys when recording", async () => {
		const calls: Array<{ query: string; values: unknown[] }> = [];
		const sql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
			const query = strings.join("?");
			calls.push({ query, values });
			return [];
		});

		const repository = new TicketExchangeAnalyticsRepository(
			sql as unknown as Sql,
		);
		await repository.recordAction({
			actionType: "listing_create",
			sessionId: "session-1",
			userId: "not-a-valid-user-id",
			userEmail: "alex@example.com",
			eventKey: "EVT_ABC",
			listingType: "selling",
			surface: "listing_form",
			path: "/exchange/EVT_ABC",
			recordedAt: "2026-06-01T12:00:00.000Z",
		});

		const insertCall = calls.find((call) =>
			call.query.includes("INSERT INTO ticket_exchange_analytics_stats"),
		);
		expect(insertCall?.values).toContain(null);
		expect(insertCall?.values).toContain("evt_abc");
		expect(insertCall?.values).toContain("listing_form");
	});
});
