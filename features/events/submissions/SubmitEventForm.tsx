"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { normalizeSearchText } from "@/features/events/genre-normalization";
import { normalizeProofLink } from "@/features/events/submissions/proof-link";
import {
	MUSIC_GENRES,
	type MusicGenreDefinition,
} from "@/features/events/types";
import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const DRAFT_STORAGE_KEY = "oooc:fete-finder:submit-event:draft:v1";
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

type FormState = {
	eventName: string;
	date: string;
	startTime: string;
	location: string;
	hostEmail: string;
	proofLink: string;
	endTime: string;
	genre: string;
	suggestedGenres: string;
	price: string;
	age: string;
	indoorOutdoor: string;
	notes: string;
	arrondissement: string;
	honeypot: string;
};

const EMPTY_FORM: FormState = {
	eventName: "",
	date: "",
	startTime: "",
	location: "",
	hostEmail: "",
	proofLink: "",
	endTime: "",
	genre: "",
	suggestedGenres: "",
	price: "",
	age: "",
	indoorOutdoor: "",
	notes: "",
	arrondissement: "",
	honeypot: "",
};

const buildReusableForm = (previous: FormState): FormState => ({
	...EMPTY_FORM,
	eventName: previous.eventName,
	location: previous.location,
	hostEmail: previous.hostEmail,
	genre: previous.genre,
	suggestedGenres: previous.suggestedGenres,
	price: previous.price,
	age: previous.age,
	indoorOutdoor: previous.indoorOutdoor,
	arrondissement: previous.arrondissement,
});

const hasDraftContent = (form: FormState): boolean =>
	Object.entries(form).some(
		([field, value]) => field !== "honeypot" && value.trim().length > 0,
	);

const shouldShowOptionalDetails = (form: FormState): boolean =>
	Boolean(form.age || form.indoorOutdoor || form.notes || form.arrondissement);

const toStoredDraft = (form: FormState): FormState => {
	const selectedGenres = dedupeGenreLabels(parseGenreLabels(form.genre));
	const suggestedGenres = dedupeGenreLabels(
		parseGenreLabels(form.suggestedGenres),
	).filter((genre) => hasGenreLabel(selectedGenres, genre));
	return {
		...form,
		genre: formatGenreValue(selectedGenres),
		suggestedGenres: formatGenreValue(suggestedGenres),
		honeypot: "",
	};
};

const parseGenreLabels = (value: string): string[] =>
	value
		.split(",")
		.map((genre) => genre.trim())
		.filter(Boolean);

const dedupeGenreLabels = (genres: string[]): string[] => {
	const seen = new Set<string>();
	const result: string[] = [];
	for (const genre of genres) {
		const normalized = normalizeSearchText(genre);
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		result.push(genre.trim());
	}
	return result;
};

const formatGenreValue = (genres: string[]): string => genres.join(", ");

const hasGenreLabel = (genres: string[], label: string): boolean => {
	const normalized = normalizeSearchText(label);
	return genres.some((genre) => normalizeSearchText(genre) === normalized);
};

const toRestoredDraft = (candidate: unknown): FormState | null => {
	if (!candidate || typeof candidate !== "object") return null;
	const draft = candidate as Record<string, unknown>;
	const restoredForm = {
		eventName: typeof draft.eventName === "string" ? draft.eventName : "",
		date: typeof draft.date === "string" ? draft.date : "",
		startTime: typeof draft.startTime === "string" ? draft.startTime : "",
		location: typeof draft.location === "string" ? draft.location : "",
		hostEmail: typeof draft.hostEmail === "string" ? draft.hostEmail : "",
		proofLink: typeof draft.proofLink === "string" ? draft.proofLink : "",
		endTime: typeof draft.endTime === "string" ? draft.endTime : "",
		genre: typeof draft.genre === "string" ? draft.genre : "",
		suggestedGenres:
			typeof draft.suggestedGenres === "string" ? draft.suggestedGenres : "",
		price: typeof draft.price === "string" ? draft.price : "",
		age: typeof draft.age === "string" ? draft.age : "",
		indoorOutdoor:
			typeof draft.indoorOutdoor === "string" ? draft.indoorOutdoor : "",
		notes: typeof draft.notes === "string" ? draft.notes : "",
		arrondissement:
			typeof draft.arrondissement === "string" ? draft.arrondissement : "",
		honeypot: "",
	};
	const selectedGenres = dedupeGenreLabels(
		parseGenreLabels(restoredForm.genre),
	);
	const suggestedGenres = dedupeGenreLabels(
		parseGenreLabels(restoredForm.suggestedGenres),
	).filter((genre) => hasGenreLabel(selectedGenres, genre));
	return {
		...restoredForm,
		genre: formatGenreValue(selectedGenres),
		suggestedGenres: formatGenreValue(suggestedGenres),
	};
};

