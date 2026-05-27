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
import { Textarea } from "@/components/ui/textarea";
import type { EditableSheetRow } from "@/features/data-management/csv/sheet-editor";
import {
	EVENT_OCR_FIELD_KEYS,
	type EventOcrFieldKey,
	type EventOcrFieldSuggestion,
} from "@/features/data-management/event-ocr/types";
import {
	AlertCircle,
	CheckCircle2,
	ImageIcon,
	Loader2,
	Sparkles,
	Trash2,
	Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

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
	provider: string;
	model: string;
	fields: Record<EventOcrFieldKey, EventOcrFieldSuggestion>;
	rawText: string;
	warnings: string[];
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
	districtArea: "District/Area",
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
			}),
			value: value.trim() ? value : null,
		},
	},
	missingRequiredFields: ["title", "date"].filter(
		(key) => !String(key === fieldKey ? value : (draft.row[key] ?? "")).trim(),
	),
});

export const EventSheetOcrDraftModal = ({
	open,
	onOpenChange,
	onAcceptRows,
}: EventSheetOcrDraftModalProps) => {
	const [status, setStatus] = useState<OcrStatusPayload | null>(null);
	const [items, setItems] = useState<LocalOcrItem[]>([]);
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
	const hasExtractableItems = items.some(
		(item) => item.status === "queued" || item.status === "error",
	);
	const isExtracting = items.some((item) => item.status === "extracting");
	const maxImages = status?.maxImages ?? 6;
	const maxImageBytes = status?.maxImageBytes ?? 5 * 1024 * 1024;

	const handleFiles = async (files: FileList | File[]) => {
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
					};
				}),
			);
			setItems((current) => [...current, ...preparedItems]);
		} catch (error) {
			setModalError(
				error instanceof Error ? error.message : "Failed to prepare images",
			);
		} finally {
			setIsPreparing(false);
			if (inputRef.current) inputRef.current.value = "";
		}
	};

	const runOcr = async () => {
		const pending = items.filter(
			(item) => item.status === "queued" || item.status === "error",
		);
		if (pending.length === 0 || isExtracting) return;
		setModalError("");
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
									Upload flyers or screenshots, review the suggested fields,
									then add accepted rows to the event sheet.
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
										<p className="font-medium">Drop screenshots here</p>
										<p className="text-xs text-muted-foreground">
											PNG, JPEG, or WebP. Up to {maxImages} images, compressed
											before upload.
										</p>
									</div>
								</div>
								<div className="flex flex-wrap gap-2">
									<Input
										ref={inputRef}
										type="file"
										accept="image/png,image/jpeg,image/webp"
										multiple
										className="h-9 w-64"
										onChange={(event) => {
											if (event.target.files)
												void handleFiles(event.target.files);
										}}
									/>
									<Button
										type="button"
										variant="outline"
										size="sm"
										className="h-9 gap-2"
										disabled={
											!hasExtractableItems ||
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
										Extract details
									</Button>
								</div>
							</div>
						</div>

						<div className="mt-4 space-y-3">
							{items.length === 0 ? (
								<div className="rounded-md border bg-background/55 px-4 py-8 text-center text-sm text-muted-foreground">
									<ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-70" />
									No screenshots queued yet.
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
																	? `${formatConfidence(item.draft.averageConfidence)} avg confidence`
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
																		<option value="draft">Draft hidden</option>
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
															<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
																{EVENT_OCR_FIELD_KEYS.map((fieldKey) => {
																	const field = item.draft?.fields[fieldKey];
																	const value = item.draft?.row[fieldKey] ?? "";
																	const id = `${item.id}-${fieldKey}`;
																	const isLong = LONG_FIELD_KEYS.has(fieldKey);
																	return (
																		<div
																			key={fieldKey}
																			className={isLong ? "xl:col-span-2" : ""}
																		>
																			<Label htmlFor={id} className="text-xs">
																				{FIELD_LABELS[fieldKey]}
																			</Label>
																			{fieldKey === "notes" ? (
																				<Textarea
																					id={id}
																					value={value}
																					rows={3}
																					onChange={(event) =>
																						updateItem(item.id, (current) =>
																							current.draft
																								? {
																										...current,
																										draft: updateDraftField(
																											current.draft,
																											fieldKey,
																											event.target.value,
																										),
																									}
																								: current,
																						)
																					}
																				/>
																			) : (
																				<Input
																					id={id}
																					value={value}
																					onChange={(event) =>
																						updateItem(item.id, (current) =>
																							current.draft
																								? {
																										...current,
																										draft: updateDraftField(
																											current.draft,
																											fieldKey,
																											event.target.value,
																										),
																									}
																								: current,
																						)
																					}
																				/>
																			)}
																			{field?.evidence && (
																				<p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
																					{formatConfidence(field.confidence)} ·{" "}
																					{field.evidence}
																				</p>
																			)}
																		</div>
																	);
																})}
															</div>
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
								{selectedReadyItems.length > 0 ? (
									<span className="inline-flex items-center gap-2">
										<CheckCircle2 className="h-4 w-4 text-green-600" />
										{selectedReadyItems.length} suggestion
										{selectedReadyItems.length === 1 ? "" : "s"} ready
									</span>
								) : (
									"Review suggestions before adding them to the sheet."
								)}
							</div>
							<div className="flex flex-wrap gap-2 md:justify-end">
								<Button
									type="button"
									variant="outline"
									onClick={() => onOpenChange(false)}
								>
									Close
								</Button>
								<Button
									type="button"
									variant="outline"
									disabled={selectedReadyItems.length === 0}
									onClick={() => acceptSelected(false)}
								>
									Add selected
								</Button>
								<Button
									type="button"
									disabled={selectedReadyItems.length === 0}
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
