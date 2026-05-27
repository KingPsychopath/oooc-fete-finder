"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import type { EditableSheetRow } from "@/features/data-management/csv/sheet-editor";
import {
	EVENT_OCR_FIELD_KEYS,
	type EventOcrFieldCandidate,
	type EventOcrFieldKey,
	type EventOcrFieldSuggestion,
	type EventOcrSourceImage,
	type EventOcrUsage,
} from "@/features/data-management/event-ocr/types";
import {
	AlertCircle,
	CheckCircle2,
	ImageIcon,
	Loader2,
	Sparkles,
	Trash2,
	Upload,
	UploadCloud,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type OcrStatusPayload = {
	success: boolean;
	configured?: boolean;
	provider?: string;
	model?: string;
	error?: string;
	maxImages?: number;
	maxImageBytes?: number;
};

type OcrDraftPayload = {
	id: string;
	fileName: string;
	sourceImages: EventOcrSourceImage[];
	provider: string;
	model: string;
	fields: Record<EventOcrFieldKey, EventOcrFieldSuggestion>;
	rawText: string;
	warnings: string[];
	usage: EventOcrUsage | null;
	row: EditableSheetRow;
	missingRequiredFields: string[];
	averageConfidence: number;
};

type OcrResultPayload =
	| {
			success: true;
			draft: OcrDraftPayload;
	  }
	| {
			success: false;
			id: string;
			fileName: string;
			error: string;
			provider?: string;
			model?: string;
	  };

type OcrExtractPayload = OcrStatusPayload & {
	results?: OcrResultPayload[];
};

type LocalOcrItem = {
	id: string;
	fileName: string;
	mimeType: string;
	base64: string;
	previewUrl: string;
	status: "queued" | "extracting" | "ready" | "error";
	error?: string;
	selected: boolean;
	rowQuality: "draft" | "review";
	edited: boolean;
	draft?: OcrDraftPayload;
};

type CombinedDraftState = {
	status: "idle" | "extracting" | "ready" | "error";
	error?: string;
	selected: boolean;
	rowQuality: "draft" | "review";
	edited: boolean;
	draft?: OcrDraftPayload;
};

type EventSheetOcrDraftModalProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onAcceptRows: (
		rows: EditableSheetRow[],
		options: { saveAfterAdd: boolean },
	) => void;
};

const OCR_ENDPOINT = "/api/admin/event-sheet/ocr-draft";
const MAX_CANVAS_DIMENSION = 1800;
const JPEG_QUALITY = 0.86;

const FIELD_LABELS: Record<EventOcrFieldKey, string> = {
	eventCategory: "Event category",
	hostCountry: "Host country",
	audienceCountry: "Audience country",
	title: "Title",
	date: "Date",
	dateTo: "Date to",
	startTime: "Start time",
	endTime: "End time",
	location: "Location",
	area: "Area",
	categories: "Categories",
	tags: "Tags",
	price: "Price",
	primaryUrl: "Primary URL",
	ageGuidance: "Age guidance",
	setting: "Setting",
	notes: "Notes",
};

const LONG_FIELD_KEYS = new Set<EventOcrFieldKey>([
	"notes",
	"categories",
	"tags",
	"primaryUrl",
]);

const getBasePath = (): string =>
	process.env.NEXT_PUBLIC_BASE_PATH?.trim() ?? "";

const buildApiPath = (path: string): string => `${getBasePath()}${path}`;

const newId = (): string =>
	typeof crypto !== "undefined" && "randomUUID" in crypto
		? crypto.randomUUID()
		: `ocr_${Date.now()}_${Math.random().toString(16).slice(2)}`;

const formatBytes = (bytes: number): string => {
	if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
	if (bytes >= 1024) return `${Math.round(bytes / 1024)}KB`;
	return `${bytes}B`;
};

const formatConfidence = (value: number): string =>
	`${Math.round(Math.min(1, Math.max(0, value)) * 100)}%`;

const formatTokenUsage = (usage: EventOcrUsage | null | undefined): string => {
	if (!usage) return "";
	const total = usage.totalTokenCount ?? usage.promptTokenCount;
	const tokenText = total === null ? "usage tracked" : `${total} tokens`;
	return `${tokenText} · ${usage.imageCount} image${usage.imageCount === 1 ? "" : "s"} · ${formatBytes(usage.imageBytes)}`;
};