const readStoredDraft = (): FormState | null => {
	try {
		const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);
		if (!rawDraft) return null;
		const parsed = JSON.parse(rawDraft) as {
			savedAt?: unknown;
			form?: Partial<FormState>;
		};
		if (typeof parsed.savedAt !== "number") return null;
		if (Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
			window.localStorage.removeItem(DRAFT_STORAGE_KEY);
			return null;
		}
		return toRestoredDraft(parsed.form);
	} catch {
		window.localStorage.removeItem(DRAFT_STORAGE_KEY);
		return null;
	}
};

const saveDraft = (form: FormState) => {
	try {
		if (!hasDraftContent(form)) {
			window.localStorage.removeItem(DRAFT_STORAGE_KEY);
			return;
		}
		window.localStorage.setItem(
			DRAFT_STORAGE_KEY,
			JSON.stringify({
				savedAt: Date.now(),
				form: toStoredDraft(form),
			}),
		);
	} catch {
		// Losing autosave should never block a real event submission.
	}
};

const clearDraft = () => {
	try {
		window.localStorage.removeItem(DRAFT_STORAGE_KEY);
	} catch {
		// Ignore storage failures; the in-page form state is still authoritative.
	}
};

const hasMatchingGenreOption = (
	value: string,
	genreOptions: readonly MusicGenreDefinition[],
): boolean => {
	const normalized = normalizeSearchText(value);
	if (!normalized) return false;
	return genreOptions.some((genre) =>
		[genre.label, genre.key, ...(genre.aliases ?? [])].some(
			(candidate) => normalizeSearchText(candidate) === normalized,
		),
	);
};

const isValidArrondissementInput = (value: string): boolean => {
	const normalized = value.trim().toLowerCase();
	if (!normalized) return true;
	return (
		/^([1-9]|1\d|20)$/.test(normalized) ||
		["greater-paris", "outside-paris", "unknown"].includes(normalized)
	);
};

