import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventSubmissionRecord } from "@/features/events/submissions/types";

const buildSubmission = (status: EventSubmissionRecord["status"]): EventSubmissionRecord => ({
	id: "submission_1",
	status,
	payload: {
		eventName: "Sunset Party",
		date: "2026-06-21",
		startTime: "18:00",
		location: "Paris",
		hostEmail: "host@example.com",
		proofLink: "https://example.com/event",
		submittedAt: "2026-02-18T10:00:00.000Z",
		endTime: "23:00",
		genre: "Afrobeats",
		price: "Free",
		age: "21+",
		indoorOutdoor: "Indoor",
		notes: "Bring friends",
		arrondissement: "11",
	},
	hostEmail: "host@example.com",
	sourceIpHash: "hashed-ip",
	emailIpHash: "hashed-email-ip",
	fingerprintHash: "hashed-fingerprint",
	spamSignals: {
		honeypotFilled: false,
		completedTooFast: false,
		completionSeconds: 12,
		reasons: [],
	},
	reviewReason: status === "declined" ? "not_enough_information" : null,
	acceptedEventKey: null,
	reviewedAt: status === "pending" ? null : "2026-02-18T11:00:00.000Z",
	reviewedBy: status === "pending" ? null : "admin-panel",
	createdAt: "2026-02-18T10:00:00.000Z",
	updatedAt: "2026-02-18T10:00:00.000Z",
});

type Setup = {
	getEventSubmissionsDashboard: typeof import("@/features/events/submissions/actions").getEventSubmissionsDashboard;
	acceptEventSubmission: typeof import("@/features/events/submissions/actions").acceptEventSubmission;
	declineEventSubmission: typeof import("@/features/events/submissions/actions").declineEventSubmission;
	validateAdminAccess: ReturnType<typeof vi.fn>;
	getEventSubmissionSnapshot: ReturnType<typeof vi.fn>;
	getEventSubmissionById: ReturnType<typeof vi.fn>;
	reviewEventSubmission: ReturnType<typeof vi.fn>;
	getEventSheetEditorData: ReturnType<typeof vi.fn>;
	saveEventSheetEditorRows: ReturnType<typeof vi.fn>;
};

const loadActions = async (): Promise<Setup> => {
	vi.resetModules();

	const validateAdminAccess = vi.fn().mockResolvedValue(true);
	const getEventSubmissionSnapshot = vi.fn().mockResolvedValue({
		metrics: {
			totalCount: 3,
			pendingCount: 1,
			acceptedLast7Days: 1,
			declinedLast7Days: 1,
		},
		pending: [buildSubmission("pending")],
		accepted: [buildSubmission("accepted")],
		declined: [buildSubmission("declined")],
	});
	const getEventSubmissionById = vi.fn().mockResolvedValue(buildSubmission("pending"));
	const reviewEventSubmission = vi.fn().mockResolvedValue(buildSubmission("accepted"));
	const getEventSheetEditorData = vi.fn().mockResolvedValue({
		success: true,
		columns: [
			{ key: "eventKey", label: "Event Key", isCore: true, isRequired: false },
			{ key: "oocPicks", label: "OOOC Picks", isCore: true, isRequired: false },
			{ key: "nationality", label: "GB/FR", isCore: true, isRequired: false },
			{ key: "name", label: "Name", isCore: true, isRequired: true },
			{ key: "date", label: "Date", isCore: true, isRequired: true },
			{ key: "startTime", label: "Start Time", isCore: true, isRequired: false },
			{ key: "endTime", label: "End Time", isCore: true, isRequired: false },
			{ key: "location", label: "Location", isCore: true, isRequired: false },
			{ key: "arrondissement", label: "Arr.", isCore: true, isRequired: false },
			{ key: "genre", label: "Genre", isCore: true, isRequired: false },
			{ key: "price", label: "Price", isCore: true, isRequired: false },
			{ key: "ticketLink", label: "Ticket Link", isCore: true, isRequired: false },
			{ key: "age", label: "Age", isCore: true, isRequired: false },
			{ key: "indoorOutdoor", label: "Indoor/Outdoor", isCore: true, isRequired: false },
			{ key: "notes", label: "Notes", isCore: true, isRequired: false },
		],
		rows: [{ name: "Existing event", date: "2026-06-20" }],
	});
	const saveEventSheetEditorRows = vi.fn().mockResolvedValue({
		success: true,
		message: "Saved",
		rowCount: 2,
		updatedAt: "2026-02-18T11:00:00.000Z",
	});

	vi.doMock("@/features/auth/admin-validation", () => ({
		validateAdminAccessFromServerContext: validateAdminAccess,
	}));

	vi.doMock("@/features/events/submissions/store", () => ({
		getEventSubmissionSnapshot,
		getEventSubmissionById,
		reviewEventSubmission,
	}));

	vi.doMock("@/features/data-management/actions", () => ({
		getEventSheetEditorData,
		saveEventSheetEditorRows,
	}));

	const actions = await import("@/features/events/submissions/actions");
	return {
		getEventSubmissionsDashboard: actions.getEventSubmissionsDashboard,
		acceptEventSubmission: actions.acceptEventSubmission,
		declineEventSubmission: actions.declineEventSubmission,
		validateAdminAccess,
		getEventSubmissionSnapshot,
		getEventSubmissionById,
		reviewEventSubmission,
		getEventSheetEditorData,
		saveEventSheetEditorRows,
	};
};

describe("event submission admin actions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("lists submissions for authorized admins", async () => {
		const { getEventSubmissionsDashboard, getEventSubmissionSnapshot } = await loadActions();
		const result = await getEventSubmissionsDashboard();

		expect(result.success).toBe(true);
		expect(getEventSubmissionSnapshot).toHaveBeenCalledTimes(1);
	});

	it("declines a pending submission with reason", async () => {
		const { declineEventSubmission, reviewEventSubmission } = await loadActions();
		reviewEventSubmission.mockResolvedValue(buildSubmission("declined"));

		const result = await declineEventSubmission(
			"submission_1",
			"not_enough_information",
		);

		expect(result.success).toBe(true);
		expect(reviewEventSubmission).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "submission_1",
				status: "declined",
				reviewReason: "not_enough_information",
			}),
		);
	});

	it("accepts pending submissions, appends row, and saves with revalidation", async () => {
		const {
			acceptEventSubmission,
			saveEventSheetEditorRows,
			reviewEventSubmission,
		} = await loadActions();

		const result = await acceptEventSubmission("submission_1");

		expect(result.success).toBe(true);
		expect(saveEventSheetEditorRows).toHaveBeenCalledWith(
			undefined,
			expect.any(Array),
			expect.arrayContaining([
				expect.objectContaining({
					name: "Sunset Party",
					date: "2026-06-21",
					startTime: "18:00",
					location: "Paris",
					ticketLink: "https://example.com/event",
				}),
			]),
			expect.objectContaining({ revalidateHomepage: true }),
		);
		expect(reviewEventSubmission).toHaveBeenCalledWith(
			expect.objectContaining({
				id: "submission_1",
				status: "accepted",
			}),
		);
	});

	it("returns unauthorized when admin validation fails", async () => {
		const { getEventSubmissionsDashboard, acceptEventSubmission, validateAdminAccess } =
			await loadActions();
		validateAdminAccess.mockResolvedValue(false);

		const listResult = await getEventSubmissionsDashboard();
		const acceptResult = await acceptEventSubmission("submission_1");

		expect(listResult.success).toBe(false);
		expect(acceptResult.success).toBe(false);
	});
});
