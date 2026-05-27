import { validateAdminKeyForApiRoute } from "@/features/auth/admin-validation";
import {
	createMusicGenreFromEditor,
	mapMusicGenreAliasFromEditor,
	removeMusicGenreAliasFromEditor,
	removeMusicGenreFromEditor,
} from "@/features/data-management/actions";
import { isPlainRecord } from "@/features/data-management/csv/sheet-editor";
import { getAdminCredentialFromRequest } from "@/lib/http/admin-request";
import { NO_STORE_HEADERS } from "@/lib/http/cache-control";
import {
	DEFAULT_JSON_BODY_LIMIT_BYTES,
	forbiddenNoStoreResponse,
	isSameOriginRequest,
	isWithinBodySizeLimit,
	tooLargeNoStoreResponse,
} from "@/lib/http/request-security";
import { NextRequest, NextResponse } from "next/server";

const readString = (
	payload: Record<string, unknown>,
	key: string,
): string | null => {
	const value = payload[key];
	return typeof value === "string" && value.trim() ? value : null;
};

export async function POST(request: NextRequest) {
	if (!isSameOriginRequest(request)) {
		return forbiddenNoStoreResponse();
	}
	if (!isWithinBodySizeLimit(request, DEFAULT_JSON_BODY_LIMIT_BYTES)) {
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
			{ success: false, error: "Invalid JSON payload" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	if (!isPlainRecord(payload)) {
		return NextResponse.json(
			{ success: false, error: "Invalid genre payload" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	const action = readString(payload, "action");
	let result:
		| Awaited<ReturnType<typeof createMusicGenreFromEditor>>
		| Awaited<ReturnType<typeof removeMusicGenreFromEditor>>
		| Awaited<ReturnType<typeof mapMusicGenreAliasFromEditor>>
		| Awaited<ReturnType<typeof removeMusicGenreAliasFromEditor>>;

	if (action === "create-genre") {
		const label = readString(payload, "label");
		if (!label) {
			return NextResponse.json(
				{ success: false, error: "Genre label is required" },
				{ status: 400, headers: NO_STORE_HEADERS },
			);
		}
		result = await createMusicGenreFromEditor(label, credential ?? undefined);
	} else if (action === "remove-genre") {
		const genreKey = readString(payload, "genreKey");
		if (!genreKey) {
			return NextResponse.json(
				{ success: false, error: "Choose a valid genre to remove" },
				{ status: 400, headers: NO_STORE_HEADERS },
			);
		}
		result = await removeMusicGenreFromEditor(
			genreKey,
			credential ?? undefined,
		);
	} else if (action === "map-alias") {
		const alias = readString(payload, "alias");
		const genreKey = readString(payload, "genreKey");
		if (!alias || !genreKey) {
			return NextResponse.json(
				{ success: false, error: "Choose an unknown genre and a target genre" },
				{ status: 400, headers: NO_STORE_HEADERS },
			);
		}
		result = await mapMusicGenreAliasFromEditor(
			alias,
			genreKey,
			credential ?? undefined,
		);
	} else if (action === "remove-alias") {
		const alias = readString(payload, "alias");
		if (!alias) {
			return NextResponse.json(
				{ success: false, error: "Choose a valid alias to remove" },
				{ status: 400, headers: NO_STORE_HEADERS },
			);
		}
		result = await removeMusicGenreAliasFromEditor(
			alias,
			credential ?? undefined,
		);
	} else {
		return NextResponse.json(
			{ success: false, error: "Unknown genre action" },
			{ status: 400, headers: NO_STORE_HEADERS },
		);
	}

	return NextResponse.json(result, {
		status: result.success ? 200 : 400,
		headers: NO_STORE_HEADERS,
	});
}