export function SubmitEventForm({
	submissionsEnabled = true,
	genreOptions = MUSIC_GENRES,
}: {
	submissionsEnabled?: boolean;
	genreOptions?: readonly MusicGenreDefinition[];
}) {
	const [form, setForm] = useState<FormState>(EMPTY_FORM);
	const [lastSubmittedForm, setLastSubmittedForm] = useState<FormState | null>(
		null,
	);
	const [showOptional, setShowOptional] = useState(false);
	const [isGenrePickerOpen, setIsGenrePickerOpen] = useState(false);
	const [genreSearchQuery, setGenreSearchQuery] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSubmitted, setIsSubmitted] = useState(false);
	const [isReusingPrevious, setIsReusingPrevious] = useState(false);
	const [isDraftReady, setIsDraftReady] = useState(false);
	const [wasDraftRestored, setWasDraftRestored] = useState(false);
	const [errorMessage, setErrorMessage] = useState("");
	const [successMessage, setSuccessMessage] = useState("");
	const [formStartedAt, setFormStartedAt] = useState(() =>
		new Date().toISOString(),
	);
	const isFormDisabled = !submissionsEnabled || isSubmitting;

	useEffect(() => {
		const storedDraft = readStoredDraft();
		if (storedDraft && hasDraftContent(storedDraft)) {
			setForm(storedDraft);
			setShowOptional(shouldShowOptionalDetails(storedDraft));
			setWasDraftRestored(true);
		}
		setIsDraftReady(true);
	}, []);

	useEffect(() => {
		if (!isDraftReady || isSubmitted) return;
		saveDraft(form);
	}, [form, isDraftReady, isSubmitted]);

	const updateField = (field: keyof FormState, value: string) => {
		setForm((current) => ({
			...current,
			[field]: value,
		}));
	};

	const normalizeProofLinkField = () => {
		const normalized = normalizeProofLink(form.proofLink);
		if (normalized) {
			updateField("proofLink", normalized);
		}
	};

	const toggleGenre = (label: string) => {
		setForm((current) => {
			const selectedGenres = dedupeGenreLabels(parseGenreLabels(current.genre));
			const isRemoving = hasGenreLabel(selectedGenres, label);
			const nextGenres = isRemoving
				? selectedGenres.filter(
						(genre) =>
							normalizeSearchText(genre) !== normalizeSearchText(label),
					)
				: [...selectedGenres, label];
			const nextSuggestedGenres = isRemoving
				? parseGenreLabels(current.suggestedGenres).filter(
						(genre) =>
							normalizeSearchText(genre) !== normalizeSearchText(label),
					)
				: dedupeGenreLabels(parseGenreLabels(current.suggestedGenres));
			return {
				...current,
				genre: formatGenreValue(nextGenres),
				suggestedGenres: formatGenreValue(nextSuggestedGenres),
			};
		});
	};

	const addSuggestedGenre = () => {
		const label = genreSearchQuery.trim();
		if (!label || hasMatchingGenreOption(label, genreOptions)) return;
		setForm((current) => {
			const selectedGenres = dedupeGenreLabels(parseGenreLabels(current.genre));
			const suggestedGenres = dedupeGenreLabels(
				parseGenreLabels(current.suggestedGenres),
			);
			const nextGenres = hasGenreLabel(selectedGenres, label)
				? selectedGenres
				: [...selectedGenres, label];
			const nextSuggestedGenres = hasGenreLabel(suggestedGenres, label)
				? suggestedGenres
				: [...suggestedGenres, label];
			return {
				...current,
				genre: formatGenreValue(nextGenres),
				suggestedGenres: formatGenreValue(nextSuggestedGenres),
			};
		});
		setGenreSearchQuery("");
	};

	const validate = (): string | null => {
		if (!form.eventName.trim()) return "Event name is required.";
		if (!form.date.trim()) return "Date is required.";
		if (!form.startTime.trim()) return "Start time is required.";
		if (!form.endTime.trim()) return "End time is required.";
		if (!form.location.trim()) return "Location is required.";
		if (!form.genre.trim()) return "Choose at least one music genre.";
		if (!form.price.trim()) return "Price is required.";
		if (!form.hostEmail.trim()) return "Host email is required.";
		if (!form.proofLink.trim()) return "Proof link is required.";
		if (!form.hostEmail.includes("@")) return "Enter a valid email address.";
		if (!normalizeProofLink(form.proofLink)) {
			return "Proof link must be a valid URL.";
		}
		if (!isValidArrondissementInput(form.arrondissement)) {
			return "Arrondissement must be 1-20, greater-paris, outside-paris, or unknown.";
		}
		return null;
	};

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setErrorMessage("");
		setSuccessMessage("");

		if (!submissionsEnabled) {
			setErrorMessage("Event submissions are currently closed.");
			return;
		}

		const validationError = validate();
		if (validationError) {
			setErrorMessage(validationError);
			return;
		}
		const normalizedProofLink = normalizeProofLink(form.proofLink);
		if (!normalizedProofLink) {
			setErrorMessage("Proof link must be a valid URL.");
			return;
		}
		const selectedSubmittedGenres = dedupeGenreLabels(
			parseGenreLabels(form.genre),
		);
		const suggestedSubmittedGenres = dedupeGenreLabels(
			parseGenreLabels(form.suggestedGenres),
		).filter((genre) => hasGenreLabel(selectedSubmittedGenres, genre));
		const submittedForm = {
			...form,
			genre: formatGenreValue(selectedSubmittedGenres),
			proofLink: normalizedProofLink,
			suggestedGenres: formatGenreValue(suggestedSubmittedGenres),
		};

		setIsSubmitting(true);
		try {
			const response = await fetch(`${basePath}/api/event-submissions`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					...submittedForm,
					formStartedAt,
				}),
				signal: AbortSignal.timeout(12000),
			});
			const payload = (await response.json()) as {
				success: boolean;
				message?: string;
				error?: string;
				issues?: string[];
			};

			if (!response.ok || !payload.success) {
				if (response.status === 429) {
					const retryAfterSeconds = response.headers.get("retry-after") || "60";
					setErrorMessage(
						`Too many submissions right now. Please try again in about ${retryAfterSeconds} seconds.`,
					);
					return;
				}
				setErrorMessage(
					payload.issues?.[0] || payload.error || "Failed to submit event.",
				);
				return;
			}

			setSuccessMessage(
				payload.message ||
					"Your event was sent for review. Add another with reused details, or start fresh.",
			);
			setIsSubmitted(true);
			setIsReusingPrevious(false);
			setLastSubmittedForm(submittedForm);
			setForm(EMPTY_FORM);
			clearDraft();
			setFormStartedAt(new Date().toISOString());
		} catch (error) {
			if (
				error instanceof Error &&
				(error.name === "TimeoutError" || error.name === "AbortError")
			) {
				setErrorMessage("Submission timed out. Please try again.");
				return;
			}
			setErrorMessage("Submission failed. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const focusField = (fieldId: string) => {
		window.requestAnimationFrame(() => {
			document.getElementById(fieldId)?.focus();
		});
	};

	const handleSubmitAnother = () => {
		if (!lastSubmittedForm) return;
		setForm(buildReusableForm(lastSubmittedForm));
		setShowOptional(
			Boolean(
				lastSubmittedForm.age ||
					lastSubmittedForm.indoorOutdoor ||
					lastSubmittedForm.arrondissement,
			),
		);
		setIsSubmitted(false);
		setIsReusingPrevious(true);
		setWasDraftRestored(false);
		setErrorMessage("");
		setSuccessMessage("");
		setFormStartedAt(new Date().toISOString());
		focusField("date");
	};

	const handleStartFresh = () => {
		setForm(EMPTY_FORM);
		setShowOptional(false);
		setIsSubmitted(false);
		setIsReusingPrevious(false);
		setWasDraftRestored(false);
		setErrorMessage("");
		setSuccessMessage("");
		clearDraft();
		setFormStartedAt(new Date().toISOString());
		focusField("eventName");
	};

	const handleClearForm = () => {
		if (
			hasDraftContent(form) &&
			!window.confirm("Clear this draft and start again?")
		) {
			return;
		}
		handleStartFresh();
	};

	const selectedGenres = dedupeGenreLabels(parseGenreLabels(form.genre));
	const suggestedGenres = dedupeGenreLabels(
		parseGenreLabels(form.suggestedGenres),
	);
	const activeSuggestedGenres = suggestedGenres.filter((genre) =>
		hasGenreLabel(selectedGenres, genre),
	);
	const filteredGenreOptions = useMemo(() => {
		const query = normalizeSearchText(genreSearchQuery);
		if (!query) return genreOptions;
		return genreOptions.filter((genre) =>
			[genre.label, genre.key, ...(genre.aliases ?? [])].some((candidate) =>
				normalizeSearchText(candidate).includes(query),
			),
		);
	}, [genreOptions, genreSearchQuery]);
	const canAddSuggestedGenre =
		genreSearchQuery.trim().length > 0 &&
		!hasMatchingGenreOption(genreSearchQuery, genreOptions) &&
		!hasGenreLabel(suggestedGenres, genreSearchQuery.trim());

	return (
		<div className="rounded-xl border border-border bg-card/70 p-4 shadow-sm sm:p-6">
			{!submissionsEnabled && (
				<div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
					Event submissions are currently closed. Please check back later.
				</div>
			)}
			<form onSubmit={handleSubmit} className="space-y-4">
				{wasDraftRestored && !isSubmitted && (
					<div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
						We restored your unsent draft from this browser.
					</div>
				)}
				{isReusingPrevious && (
					<div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
						Reusing details from your last submission. Update the event name,
						venue, genre, or price if they changed. Add a new date, time, and
						link for this event.
					</div>
				)}
				<div className="grid gap-4 md:grid-cols-2">
					<div className="space-y-2 md:col-span-2">
						<Label htmlFor="eventName">Event Name</Label>
						<Input
							id="eventName"
							list="previous-event-names"
							value={form.eventName}
							onChange={(event) => updateField("eventName", event.target.value)}
							placeholder="FDLM: Day Party, FDLM: After Party"
							required
							disabled={isFormDisabled}
						/>
					</div>
					<fieldset className="space-y-2 md:col-span-2">
						<legend className="text-sm font-medium">Schedule</legend>
						<div className="grid gap-4 md:grid-cols-3">
							<div className="space-y-2">
								<Label htmlFor="date">Date</Label>
								<Input
									id="date"
									type="date"
									value={form.date}
									onChange={(event) => updateField("date", event.target.value)}
									required
									disabled={isFormDisabled}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="startTime">Start</Label>
								<Input
									id="startTime"
									type="time"
									value={form.startTime}
									onChange={(event) =>
										updateField("startTime", event.target.value)
									}
									required
									disabled={isFormDisabled}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="endTime">End</Label>
								<Input
									id="endTime"
									type="time"
									value={form.endTime}
									onChange={(event) =>
										updateField("endTime", event.target.value)
									}
									required
									disabled={isFormDisabled}
								/>
							</div>
						</div>
					</fieldset>
					<div className="space-y-2 md:col-span-2">
						<Label htmlFor="location">Location</Label>
						<Input
							id="location"
							list="previous-locations"
							value={form.location}
							onChange={(event) => updateField("location", event.target.value)}
							placeholder="Venue name or address"
							required
							disabled={isFormDisabled}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="genre-picker">Music Genres</Label>
						<Button
							id="genre-picker"
							type="button"
							variant="outline"
							className="h-10 w-full justify-between px-3 font-normal"
							disabled={isFormDisabled}
							aria-expanded={isGenrePickerOpen}
							aria-controls="genre-picker-options"
							onClick={() => setIsGenrePickerOpen(true)}
						>
							<span className="truncate">
								{selectedGenres.length > 0
									? formatGenreValue(selectedGenres)
									: "Choose genres"}
							</span>
							<ChevronDown aria-hidden="true" />
						</Button>
						{activeSuggestedGenres.length > 0 && (
							<p className="text-xs text-muted-foreground">
								Suggested for review: {formatGenreValue(activeSuggestedGenres)}
							</p>
						)}
					</div>
					<div className="space-y-2">
						<Label htmlFor="price">Price</Label>
						<Input
							id="price"
							value={form.price}
							onChange={(event) => updateField("price", event.target.value)}
							placeholder="Free, €15, €28 - €35.84"
							required
							disabled={isFormDisabled}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="hostEmail">Host Email</Label>
						<Input
							id="hostEmail"
							type="email"
							value={form.hostEmail}
							onChange={(event) => updateField("hostEmail", event.target.value)}
							placeholder="you@example.com"
							required
							disabled={isFormDisabled}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="proofLink">Proof Link</Label>
						<Input
							id="proofLink"
							type="text"
							value={form.proofLink}
							onChange={(event) => updateField("proofLink", event.target.value)}
							onBlur={normalizeProofLinkField}
							placeholder="Ticket, Instagram, or official event link (https:// optional)"
							autoCapitalize="off"
							autoCorrect="off"
							spellCheck={false}
							required
							disabled={isFormDisabled}
						/>
					</div>
				</div>

				<Dialog open={isGenrePickerOpen} onOpenChange={setIsGenrePickerOpen}>
					<DialogContent
						className="max-h-[88vh] gap-3 sm:max-w-xl"
						showCloseButton={false}
					>
						<DialogHeader>
							<DialogTitle>Choose music genres</DialogTitle>
							<DialogDescription>
								Select one or more genres. Add a missing genre as a suggestion
								for admin review.
							</DialogDescription>
						</DialogHeader>
						<div className="space-y-3">
							<div className="space-y-2">
								<Label htmlFor="genre-search">Search or suggest a genre</Label>
								<div className="flex gap-2">
									<div className="relative min-w-0 flex-1">
										<Input
											id="genre-search"
											value={genreSearchQuery}
											onChange={(event) =>
												setGenreSearchQuery(event.target.value)
											}
											placeholder="Afrobeats, Kompa, Jersey club..."
											autoComplete="off"
											className={genreSearchQuery ? "pr-9" : undefined}
										/>
										{genreSearchQuery && (
											<button
												type="button"
												onClick={() => setGenreSearchQuery("")}
												className="absolute right-1.5 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
												aria-label="Clear genre search"
											>
												<X className="size-3.5" aria-hidden="true" />
											</button>
										)}
									</div>
									<Button
										type="button"
										variant="outline"
										onClick={addSuggestedGenre}
										disabled={!canAddSuggestedGenre}
									>
										Add
									</Button>
								</div>
							</div>
							<div
								id="genre-picker-options"
								className="grid max-h-[42vh] gap-1 overflow-y-auto rounded-lg border border-border bg-background p-2"
							>
								{filteredGenreOptions.map((genre) => {
									const isSelected = selectedGenres.includes(genre.label);
									return (
										<button
											key={genre.key}
											type="button"
											onClick={() => toggleGenre(genre.label)}
											className="flex min-h-9 items-center gap-2 rounded-md px-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											aria-pressed={isSelected}
										>
											<span
												className={`h-2.5 w-2.5 shrink-0 rounded-full ${genre.color || "bg-stone-500"}`}
												aria-hidden="true"
											/>
											<span className="min-w-0 flex-1 truncate">
												{genre.label}
											</span>
											{isSelected && (
												<Check className="size-4 shrink-0" aria-hidden="true" />
											)}
										</button>
									);
								})}
								{filteredGenreOptions.length === 0 && (
									<p className="px-2 py-3 text-sm text-muted-foreground">
										No matching saved genres. Add this as a suggestion for
										review.
									</p>
								)}
							</div>
							{selectedGenres.length > 0 && (
								<div className="flex flex-wrap gap-1.5">
									{selectedGenres.map((genre) => (
										<button
											key={genre}
											type="button"
											onClick={() => toggleGenre(genre)}
											className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs hover:bg-muted"
											aria-label={`Remove ${genre}`}
											title={`Remove ${genre}`}
										>
											{genre}
											<X className="size-3" aria-hidden="true" />
										</button>
									))}
								</div>
							)}
						</div>
						<DialogFooter>
							<Button type="button" onClick={() => setIsGenrePickerOpen(false)}>
								Done
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				<div className="rounded-md border bg-background/60 p-3">
					<button
						type="button"
						onClick={() => setShowOptional((value) => !value)}
						className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
						disabled={isFormDisabled}
					>
						{showOptional ? "Hide optional details" : "Add optional details"}
					</button>
					{showOptional && (
						<div className="mt-3 grid gap-4 md:grid-cols-2">
							<div className="space-y-2">
								<Label htmlFor="age">Age</Label>
								<Input
									id="age"
									value={form.age}
									onChange={(event) => updateField("age", event.target.value)}
									placeholder="18+, 21+, All ages"
									disabled={isFormDisabled}
								/>
							</div>
							<div className="space-y-2">
								<Label htmlFor="indoorOutdoor">Indoor/Outdoor</Label>
								<select
									id="indoorOutdoor"
									value={form.indoorOutdoor}
									onChange={(event) =>
										updateField("indoorOutdoor", event.target.value)
									}
									className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
									disabled={isFormDisabled}
								>
									<option value="">Select</option>
									<option value="Indoor">Indoor</option>
									<option value="Outdoor">Outdoor</option>
									<option value="Indoor/Outdoor">Indoor/Outdoor</option>
								</select>
							</div>
							<div className="space-y-2">
								<Label htmlFor="arrondissement">Arrondissement</Label>
								<Input
									id="arrondissement"
									value={form.arrondissement}
									onChange={(event) =>
										updateField("arrondissement", event.target.value)
									}
									placeholder="1-20 or unknown"
									disabled={isFormDisabled}
								/>
							</div>
							<div className="space-y-2 md:col-span-2">
								<Label htmlFor="notes">Notes</Label>
								<Textarea
									id="notes"
									value={form.notes}
									onChange={(event) => updateField("notes", event.target.value)}
									rows={4}
									placeholder="Add context that helps us review your event"
									disabled={isFormDisabled}
								/>
							</div>
						</div>
					)}
				</div>

				<datalist id="previous-event-names">
					{lastSubmittedForm?.eventName && (
						<option value={lastSubmittedForm.eventName} />
					)}
				</datalist>
				<datalist id="previous-locations">
					{lastSubmittedForm?.location && (
						<option value={lastSubmittedForm.location} />
					)}
				</datalist>
				<div className="sr-only" aria-hidden="true">
					<label htmlFor="website">Website</label>
					<input
						id="website"
						tabIndex={-1}
						autoComplete="off"
						value={form.honeypot}
						onChange={(event) => updateField("honeypot", event.target.value)}
						disabled={isFormDisabled}
					/>
				</div>

				{successMessage && (
					<div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
						<p>{successMessage}</p>
						{lastSubmittedForm && (
							<div className="flex flex-wrap gap-2">
								<Button
									type="button"
									size="sm"
									onClick={handleSubmitAnother}
									disabled={isFormDisabled}
								>
									Submit another date/event
								</Button>
								<Button
									type="button"
									size="sm"
									variant="outline"
									onClick={handleStartFresh}
									disabled={isFormDisabled}
								>
									Start fresh
								</Button>
							</div>
						)}
					</div>
				)}
				{errorMessage && (
					<div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
						{errorMessage}
					</div>
				)}

				{!isSubmitted && (
					<div className="flex flex-wrap items-center gap-3">
						<Button type="submit" disabled={isFormDisabled}>
							{isSubmitting ? "Submitting..." : "Submit Event"}
						</Button>
						<Button
							type="button"
							variant="outline"
							onClick={handleClearForm}
							disabled={isFormDisabled || !hasDraftContent(form)}
						>
							Clear form
						</Button>
					</div>
				)}
			</form>
		</div>
	);
}