const fileToDataUrl = (file: File): Promise<string> =>
	new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () =>
			typeof reader.result === "string"
				? resolve(reader.result)
				: reject(new Error("Failed to read image"));
		reader.onerror = () => reject(new Error("Failed to read image"));
		reader.readAsDataURL(file);
	});

const loadImage = (url: string): Promise<HTMLImageElement> =>
	new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () => resolve(image);
		image.onerror = () => reject(new Error("Failed to load image"));
		image.src = url;
	});

const prepareImageForOcr = async (
	file: File,
): Promise<{ mimeType: string; base64: string; previewUrl: string }> => {
	const dataUrl = await fileToDataUrl(file);
	const image = await loadImage(dataUrl);
	const scale = Math.min(
		1,
		MAX_CANVAS_DIMENSION / Math.max(image.width, image.height),
	);
	const width = Math.max(1, Math.round(image.width * scale));
	const height = Math.max(1, Math.round(image.height * scale));
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Image processing is unavailable");
	context.drawImage(image, 0, 0, width, height);
	const output = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
	const [, base64 = ""] = output.split(",");
	return {
		mimeType: "image/jpeg",
		base64,
		previewUrl: output,
	};
};

const isRowAcceptable = (row: EditableSheetRow): boolean =>
	Boolean(String(row.title ?? "").trim() && String(row.date ?? "").trim());

const updateDraftField = (
	draft: OcrDraftPayload,
	fieldKey: EventOcrFieldKey,
	value: string,
): OcrDraftPayload => ({
	...draft,
	row: {
		...draft.row,
		[fieldKey]: value,
	},
	fields: {
		...draft.fields,
		[fieldKey]: {
			...(draft.fields[fieldKey] ?? {
				value: null,
				evidence: null,
				confidence: 0,
				sourceImageIds: [],
				sourceFileNames: [],
				alternatives: [],
			}),
			value: value.trim() ? value : null,
		},
	},
	missingRequiredFields: ["title", "date"].filter(
		(key) => !String(key === fieldKey ? value : (draft.row[key] ?? "")).trim(),
	),
});

const applyDraftCandidate = (
	draft: OcrDraftPayload,
	fieldKey: EventOcrFieldKey,
	candidate: EventOcrFieldCandidate,
): OcrDraftPayload => ({
	...draft,
	row: {
		...draft.row,
		[fieldKey]: candidate.value ?? "",
	},
	fields: {
		...draft.fields,
		[fieldKey]: {
			...(draft.fields[fieldKey] ?? {
				value: null,
				evidence: null,
				confidence: 0,
				sourceImageIds: [],
				sourceFileNames: [],
				alternatives: [],
			}),
			...candidate,
		},
	},
	missingRequiredFields: ["title", "date"].filter(
		(key) =>
			!String(
				key === fieldKey ? (candidate.value ?? "") : (draft.row[key] ?? ""),
			).trim(),
	),
});

const getFieldSourceLabel = (
	field: EventOcrFieldSuggestion | undefined,
	draft: OcrDraftPayload,
): string => {
	if (!field) return "";
	if (field.sourceFileNames.length > 0) return field.sourceFileNames.join(", ");
	const sourceNames = draft.sourceImages
		.filter((image) => field.sourceImageIds.includes(image.id))
		.map((image) => image.fileName);
	return sourceNames.join(", ");
};

const formatCandidateMeta = (
	candidate: EventOcrFieldCandidate,
	draft: OcrDraftPayload,
): string => {
	const sourceLabel =
		candidate.sourceFileNames.length > 0
			? candidate.sourceFileNames.join(", ")
			: draft.sourceImages
					.filter((image) => candidate.sourceImageIds.includes(image.id))
					.map((image) => image.fileName)
					.join(", ");
	return [formatConfidence(candidate.confidence), sourceLabel]
		.filter(Boolean)
		.join(" · ");
};

