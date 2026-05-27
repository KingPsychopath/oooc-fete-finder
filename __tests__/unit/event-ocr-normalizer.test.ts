import {
	buildEditableRowFromOcrDraft,
	normalizeRawOcrDraft,
} from "@/features/data-management/event-ocr/normalizer";
import { describe, expect, it } from "vitest";

describe("event OCR draft normalization", () => {
	it("normalizes model fields into a draft sheet row without source confirmation", () => {
		const draft = normalizeRawOcrDraft({
			fields: {
				title: {
					value: "Amapiano Night",
					evidence: "AMAPIANO NIGHT",
					confidence: 0.92,
				},
				date: {
					value: "2026-06-21",
					evidence: "21 June 2026",
					confidence: 0.88,
				},
				startTime: {
					value: "9pm",
					evidence: "9PM",
					confidence: 0.81,
				},
				setting: {
					value: "open air",
					evidence: "OPEN AIR",
					confidence: 0.7,
				},
			},
			rawText: "AMAPIANO NIGHT 21 June 2026 9PM OPEN AIR",
		});

		const result = buildEditableRowFromOcrDraft(draft);

		expect(result.row.title).toBe("Amapiano Night");
		expect(result.row.date).toBe("21-06-2026");
		expect(result.row.startTime).toBe("21:00");
		expect(result.row.sourceConfirmed).toBe("");
		expect(result.row.detailsQualityOverride).toBe("draft");
		expect(result.missingRequiredFields).toEqual([]);
		expect(result.averageConfidence).toBeGreaterThan(0.8);
		expect(draft.usage).toBeNull();
	});

	it("keeps missing required fields explicit", () => {
		const draft = normalizeRawOcrDraft({
			fields: {
				title: { value: "Untitled Party", confidence: 0.4 },
			},
		});

		const result = buildEditableRowFromOcrDraft(draft);

		expect(result.row.title).toBe("Untitled Party");
		expect(result.row.date).toBe("");
		expect(result.missingRequiredFields).toEqual(["date"]);
	});

	it("keeps OCR source images and ranked alternatives deterministic", () => {
		const draft = normalizeRawOcrDraft({
			fields: {
				location: {
					value: "Parc de Belleville",
					evidence: "PARC DE BELLEVILLE",
					confidence: 0.91,
					sourceImageIds: ["flyer"],
					sourceFileNames: ["flyer.jpg"],
					alternatives: [
						{
							value: "Belleville Park",
							evidence: "BELLEVILLE",
							confidence: 0.63,
							sourceImageIds: ["caption"],
							sourceFileNames: ["caption.jpg"],
						},
						{
							value: "",
							confidence: 0.2,
						},
					],
				},
			},
		});

		expect(draft.fields.location.sourceImageIds).toEqual(["flyer"]);
		expect(draft.fields.location.sourceFileNames).toEqual(["flyer.jpg"]);
		expect(draft.fields.location.alternatives).toHaveLength(1);
		expect(draft.fields.location.alternatives[0]).toMatchObject({
			value: "Belleville Park",
			sourceImageIds: ["caption"],
			sourceFileNames: ["caption.jpg"],
		});
	});
});
