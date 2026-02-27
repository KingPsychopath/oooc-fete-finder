import { getPartnerStatsSnapshot } from "@/features/partners/partner-stats";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ activationId: string }> },
) {
	const { activationId } = await params;
	const url = new URL(request.url);
	const token = url.searchParams.get("token");
	const format = url.searchParams.get("format");

	if (!token || token.trim().length === 0) {
		return NextResponse.json(
			{ success: false, error: "Token required" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const result = await getPartnerStatsSnapshot({ activationId, token });
	if (!result.success) {
		const status =
			result.code === "invalid_token"
				? 403
				: result.code === "not_found"
					? 404
					: 409;
		return NextResponse.json(
			{ success: false, error: result.error },
			{ status, headers: NO_STORE_HEADERS },
		);
	}

	if (format === "csv") {
		const data = result.data;
		const header = [
			"activation_id",
			"event_key",
			"event_name",
			"tier",
			"start_at",
			"end_at",
			"views",
			"outbound_clicks",
			"calendar_syncs",
			"unique_sessions",
			"unique_view_sessions",
			"unique_outbound_sessions",
			"unique_calendar_sessions",
			"outbound_session_rate",
			"calendar_session_rate",
			"outbound_interaction_rate",
			"calendar_interaction_rate",
		];
		const row = [
			data.activationId,
			data.eventKey,
			data.eventName,
			data.tier,
			data.range.startAt,
			data.range.endAt,
			String(data.metrics.clickCount),
			String(data.metrics.outboundClickCount),
			String(data.metrics.calendarSyncCount),
			String(data.metrics.uniqueSessionCount),
			String(data.metrics.uniqueViewSessionCount),
			String(data.metrics.uniqueOutboundSessionCount),
			String(data.metrics.uniqueCalendarSessionCount),
			String(data.metrics.outboundSessionRate),
			String(data.metrics.calendarSessionRate),
			String(data.metrics.outboundInteractionRate),
			String(data.metrics.calendarInteractionRate),
		];
		const csv = `${header.join(",")}\n${row
			.map((value) =>
				value.includes(",") || value.includes('"')
					? `"${value.replace(/"/g, '""')}"`
					: value,
			)
			.join(",")}\n`;
		return new NextResponse(csv, {
			status: 200,
			headers: {
				...NO_STORE_HEADERS,
				"Content-Type": "text/csv; charset=utf-8",
				"Content-Disposition": `attachment; filename="oooc-partner-stats-${data.eventKey}.csv"`,
			},
		});
	}

	return NextResponse.json(
		{ success: true, data: result.data },
		{ status: 200, headers: NO_STORE_HEADERS },
	);
}