export const EventSheetOcrDraftModal = ({
	open,
	onOpenChange,
	onAcceptRows,
}: EventSheetOcrDraftModalProps) => {
	const [status, setStatus] = useState<OcrStatusPayload | null>(null);
	const [items, setItems] = useState<LocalOcrItem[]>([]);
	const [extractionMode, setExtractionMode] = useState<"combined" | "separate">(
		"combined",
	);
	const [combinedDraft, setCombinedDraft] = useState<CombinedDraftState>({
		status: "idle",
		selected: true,
		rowQuality: "draft",
		edited: false,
	});
	const [isPreparing, setIsPreparing] = useState(false);
	const [modalError, setModalError] = useState("");
	const inputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		if (!open) return;
		let cancelled = false;
		const loadStatus = async () => {
			try {
				const response = await fetch(buildApiPath(OCR_ENDPOINT), {
					method: "GET",
					credentials: "same-origin",
					headers: { Accept: "application/json" },
					cache: "no-store",
				});
				const payload = (await response.json()) as OcrStatusPayload;
				if (!cancelled) setStatus(payload);
			} catch (error) {
				if (!cancelled) {
					setStatus({
						success: false,
						configured: false,
						error:
							error instanceof Error
								? error.message
								: "Failed to load OCR status",
					});
				}
			}
		};
		void loadStatus();
		return () => {
			cancelled = true;
		};
	}, [open]);

	useEffect(() => {
		return () => {
			for (const item of items) {
				if (item.previewUrl.startsWith("blob:"))
					URL.revokeObjectURL(item.previewUrl);
			}
		};
	}, [items]);

	const readyItems = useMemo(
		() => items.filter((item) => item.status === "ready" && item.draft),
		[items],
	);
	const selectedReadyItems = useMemo(
		() =>
			readyItems.filter(
				(item) =>
					item.selected && item.draft && isRowAcceptable(item.draft.row),
			),
		[readyItems],
	);
	const canAcceptCombinedDraft =
		extractionMode === "combined" &&
		combinedDraft.status === "ready" &&
		Boolean(combinedDraft.draft && isRowAcceptable(combinedDraft.draft.row));
	const selectedCombinedCount =
		canAcceptCombinedDraft && combinedDraft.selected ? 1 : 0;
	const hasExtractableItems = items.some(
		(item) => item.status === "queued" || item.status === "error",
	);
	const canRunExtraction =
		extractionMode === "combined" ? items.length > 0 : hasExtractableItems;
	const isExtracting =
		items.some((item) => item.status === "extracting") ||
		combinedDraft.status === "extracting";
	const maxImages = status?.maxImages ?? 6;
	const maxImageBytes = status?.maxImageBytes ?? 5 * 1024 * 1024;

	const handleFiles = useCallback(
		async (files: FileList | File[]) => {
			const candidates = Array.from(files).filter((file) =>
				file.type.startsWith("image/"),
			);
			if (candidates.length === 0) return;
			setModalError("");
			const remainingSlots = Math.max(0, maxImages - items.length);
			if (remainingSlots === 0) {
				setModalError(`OCR accepts up to ${maxImages} images at once.`);
				return;
			}
			const accepted = candidates.slice(0, remainingSlots);
			if (accepted.length < candidates.length) {
				setModalError(
					`Added ${accepted.length}; OCR accepts ${maxImages} images at once.`,
				);
			}

			setIsPreparing(true);
			try {
				const preparedItems = await Promise.all(
					accepted.map(async (file): Promise<LocalOcrItem> => {
						const prepared = await prepareImageForOcr(file);
						if (prepared.base64.length > maxImageBytes) {
							return {
								id: newId(),
								fileName: file.name,
								mimeType: prepared.mimeType,
								base64: prepared.base64,
								previewUrl: prepared.previewUrl,
								status: "error",
								error: `Image is still too large after compression (${formatBytes(prepared.base64.length)}).`,
								selected: false,
								rowQuality: "draft",
								edited: false,
							};
						}
						return {
							id: newId(),
							fileName: file.name,
							mimeType: prepared.mimeType,
							base64: prepared.base64,
							previewUrl: prepared.previewUrl,
							status: "queued",
							selected: true,
							rowQuality: "draft",
							edited: false,
						};
					}),
				);
				setItems((current) => [...current, ...preparedItems]);
				setCombinedDraft({
					status: "idle",
					selected: true,
					rowQuality: combinedDraft.rowQuality,
					edited: false,
				});
			} catch (error) {
				setModalError(
					error instanceof Error ? error.message : "Failed to prepare images",
				);
			} finally {
				setIsPreparing(false);
				if (inputRef.current) inputRef.current.value = "";
			}
		},
		[combinedDraft.rowQuality, items.length, maxImageBytes, maxImages],
	);

	useEffect(() => {
		if (!open) return;
		const handlePaste = (event: ClipboardEvent) => {
			const files = Array.from(event.clipboardData?.files ?? []).filter(
				(file) => file.type.startsWith("image/"),
			);
			if (files.length === 0) return;
			event.preventDefault();
			void handleFiles(files);
		};
		window.addEventListener("paste", handlePaste);
		return () => window.removeEventListener("paste", handlePaste);
	}, [handleFiles, open]);

	const runOcr = async () => {
		const pending =
			extractionMode === "combined"
				? items
				: items.filter(
						(item) => item.status === "queued" || item.status === "error",
					);
		if (pending.length === 0 || isExtracting) return;
		setModalError("");
		if (extractionMode === "combined") {
			setCombinedDraft({
				status: "extracting",
				selected: true,
				rowQuality: combinedDraft.rowQuality,
				edited: false,
			});
		}
		setItems((current) =>
			current.map((item) =>
				pending.some((pendingItem) => pendingItem.id === item.id)
					? { ...item, status: "extracting", error: undefined }
					: item,
			),
		);

		try {
			const response = await fetch(buildApiPath(OCR_ENDPOINT), {
				method: "POST",
				credentials: "same-origin",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
				},
				cache: "no-store",
				body: JSON.stringify({
					combineImages: extractionMode === "combined",
					images: pending.map((item) => ({
						id: item.id,
						fileName: item.fileName,
						mimeType: item.mimeType,
						base64: item.base64,
					})),
				}),
			});
			const payload = (await response.json()) as OcrExtractPayload;
			setStatus(payload);
			if (!response.ok || !payload.success) {
				throw new Error(payload.error || `OCR failed (${response.status})`);
			}
			if (extractionMode === "combined") {
				const result = payload.results?.[0];
				if (!result) {
					throw new Error("OCR did not return a combined result.");
				}
				if (!result.success) {
					setCombinedDraft({
						status: "error",
						error: result.error,
						selected: false,
						rowQuality: combinedDraft.rowQuality,
						edited: false,
					});
					setItems((current) =>
						current.map((item) =>
							pending.some((pendingItem) => pendingItem.id === item.id)
								? { ...item, status: "error", error: result.error }
								: item,
						),
					);
					return;
				}
				setCombinedDraft({
					status: "ready",
					selected: isRowAcceptable(result.draft.row),
					rowQuality: combinedDraft.rowQuality,
					edited: false,
					draft: result.draft,
				});
				setItems((current) =>
					current.map((item) =>
						pending.some((pendingItem) => pendingItem.id === item.id)
							? { ...item, status: "ready", error: undefined }
							: item,
					),
				);
				return;
			}
			const resultsById = new Map(
				(payload.results ?? []).map((result) => [
					result.success ? result.draft.id : result.id,
					result,
				]),
			);
			setItems((current) =>
				current.map((item) => {
					if (!pending.some((pendingItem) => pendingItem.id === item.id)) {
						return item;
					}
					const result = resultsById.get(item.id);
					if (!result) {
						return {
							...item,
							status: "error",
							error: "OCR did not return a result for this image.",
						};
					}
					if (!result.success) {
						return {
							...item,
							status: "error",
							error: result.error,
						};
					}
					return {
						...item,
						status: "ready",
						selected: isRowAcceptable(result.draft.row),
						draft: result.draft,
						error: undefined,
					};
				}),
			);
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "OCR extraction failed";
			if (extractionMode === "combined") {
				setCombinedDraft({
					status: "error",
					error: message,
					selected: false,
					rowQuality: combinedDraft.rowQuality,
					edited: false,
				});
			}
			setItems((current) =>
				current.map((item) =>
					pending.some((pendingItem) => pendingItem.id === item.id)
						? { ...item, status: "error", error: message }
						: item,
				),
			);
		}
	};

	const removeItem = (itemId: string) => {
		setItems((current) => current.filter((item) => item.id !== itemId));
		setCombinedDraft((current) => ({
			status: "idle",
			selected: true,
			rowQuality: current.rowQuality,
			edited: false,
		}));
	};

	const clearImages = () => {
		setItems([]);
		setCombinedDraft((current) => ({
			status: "idle",
			selected: true,
			rowQuality: current.rowQuality,
			edited: false,
		}));
		if (inputRef.current) inputRef.current.value = "";
	};

	const updateItem = (
		itemId: string,
		updater: (item: LocalOcrItem) => LocalOcrItem,
	) => {
		setItems((current) =>
			current.map((item) => (item.id === itemId ? updater(item) : item)),
		);
	};

	const acceptSelected = (saveAfterAdd: boolean) => {
		const rows: EditableSheetRow[] = [];
		if (
			extractionMode === "combined" &&
			combinedDraft.selected &&
			combinedDraft.draft &&
			isRowAcceptable(combinedDraft.draft.row)
		) {
			rows.push({
				...combinedDraft.draft.row,
				detailsQualityOverride: combinedDraft.rowQuality,
				sourceConfirmed: "",
				eventKey: "",
			});
			onAcceptRows(rows, { saveAfterAdd });
			setItems([]);
			setCombinedDraft({
				status: "idle",
				selected: true,
				rowQuality: "draft",
				edited: false,
			});
			return;
		}
		for (const item of selectedReadyItems) {
			const row = item.draft?.row;
			if (!row) continue;
			rows.push({
				...row,
				detailsQualityOverride: item.rowQuality,
				sourceConfirmed: "",
				eventKey: "",
			});
		}
		if (rows.length === 0) return;
		onAcceptRows(rows, { saveAfterAdd });
		setItems((current) =>
			current.filter(
				(item) =>
					!selectedReadyItems.some(
						(selectedItem) => selectedItem.id === item.id,
					),
			),
		);
	};

	const renderDraftFields = (
		draft: OcrDraftPayload,
		onDraftChange: (nextDraft: OcrDraftPayload) => void,
	) => (
		<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
			{EVENT_OCR_FIELD_KEYS.map((fieldKey) => {
				const field = draft.fields[fieldKey];
				const value = draft.row[fieldKey] ?? "";
				const id = `${draft.id}-${fieldKey}`;
				const isLong = LONG_FIELD_KEYS.has(fieldKey);
				const sourceLabel = getFieldSourceLabel(field, draft);
				const alternatives = field?.alternatives ?? [];
				return (
					<div key={fieldKey} className={isLong ? "xl:col-span-2" : ""}>
						<Label htmlFor={id} className="text-xs">
							{FIELD_LABELS[fieldKey]}
						</Label>
						{fieldKey === "notes" ? (
							<Textarea
								id={id}
								value={value}
								rows={3}
								onChange={(event) =>
									onDraftChange(
										updateDraftField(draft, fieldKey, event.target.value),
									)
								}
							/>
						) : (
							<Input
								id={id}
								value={value}
								onChange={(event) =>
									onDraftChange(
										updateDraftField(draft, fieldKey, event.target.value),
									)
								}
							/>
						)}
						{field?.evidence && (
							<p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
								{formatConfidence(field.confidence)}
								{sourceLabel ? ` · ${sourceLabel}` : ""} · {field.evidence}
							</p>
						)}
						{alternatives.length > 0 && (
							<Popover>
								<PopoverTrigger
									render={
										<button
											type="button"
											className="mt-1 rounded border bg-muted/30 px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
										>
											{alternatives.length + 1} possible values
										</button>
									}
								/>
								<PopoverContent
									align="start"
									side="bottom"
									className="z-[120] w-[min(340px,calc(100vw-2rem))] p-2"
								>
									<div className="space-y-1.5">
										<div className="rounded-md border bg-muted/25 px-2 py-1.5">
											<p className="text-xs font-medium">Current pick</p>
											<p className="break-words text-sm">
												{field.value ?? "Empty"}
											</p>
											<p className="mt-0.5 text-[11px] text-muted-foreground">
												{formatCandidateMeta(field, draft)}
											</p>
										</div>
										{alternatives.map((candidate, index) => (
											<button
												key={`${candidate.value}-${index}`}
												type="button"
												className="w-full rounded-md border bg-background px-2 py-1.5 text-left hover:bg-muted/45"
												onClick={() =>
													onDraftChange(
														applyDraftCandidate(draft, fieldKey, candidate),
													)
												}
											>
												<span className="block text-xs font-medium">
													Option {index + 2}
												</span>
												<span className="block break-words text-sm">
													{candidate.value}
												</span>
												<span className="mt-0.5 block text-[11px] text-muted-foreground">
													{formatCandidateMeta(candidate, draft)}
												</span>
												{candidate.evidence && (
													<span className="mt-1 line-clamp-2 block text-[11px] text-muted-foreground">
														{candidate.evidence}
													</span>
												)}
											</button>
										))}
									</div>
								</PopoverContent>
							</Popover>
						)}
					</div>
				);
			})}
		</div>
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[92vh] w-[min(1180px,calc(100vw-1rem))] max-w-none overflow-hidden p-0 sm:max-w-none">
				<div className="flex max-h-[92vh] min-h-0 flex-col">
					<DialogHeader className="shrink-0 border-b px-5 pt-5 pb-4 pr-14 sm:px-6">
						<div className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<DialogTitle className="text-xl">
									Extract events from screenshots
								</DialogTitle>
								<DialogDescription className="mt-1 max-w-2xl">
									Upload one or more screenshots, review the suggested fields
									with source evidence, then add accepted rows to the event
									sheet.
								</DialogDescription>
							</div>
							<div className="flex flex-wrap items-center gap-2 text-xs">
								<Badge variant={status?.configured ? "secondary" : "outline"}>
									{status?.provider ?? "ocr"} / {status?.model ?? "not loaded"}
								</Badge>
								<Badge
									variant={status?.configured ? "secondary" : "destructive"}
								>
									{status?.configured ? "Configured" : "Needs key"}
								</Badge>
							</div>
						</div>
					</DialogHeader>

					<div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
						{status?.configured === false && (
							<div className="mb-4 rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-100">
								Set <code>EVENT_OCR_API_KEY</code> or{" "}
								<code>GEMINI_API_KEY</code>, then restart the server. The editor
								still works; OCR extraction is disabled until then.
							</div>
						)}
						{status?.error && (
							<div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
								{status.error}
							</div>
						)}
						{modalError && (
							<div className="mb-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
								{modalError}
							</div>
						)}

						<div
							className="rounded-md border border-dashed bg-background/60 p-4"
							onDragOver={(event) => event.preventDefault()}
							onDrop={(event) => {
								event.preventDefault();
								void handleFiles(event.dataTransfer.files);
							}}
						>
							<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
								<div className="flex items-center gap-3">
									<div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
										<Upload className="h-5 w-5" />
									</div>
									<div>
										<p className="font-medium">
											Drop or paste screenshots here
										</p>
										<p className="text-xs text-muted-foreground">
											PNG, JPEG, WebP, or clipboard images. Up to {maxImages}.
											One event mode treats them as shared evidence.
										</p>
									</div>
								</div>
								<div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
									<div className="flex h-9 w-full rounded-md border bg-background p-0.5 sm:w-auto">
										<Button
											type="button"
											variant={
												extractionMode === "combined" ? "secondary" : "ghost"
											}
											size="sm"
											className="h-8 flex-1 sm:flex-none"
											onClick={() => {
												setExtractionMode("combined");
												setCombinedDraft((current) => ({
													status: "idle",
													selected: true,
													rowQuality: current.rowQuality,
													edited: false,
												}));
											}}
										>
											One event
										</Button>
										<Button
											type="button"
											variant={
												extractionMode === "separate" ? "secondary" : "ghost"
											}
											size="sm"
											className="h-8 flex-1 sm:flex-none"
											onClick={() => {
												setExtractionMode("separate");
												setItems((current) =>
													current.map((item) =>
														item.status === "ready" && !item.draft
															? { ...item, status: "queued" }
															: item,
													),
												);
											}}
										>
											Separate events
										</Button>
									</div>
									<Input
										ref={inputRef}
										type="file"
										accept="image/png,image/jpeg,image/webp"
										multiple
										className="sr-only"
										onChange={(event) => {
											if (event.target.files)
												void handleFiles(event.target.files);
										}}
									/>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-9 w-full gap-2 sm:w-auto"
										disabled={isExtracting || isPreparing}
										onClick={() => inputRef.current?.click()}
									>
										<UploadCloud className="h-4 w-4" />
										Choose images
									</Button>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-9 w-full gap-2 sm:w-auto"
										disabled={
											!canRunExtraction ||
											isExtracting ||
											isPreparing ||
											status?.configured === false
										}
										onClick={() => void runOcr()}
									>
										{isExtracting ? (
											<Loader2 className="h-4 w-4 animate-spin" />
										) : (
											<Sparkles className="h-4 w-4" />
										)}
										{extractionMode === "combined"
											? "Extract one event"
											: "Extract details"}
									</Button>
									{items.length > 0 && (
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="h-9 w-full gap-2 sm:w-auto"
											disabled={isExtracting || isPreparing}
											onClick={clearImages}
										>
											<Trash2 className="h-4 w-4" />
											Clear images
										</Button>
									)}
								</div>
							</div>
						</div>

						<div className="mt-4 space-y-3">
							{items.length === 0 ? (
								<div className="rounded-md border bg-background/55 px-4 py-8 text-center text-sm text-muted-foreground">
									<ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-70" />
									No screenshots queued yet.
								</div>
							) : extractionMode === "combined" ? (
								<div className="rounded-md border bg-background/55 p-3">
									<div className="mb-3 flex flex-wrap gap-2">
										{items.map((item, index) => (
											<div
												key={item.id}
												className="flex w-full items-center gap-2 rounded-md border bg-muted/20 p-2 sm:w-44"
											>
												<img
													src={item.previewUrl}
													alt=""
													className="h-12 w-12 rounded border object-contain bg-background"
												/>
												<div className="min-w-0 flex-1">
													<p className="truncate text-xs font-medium">
														{index + 1}. {item.fileName}
													</p>
													<p className="text-[11px] text-muted-foreground">
														{item.status}
													</p>
												</div>
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="h-7 w-7"
													onClick={() => removeItem(item.id)}
													title="Remove screenshot"
												>
													<Trash2 className="h-4 w-4" />
												</Button>
											</div>
										))}
									</div>

									{combinedDraft.status === "idle" && (
										<div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
											Ready to extract one event from all screenshots.
										</div>
									)}
									{combinedDraft.status === "extracting" && (
										<div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
											<Loader2 className="h-4 w-4 animate-spin" />
											Reading all screenshots as one event...
										</div>
									)}
									{combinedDraft.status === "error" && (
										<div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
											<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
											<span>{combinedDraft.error ?? "OCR failed"}</span>
										</div>
									)}
									{combinedDraft.status === "ready" && combinedDraft.draft && (
										<div className="space-y-3">
											<div className="flex flex-wrap items-center justify-between gap-2">
												<div>
													<label className="flex items-center gap-2 text-sm font-medium">
														<input
															type="checkbox"
															checked={combinedDraft.selected}
															disabled={!canAcceptCombinedDraft}
															onChange={(event) =>
																setCombinedDraft((current) => ({
																	...current,
																	selected: event.target.checked,
																}))
															}
														/>
														Select merged event for sheet
													</label>
													{combinedDraft.draft.usage && (
														<p className="mt-1 text-xs text-muted-foreground">
															{formatTokenUsage(combinedDraft.draft.usage)}
														</p>
													)}
													<p className="mt-1 text-xs text-muted-foreground">
														{combinedDraft.edited
															? "Edited draft; accepts into sheet autosave."
															: "AI draft; accepts into sheet autosave. Draft stays admin-only."}
													</p>
												</div>
												<div className="flex items-center gap-2">
													<Label htmlFor="combined-quality" className="text-xs">
														Sheet status
													</Label>
													<select
														id="combined-quality"
														value={combinedDraft.rowQuality}
														onChange={(event) =>
															setCombinedDraft((current) => ({
																...current,
																rowQuality:
																	event.target.value === "review"
																		? "review"
																		: "draft",
															}))
														}
														className="h-8 rounded-md border border-input bg-background px-2 text-xs"
													>
														<option value="draft">Draft (admin only)</option>
														<option value="review">Review-ready</option>
													</select>
												</div>
											</div>
											{!canAcceptCombinedDraft && (
												<div className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-100">
													Title and date are required before this suggestion can
													be added.
												</div>
											)}
											{renderDraftFields(combinedDraft.draft, (nextDraft) =>
												setCombinedDraft((current) => ({
													...current,
													draft: nextDraft,
													edited: true,
													rowQuality: "draft",
												})),
											)}
											{combinedDraft.draft.warnings.length > 0 && (
												<div className="rounded-md border bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
													{combinedDraft.draft.warnings.join(" ")}
												</div>
											)}
										</div>
									)}
								</div>
							) : (
								items.map((item) => {
									const row = item.draft?.row;
									const canAccept = row ? isRowAcceptable(row) : false;
									return (
										<div
											key={item.id}
											className="rounded-md border bg-background/55 p-3"
										>
											<div className="flex flex-col gap-3 lg:flex-row">
												<div className="w-full shrink-0 lg:w-52">
													<img
														src={item.previewUrl}
														alt=""
														className="aspect-[4/5] w-full rounded-md border object-contain bg-muted/30"
													/>
													<div className="mt-2 flex items-center justify-between gap-2">
														<div className="min-w-0">
															<p className="truncate text-sm font-medium">
																{item.fileName}
															</p>
															<p className="text-xs text-muted-foreground">
																{item.status === "ready" && item.draft
																	? `${formatConfidence(item.draft.averageConfidence)} avg confidence${item.draft.usage ? ` · ${formatTokenUsage(item.draft.usage)}` : ""}`
																	: item.status}
															</p>
														</div>
														<Button
															type="button"
															variant="ghost"
															size="icon"
															className="h-8 w-8"
															onClick={() => removeItem(item.id)}
															title="Remove screenshot"
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</div>
												</div>

												<div className="min-w-0 flex-1">
													{item.status === "extracting" && (
														<div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
															<Loader2 className="h-4 w-4 animate-spin" />
															Reading screenshot...
														</div>
													)}
													{item.status === "queued" && (
														<div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
															Ready to extract.
														</div>
													)}
													{item.status === "error" && (
														<div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
															<AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
															<span>{item.error ?? "OCR failed"}</span>
														</div>
													)}
													{item.status === "ready" && item.draft && (
														<div className="space-y-3">
															<div className="flex flex-wrap items-center justify-between gap-2">
																<div>
																	<label className="flex items-center gap-2 text-sm font-medium">
																		<input
																			type="checkbox"
																			checked={item.selected}
																			disabled={!canAccept}
																			onChange={(event) =>
																				updateItem(item.id, (current) => ({
																					...current,
																					selected: event.target.checked,
																				}))
																			}
																		/>
																		Select for sheet
																	</label>
																	<p className="mt-1 text-xs text-muted-foreground">
																		{item.edited
																			? "Edited draft; accepts into sheet autosave."
																			: "AI draft; accepts into sheet autosave. Draft stays admin-only."}
																	</p>
																</div>
																<div className="flex items-center gap-2">
																	<Label
																		htmlFor={`${item.id}-quality`}
																		className="text-xs"
																	>
																		Sheet status
																	</Label>
																	<select
																		id={`${item.id}-quality`}
																		value={item.rowQuality}
																		onChange={(event) =>
																			updateItem(item.id, (current) => ({
																				...current,
																				rowQuality:
																					event.target.value === "review"
																						? "review"
																						: "draft",
																			}))
																		}
																		className="h-8 rounded-md border border-input bg-background px-2 text-xs"
																	>
																		<option value="draft">
																			Draft (admin only)
																		</option>
																		<option value="review">Review-ready</option>
																	</select>
																</div>
															</div>
															{!canAccept && (
																<div className="rounded-md border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/30 dark:text-amber-100">
																	Title and date are required before this
																	suggestion can be added.
																</div>
															)}
															{renderDraftFields(item.draft, (nextDraft) =>
																updateItem(item.id, (current) => ({
																	...current,
																	draft: nextDraft,
																	edited: true,
																	rowQuality: "draft",
																})),
															)}
															{item.draft.warnings.length > 0 && (
																<div className="rounded-md border bg-muted/25 px-3 py-2 text-xs text-muted-foreground">
																	{item.draft.warnings.join(" ")}
																</div>
															)}
														</div>
													)}
												</div>
											</div>
										</div>
									);
								})
							)}
						</div>
					</div>

					<div className="shrink-0 border-t bg-background px-5 py-3 sm:px-6">
						<div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
							<div className="text-sm text-muted-foreground">
								{selectedCombinedCount + selectedReadyItems.length > 0 ? (
									<span className="inline-flex items-center gap-2">
										<CheckCircle2 className="h-4 w-4 text-green-600" />
										{selectedCombinedCount + selectedReadyItems.length}{" "}
										suggestion
										{selectedCombinedCount + selectedReadyItems.length === 1
											? ""
											: "s"}{" "}
										ready
									</span>
								) : (
									"Review suggestions before adding them to the sheet."
								)}
							</div>
							<div className="flex flex-wrap gap-2 md:justify-end">
								<Button
									type="button"
									variant="outline"
									className="w-full sm:w-auto"
									onClick={() => onOpenChange(false)}
								>
									Close
								</Button>
								<Button
									type="button"
									variant="outline"
									className="w-full sm:w-auto"
									disabled={
										selectedCombinedCount + selectedReadyItems.length === 0
									}
									onClick={() => acceptSelected(false)}
								>
									Add selected
								</Button>
								<Button
									type="button"
									className="w-full sm:w-auto"
									disabled={
										selectedCombinedCount + selectedReadyItems.length === 0
									}
									onClick={() => acceptSelected(true)}
								>
									Add selected and save
								</Button>
							</div>
						</div>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
