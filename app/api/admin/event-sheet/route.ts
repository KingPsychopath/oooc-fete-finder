import { validateAdminKeyForApiRoute } from "@/features/auth/admin-validation";
import {
	getEventSheetEditorData,
	getEventSheetRevisionSnapshot,
	saveEventSheetEditorRows,
} from "@/features/data-management/actions";
import {
	isEditableSheetColumn,
	isEditableSheetRow,
	isPlainRecord,
} from "@/features/data-management/csv/sheet-editor";
import { getAdminCredentialFromRequest } from "@/lib/http/admin-request";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import {
	EVENT_SHEET_JSON_BODY_LIMIT_BYTES,
	forbiddenNoStoreResponse,
	isSameOriginRequest,
	isWithinBodySizeLimit,
	tooLargeNoStoreResponse,
} from "@/lib/http/request-security";
import { NextRequest, NextResponse } from "next/server";

const parseBooleanOption = (value: unknown): boolean | undefined =>
	typeof value === "boolean" ? value : undefined;

export async function GET(request: NextRequest) {
	const credential = getAdminCredentialFromRequest(request);
	if (!(await validateAdminKeyForApiRoute(request, credential))) {
		return NextResponse.json(
			{ success: false, error: "Unauthorized" },
			{ status: 401, headers: NO_STORE_HEADERS },
		);
	}

	const hasRevisionId = request.nextUrl.searchParams.has("revisionId");
	const revisionId = request.nextUrl.searchParams.get("revisionId") ?? "";
	const result = hasRevisionId
		? await getEventSheetRevisionSnapshot(credential ?? undefined, revisionId)
		: await getEventSheetEditorData(credential ?? undefined);
	return NextResponse.json(result, {
		status: result.success ? 200 : hasRevisionId ? 404 : 500,
		headers: NO_STORE_HEADERS,
	});
}

export async function POST(request: NextRequest) {
	if (!isSameOriginRequest(request)) {
		return forbiddenNoStoreResponse();
	}
	if (!isWithinBodySizeLimit(request, EVENT_SHEET_JSON_BODY_LIMIT_BYTES)) {
		return tooLargeNoStoreResponse();
	}

	const credential = getAdminCredentialFromRequest(request);
	if (!(await validateAdminKeyForApiRoute(request, credential))) {
		return NextResponse.json(
			{ success: false, error: "Unauthorized" },
			{ status: 401, headers: NO_STORE_HEADERS },
		);
	}

	let payload: unknown;
	try {
		payload = await request.json();
	} catch {
		return NextResponse.json(
			{ success: false, message: "Invalid JSON payload" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	if (!isPlainRecord(payload)) {
		return NextResponse.json(
			{ success: false, message: "Invalid sheet payload" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const columns = payload.columns;
	const rows = payload.rows;
	if (
		!Array.isArray(columns) ||
		!columns.every(isEditableSheetColumn) ||
		!Array.isArray(rows) ||
		!rows.every(isEditableSheetRow)
	) {
		return NextResponse.json(
			{ success: false, message: "Invalid sheet payload" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const options = isPlainRecord(payload.options)
		? {
				revalidateHomepage: parseBooleanOption(
					payload.options.revalidateHomepage,
				),
				restoreRevisionId:
					typeof payload.options.restoreRevisionId === "string"
						? payload.options.restoreRevisionId
						: undefined,
			}
		: undefined;

	const result = await saveEventSheetEditorRows(
		credential ?? undefined,
		columns,
		rows,
		options,
	);
	return NextResponse.json(result, {
		status: result.success ? 200 : 400,
		headers: NO_STORE_HEADERS,
	});
}
