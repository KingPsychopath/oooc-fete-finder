import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	GET: typeof import("@/app/api/admin/event-sheet/route").GET;
	POST: typeof import("@/app/api/admin/event-sheet/route").POST;
	validateAdminKeyForApiRoute: ReturnType<typeof vi.fn>;
	getEventSheetEditorData: ReturnType<typeof vi.fn>;
	getEventSheetRevisionSnapshot: ReturnType<typeof vi.fn>;
	saveEventSheetEditorRows: ReturnType<typeof vi.fn>;
};

const loadRoute = async (): Promise<Setup> => {
	vi.resetModules();

	const validateAdminKeyForApiRoute = vi.fn().mockResolvedValue(true);
	const getEventSheetEditorData = vi.fn().mockResolvedValue({
		success: true,
		columns: [
			{ key: "title", label: "Title", isCore: true, isRequired: true },
			{ key: "date", label: "Date", isCore: true, isRequired: true },
		],
		rows: [{ title: "A", date: "2026-01-01" }],
		status: { updatedAt: "2026-01-01T00:00:00.000Z" },
		sheetSource: "store",
	});
	const getEventSheetRevisionSnapshot = vi.fn().mockResolvedValue({
		success: true,
		revision: {
			id: "rev_1",
			groupId: "group_1",
			trigger: "publish",
			createdAt: "2026-01-01T00:00:00.000Z",
			updatedAt: "2026-01-01T00:00:00.000Z",
			actorLabel: "Admin key",
			actorSessionJti: null,
			rowCount: 1,
			columnCount: 2,
			addedRows: 0,
			deletedRows: 0,
			changedRows: 1,
			changedColumns: ["Title"],
			sampleAdded: [],
			sampleDeleted: [],
			autosaveCount: 1,
			summary: "Published event sheet: 1 changed",
			href: "/admin/content#event-sheet-editor",
			canRestore: true,
		},
		columns: [
			{ key: "title", label: "Title", isCore: true, isRequired: true },
			{ key: "date", label: "Date", isCore: true, isRequired: true },
		],
		rows: [{ title: "A", date: "2026-01-01" }],
	});
	const saveEventSheetEditorRows = vi.fn().mockResolvedValue({
		success: true,
		message: "Saved event sheet to store",
		rowCount: 1,
		updatedAt: "2026-01-01T00:00:00.000Z",
	});

	vi.doMock("@/features/auth/admin-validation", () => ({
		validateAdminKeyForApiRoute,
	}));
	vi.doMock("@/features/data-management/actions", () => ({
		getEventSheetEditorData,
		getEventSheetRevisionSnapshot,
		saveEventSheetEditorRows,
	}));

	const route = await import("@/app/api/admin/event-sheet/route");
	return {
		GET: route.GET,
		POST: route.POST,
		validateAdminKeyForApiRoute,
		getEventSheetEditorData,
		getEventSheetRevisionSnapshot,
		saveEventSheetEditorRows,
	};
};

describe("/api/admin/event-sheet route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("requires admin auth before loading or saving", async () => {
		const {
			GET,
			POST,
			validateAdminKeyForApiRoute,
			getEventSheetEditorData,
			saveEventSheetEditorRows,
		} = await loadRoute();
		validateAdminKeyForApiRoute.mockResolvedValue(false);

		const getResponse = await GET(
			new NextRequest("https://example.com/api/admin/event-sheet"),
		);
		const postResponse = await POST(
			new NextRequest("https://example.com/api/admin/event-sheet", {
				method: "POST",
				body: "{}",
			}),
		);

		expect(getResponse.status).toBe(401);
		expect(postResponse.status).toBe(401);
		expect(getEventSheetEditorData).not.toHaveBeenCalled();
		expect(saveEventSheetEditorRows).not.toHaveBeenCalled();
	});

	it("loads sheet data with no-store headers", async () => {
		const { GET, getEventSheetEditorData } = await loadRoute();

		const response = await GET(
			new NextRequest("https://example.com/api/admin/event-sheet"),
		);
		const payload = (await response.json()) as {
			success: boolean;
			rows: Array<{ title: string }>;
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.rows[0].title).toBe("A");
		expect(getEventSheetEditorData).toHaveBeenCalledTimes(1);
		expect(response.headers.get("cache-control")).toContain("no-store");
	});

	it("loads a restorable revision snapshot when revisionId is provided", async () => {
		const { GET, getEventSheetEditorData, getEventSheetRevisionSnapshot } =
			await loadRoute();

		const response = await GET(
			new NextRequest(
				"https://example.com/api/admin/event-sheet?revisionId=rev_1",
			),
		);
		const payload = (await response.json()) as {
			success: boolean;
			revision: { id: string };
			rows: Array<{ title: string }>;
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.revision.id).toBe("rev_1");
		expect(payload.rows[0].title).toBe("A");
		expect(getEventSheetEditorData).not.toHaveBeenCalled();
		expect(getEventSheetRevisionSnapshot).toHaveBeenCalledWith(
			undefined,
			"rev_1",
		);
		expect(response.headers.get("cache-control")).toContain("no-store");
	});

	it("returns a client failure for invalid revision snapshot requests", async () => {
		const { GET, getEventSheetRevisionSnapshot } = await loadRoute();
		getEventSheetRevisionSnapshot.mockResolvedValue({
			success: false,
			error: "Choose a revision to preview",
		});

		const response = await GET(
			new NextRequest("https://example.com/api/admin/event-sheet?revisionId="),
		);
		const payload = (await response.json()) as {
			success: boolean;
			error: string;
		};

		expect(response.status).toBe(404);
		expect(payload.success).toBe(false);
		expect(payload.error).toBe("Choose a revision to preview");
		expect(getEventSheetRevisionSnapshot).toHaveBeenCalledWith(undefined, "");
	});

	it("rejects malformed save payloads before calling the save action", async () => {
		const { POST, saveEventSheetEditorRows } = await loadRoute();

		const response = await POST(
			new NextRequest("https://example.com/api/admin/event-sheet", {
				method: "POST",
				body: JSON.stringify({
					columns: [{ key: "title", label: "Title" }],
					rows: [{ title: "A" }],
				}),
			}),
		);
		const payload = (await response.json()) as {
			success: boolean;
			message: string;
		};

		expect(response.status).toBe(400);
		expect(payload.success).toBe(false);
		expect(payload.message).toBe("Invalid sheet payload");
		expect(saveEventSheetEditorRows).not.toHaveBeenCalled();
	});

	it("saves valid sheet payloads through the stable route contract", async () => {
		const { POST, saveEventSheetEditorRows } = await loadRoute();
		const columns = [
			{ key: "title", label: "Title", isCore: true, isRequired: true },
			{ key: "date", label: "Date", isCore: true, isRequired: true },
		];
		const rows = [{ title: "A", date: "2026-01-01" }];

		const response = await POST(
			new NextRequest("https://example.com/api/admin/event-sheet", {
				method: "POST",
				body: JSON.stringify({
					columns,
					rows,
					options: {
						revalidateHomepage: false,
						restoreRevisionId: "rev_1",
					},
				}),
			}),
		);
		const payload = (await response.json()) as {
			success: boolean;
			rowCount: number;
		};

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(payload.rowCount).toBe(1);
		expect(saveEventSheetEditorRows).toHaveBeenCalledWith(
			undefined,
			columns,
			rows,
			{
				revalidateHomepage: false,
				restoreRevisionId: "rev_1",
			},
		);
		expect(response.headers.get("cache-control")).toContain("no-store");
	});
});
