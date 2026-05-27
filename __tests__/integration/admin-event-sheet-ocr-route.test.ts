import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

type Setup = {
	POST: typeof import("@/app/api/admin/event-sheet/ocr-draft/route").POST;
	recordAdminActivity: ReturnType<typeof vi.fn>;
	validateAdminKeyForApiRoute: ReturnType<typeof vi.fn>;
	extractCombinedEventOcrDraft: ReturnType<typeof vi.fn>;
};

const loadRoute = async (): Promise<Setup> => {
	vi.resetModules();

	const recordAdminActivity = vi.fn().mockResolvedValue(undefined);
	const validateAdminKeyForApiRoute = vi.fn().mockResolvedValue(true);
	const extractCombinedEventOcrDraft = vi.fn().mockResolvedValue({
		success: true,
		draft: {
			id: "combined_img_1",
			fileName: "Combined event",
			sourceImages: [{ id: "img_1", fileName: "flyer.jpg" }],
			provider: "gemini",
			model: "gemini-2.5-flash-lite",
			fields: {},
			rawText: "",
			warnings: [],
			usage: {
				promptTokenCount: 1200,
				candidatesTokenCount: 180,
				totalTokenCount: 1380,
				imageCount: 1,
				imageBytes: 256,
			},
			row: { title: "Party", date: "21-06-2026" },
			missingRequiredFields: [],
			averageConfidence: 0.9,
		},
	});
	const extractEventOcrDrafts = vi.fn().mockResolvedValue([]);
	const getEventOcrStatus = vi.fn().mockReturnValue({
		provider: "gemini",
		model: "gemini-2.5-flash-lite",
		configured: true,
	});

	vi.doMock("@/features/admin/activity/record", () => ({
		recordAdminActivity,
	}));
	vi.doMock("@/features/auth/admin-validation", () => ({
		validateAdminKeyForApiRoute,
	}));
	vi.doMock("@/features/data-management/event-ocr/service", () => ({
		extractCombinedEventOcrDraft,
		extractEventOcrDrafts,
		getEventOcrStatus,
	}));

	const route = await import("@/app/api/admin/event-sheet/ocr-draft/route");
	return {
		POST: route.POST,
		recordAdminActivity,
		validateAdminKeyForApiRoute,
		extractCombinedEventOcrDraft,
	};
};

describe("/api/admin/event-sheet/ocr-draft route", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("records OCR usage without storing image payloads", async () => {
		const { POST, recordAdminActivity, extractCombinedEventOcrDraft } =
			await loadRoute();

		const response = await POST(
			new NextRequest("https://example.com/api/admin/event-sheet/ocr-draft", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					host: "example.com",
					origin: "https://example.com",
				},
				body: JSON.stringify({
					combineImages: true,
					images: [
						{
							id: "img_1",
							fileName: "flyer.jpg",
							mimeType: "image/jpeg",
							base64: "abcd",
						},
					],
				}),
			}),
		);
		const payload = (await response.json()) as { success: boolean };

		expect(response.status).toBe(200);
		expect(payload.success).toBe(true);
		expect(extractCombinedEventOcrDraft).toHaveBeenCalledWith([
			{
				id: "img_1",
				fileName: "flyer.jpg",
				mimeType: "image/jpeg",
				base64: "abcd",
			},
		]);
		expect(recordAdminActivity).toHaveBeenCalledWith(
			expect.objectContaining({
				action: "event_sheet_ocr_extracted",
				category: "content",
				targetType: "event_sheet_ocr",
				metadata: expect.objectContaining({
					mode: "combined",
					imageCount: 1,
					successCount: 1,
					totalTokenCount: 1380,
					imageBytes: 256,
					sourceFileNames: ["flyer.jpg"],
				}),
			}),
		);
		expect(JSON.stringify(recordAdminActivity.mock.calls[0])).not.toContain(
			"abcd",
		);
	});
});
