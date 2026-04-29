import { validateAdminKeyForApiRoute } from "@/features/auth/admin-validation";
import {
	getEventSheetEditorData,
	getEventSheetRevisionSnapshot,
	saveEventSheetEditorRows,
} from "@/features/data-management/actions";
import type {
	EditableSheetColumn,
	EditableSheetRow,
} from "@/features/data-management/csv/sheet-editor";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import { NextRequest, NextResponse } from "next/server";

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isEditableSheetColumn = (
	value: unknown,
): value is EditableSheetColumn => {
	if (!isPlainRecord(value)) return false;
	return (
		typeof value.key === "string" &&
		typeof value.label === "string" &&
		typeof value.isCore === "boolean" &&
		typeof value.isRequired === "boolean"
	);
};

const isEditableSheetRow = (value: unknown): value is EditableSheetRow => {
	if (!isPlainRecord(value)) return false;
	return Object.values(value).every((item) => typeof item === "string");
};

const parseBooleanOption = (value: unknown): boolean | undefined =>
	typeof value === "boolean" ? value : undefined;

const getAdminCredential = (request: NextRequest): string | null => {
	const direct = request.headers.get("x-admin-key");
	if (direct) return direct;

	const auth = request.headers.get("authorization");
	if (!auth) return null;
	const [scheme, token] = auth.split(" ");
	if (scheme?.toLowerCase() !== "bearer" || !token) return null;
	return token;
};

export async function GET(request: NextRequest) {
	const credential = getAdminCredential(request);
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
	const credential = getAdminCredential(request);
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
