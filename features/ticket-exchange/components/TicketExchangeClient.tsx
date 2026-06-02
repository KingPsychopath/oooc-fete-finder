"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	TypeaheadCombobox,
	type TypeaheadComboboxOption,
} from "@/components/ui/typeahead-combobox";
import { useOptionalAuth } from "@/features/auth/auth-context";
import EmailGateModal from "@/features/auth/components/EmailGateModal";
import { EventModalIsland } from "@/features/events/components/EventModalIsland";
import type { Event } from "@/features/events/types";
import {
	createTicketExchangeListing,
	expressTicketExchangeInterest,
	repostTicketExchangeListing,
	reportTicketExchangeListing,
	saveTicketExchangeContactProfile,
	updateTicketExchangeListingStatus,
} from "@/features/ticket-exchange/actions";
import {
	TICKET_EXCHANGE_CONTACT_METHODS,
	TICKET_EXCHANGE_EXPIRY_OPTIONS,
	TICKET_EXCHANGE_INTEREST_LOCK_MINUTES,
	TICKET_EXCHANGE_MAX_ACTIVE_INTERESTS_PER_USER,
	TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT,
	TICKET_EXCHANGE_RULES_VERSION,
	TICKET_EXCHANGE_SCAM_TIPS,
} from "@/features/ticket-exchange/constants";
import type {
	TicketExchangeActionResult,
	TicketExchangeContactMethod,
	TicketExchangeContactProfile,
	TicketExchangeContactSnapshot,
	TicketExchangeListingType,
	TicketExchangeListingView,
	TicketExchangePageData,
	TicketExchangeReportReason,
} from "@/features/ticket-exchange/types";
import { buildTicketExchangeEventPath } from "@/features/ticket-exchange/urls";
import { cn } from "@/lib/utils";
import {
	AlertTriangle,
	AtSign,
	Check,
	Clock,
	ExternalLink,
	Eye,
	Flag,
	Instagram,
	Mail,
	MessageCircle,
	Pause,
	Plus,
	RefreshCw,
	Search,
	ShieldAlert,
	Ticket,
	Trash2,
	UserRound,
	X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type TabKey = "selling" | "looking" | "mine";

type TicketExchangeClientProps = {
	initialData: TicketExchangePageData;
};

type ProfileFormState = {
	displayName: string;
	alternateEmail: string;
	whatsappNumber: string;
	instagramHandle: string;
	xHandle: string;
};

type ListingFormState = {
	eventKey: string;
	listingType: TicketExchangeListingType;
	quantityLabel: string;
	priceLabel: string;
	note: string;
	expiryHours: number;
	contactMethods: TicketExchangeContactMethod[];
};

type PendingAgreementIntent =
	| { kind: "create"; listingType: TicketExchangeListingType }
	| { kind: "interest"; listing: TicketExchangeListingView }
	| null;

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const TICKET_EXCHANGE_AGREEMENT_STORAGE_KEY = `oooc_ticket_exchange_agreement_${TICKET_EXCHANGE_RULES_VERSION}`;
const WEEKDAY_SHORT_LABELS = {
	monday: "Mon",
	tuesday: "Tue",
	wednesday: "Wed",
	thursday: "Thu",
	friday: "Fri",
	saturday: "Sat",
	sunday: "Sun",
	tbc: "TBC",
} as const;
const MONTH_SHORT_LABELS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
] as const;

const createProfileFormState = (
	profile: TicketExchangeContactProfile | null,
): ProfileFormState => ({
	displayName: profile?.displayName ?? "",
	alternateEmail: profile?.alternateEmail ?? "",
	whatsappNumber: profile?.whatsappNumber ?? "",
	instagramHandle: profile?.instagramHandle ?? "",
	xHandle: profile?.xHandle ?? "",
});

const createListingFormState = (
	selectedEventKey: string | null,
	type: TicketExchangeListingType = "selling",
	contactMethods: TicketExchangeContactMethod[] = ["email"],
): ListingFormState => ({
	eventKey: selectedEventKey ?? "",
	listingType: type,
	quantityLabel: "",
	priceLabel: "",
	note: "",
	expiryHours: 3,
	contactMethods,
});

const methodLabels: Record<TicketExchangeContactMethod, string> = {
	email: "Email",
	whatsapp: "WhatsApp",
	instagram: "Instagram",
	x: "Twitter",
};

const reportReasonLabels: Record<TicketExchangeReportReason, string> = {
	scam: "Scam suspected",
	wrong_event: "Wrong event",
	misleading_price: "Misleading price",
	abusive_contact: "Abusive contact",
	spam: "Spam or duplicate",
	other: "Other",
};

const getRelativeTime = (iso: string): string => {
	const ms = new Date(iso).getTime();
	if (!Number.isFinite(ms)) return "soon";
	const diffMs = ms - Date.now();
	const absMinutes = Math.max(1, Math.round(Math.abs(diffMs) / 60000));
	if (absMinutes < 60) {
		return diffMs >= 0 ? `in ${absMinutes}m` : `${absMinutes}m ago`;
	}
	const hours = Math.round(absMinutes / 60);
	return diffMs >= 0 ? `in ${hours}h` : `${hours}h ago`;
};

const formatEventPickerDate = (date: string): string => {
	const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return "";
	const monthIndex = Number.parseInt(match[2], 10) - 1;
	const day = Number.parseInt(match[3], 10);
	if (!MONTH_SHORT_LABELS[monthIndex] || !Number.isFinite(day)) return "";
	return `${day} ${MONTH_SHORT_LABELS[monthIndex]}`;
};

const formatEventPickerDay = (day: string): string =>
	WEEKDAY_SHORT_LABELS[day as keyof typeof WEEKDAY_SHORT_LABELS] ??
	day.slice(0, 1).toUpperCase() + day.slice(1);

const hasContact = (
	profile: TicketExchangeContactProfile | null,
	method: TicketExchangeContactMethod,
): boolean => {
	if (!profile) return false;
	if (method === "email")
		return Boolean(profile.alternateEmail || profile.accountEmail);
	if (method === "whatsapp") return Boolean(profile.whatsappNumber);
	if (method === "instagram") return Boolean(profile.instagramHandle);
	return Boolean(profile.xHandle);
};

const getAvailableContactMethodCount = (
	profile: TicketExchangeContactProfile | null,
): number =>
	TICKET_EXCHANGE_CONTACT_METHODS.filter((method) =>
		hasContact(profile, method),
	).length;

const getDraftContactMethodCount = (
	accountEmail: string | null,
	form: ProfileFormState,
): number =>
	[
		Boolean(form.alternateEmail || accountEmail),
		Boolean(form.whatsappNumber),
		Boolean(form.instagramHandle),
		Boolean(form.xHandle),
	].filter(Boolean).length;

const getDefaultContactMethods = (
	profile: TicketExchangeContactProfile | null,
): TicketExchangeContactMethod[] =>
	TICKET_EXCHANGE_CONTACT_METHODS.filter((method) =>
		hasContact(profile, method),
	).slice(0, TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT);

const createDraftContactProfile = (
	profile: TicketExchangeContactProfile | null,
	accountEmail: string | null,
	form: ProfileFormState,
): TicketExchangeContactProfile | null => {
	if (!profile && !accountEmail) return null;
	const now = new Date().toISOString();
	return {
		userId: profile?.userId ?? "",
		accountEmail: profile?.accountEmail ?? accountEmail ?? "",
		displayName: form.displayName,
		alternateEmail: form.alternateEmail,
		whatsappNumber: form.whatsappNumber,
		instagramHandle: form.instagramHandle,
		xHandle: form.xHandle,
		rulesAcceptedAt: profile?.rulesAcceptedAt ?? null,
		rulesVersion: profile?.rulesVersion ?? null,
		createdAt: profile?.createdAt ?? now,
		updatedAt: profile?.updatedAt ?? now,
	};
};

const hasUnsavedContactDraft = (
	profile: TicketExchangeContactProfile | null,
	form: ProfileFormState,
): boolean => {
	const saved = createProfileFormState(profile);
	return (
		saved.displayName !== form.displayName ||
		saved.alternateEmail !== form.alternateEmail ||
		saved.whatsappNumber !== form.whatsappNumber ||
		saved.instagramHandle !== form.instagramHandle ||
		saved.xHandle !== form.xHandle
	);
};

const hasAcceptedCurrentAgreement = (
	profile: TicketExchangeContactProfile | null,
): boolean =>
	Boolean(
		profile?.rulesAcceptedAt &&
			profile.rulesVersion === TICKET_EXCHANGE_RULES_VERSION,
	);

const toggleMethod = (
	methods: TicketExchangeContactMethod[],
	method: TicketExchangeContactMethod,
): TicketExchangeContactMethod[] =>
	methods.includes(method)
		? methods.filter((item) => item !== method)
		: [...methods, method];

const visibleContactEntries = (snapshot?: TicketExchangeContactSnapshot) => {
	if (!snapshot) return [];
	return [
		{ label: "Email", value: snapshot.email, href: `mailto:${snapshot.email}` },
		{
			label: "WhatsApp",
			value: snapshot.whatsapp,
			href: snapshot.whatsapp
				? `https://wa.me/${snapshot.whatsapp.replace(/[^0-9]/g, "")}`
				: "",
		},
		{
			label: "Instagram",
			value: snapshot.instagram
				? `@${snapshot.instagram.replace(/^@+/, "")}`
				: "",
			href: snapshot.instagram
				? `https://instagram.com/${snapshot.instagram.replace(/^@+/, "")}`
				: "",
		},
		{
			label: "Twitter",
			value: snapshot.x ? `@${snapshot.x.replace(/^@+/, "")}` : "",
			href: snapshot.x
				? `https://twitter.com/${snapshot.x.replace(/^@+/, "")}`
				: "",
		},
	].filter((entry) => entry.value);
};

const formatListingQuantityTitle = (
	listing: TicketExchangeListingView,
): string => {
	const raw = listing.quantityLabel.trim();
	const numeric = raw.match(/^\d+$/);
	if (numeric) {
		const count = Number.parseInt(raw, 10);
		const unit = count === 1 ? "ticket" : "tickets";
		return listing.listingType === "selling"
			? `${count} ${unit} available`
			: `Looking for ${count} ${unit}`;
	}
	if (
		listing.listingType === "looking" &&
		!raw.toLowerCase().startsWith("looking")
	) {
		return `Looking for ${raw}`;
	}
	return raw;
};

const contactIconFor = (label: string) => {
	if (label === "Email") return <Mail className="h-3.5 w-3.5" />;
	if (label === "WhatsApp") return <MessageCircle className="h-3.5 w-3.5" />;
	if (label === "Instagram") return <Instagram className="h-3.5 w-3.5" />;
	if (label === "X") return <AtSign className="h-3.5 w-3.5" />;
	return <ExternalLink className="h-3.5 w-3.5" />;
};

export function TicketExchangeClient({
	initialData,
}: TicketExchangeClientProps) {
	const router = useRouter();
	const auth = useOptionalAuth();
	const [data, setData] = useState(initialData);
	const [selectedEventKey, setSelectedEventKey] = useState<string | null>(
		initialData.selectedEventKey,
	);
	const [activeTab, setActiveTab] = useState<TabKey>("selling");
	const [isLoginOpen, setIsLoginOpen] = useState(false);
	const [isProfileOpen, setIsProfileOpen] = useState(!initialData.profile);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [isAgreementOpen, setIsAgreementOpen] = useState(false);
	const [agreementChecked, setAgreementChecked] = useState(false);
	const [pendingAgreementIntent, setPendingAgreementIntent] =
		useState<PendingAgreementIntent>(null);
	const [profileForm, setProfileForm] = useState(() =>
		createProfileFormState(initialData.profile),
	);
	const [listingForm, setListingForm] = useState(() =>
		createListingFormState(initialData.selectedEventKey),
	);
	const [pendingMessage, setPendingMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isSavingProfile, setIsSavingProfile] = useState(false);
	const [isCreatingListing, setIsCreatingListing] = useState(false);
	const createListingInFlightRef = useRef(false);
	const [isAcceptingAgreement, setIsAcceptingAgreement] = useState(false);
	const [reportListingId, setReportListingId] = useState<string | null>(null);
	const [reportReason, setReportReason] =
		useState<TicketExchangeReportReason>("scam");
	const [reportDetails, setReportDetails] = useState("");
	const [isReporting, setIsReporting] = useState(false);
	const [repostListingId, setRepostListingId] = useState<string | null>(null);
	const [repostQuantity, setRepostQuantity] = useState("");
	const [isReposting, setIsReposting] = useState(false);
	const [interestListingId, setInterestListingId] = useState<string | null>(
		null,
	);
	const [statusListingId, setStatusListingId] = useState<string | null>(null);
	const [selectedModalEvent, setSelectedModalEvent] = useState<Event | null>(
		null,
	);
	const [isEventUpdateOpen, setIsEventUpdateOpen] = useState(false);

	useEffect(() => {
		if (!hasAcceptedCurrentAgreement(data.profile)) return;
		window.localStorage.setItem(
			TICKET_EXCHANGE_AGREEMENT_STORAGE_KEY,
			JSON.stringify({
				version: TICKET_EXCHANGE_RULES_VERSION,
				acceptedAt: data.profile?.rulesAcceptedAt,
			}),
		);
	}, [data.profile]);

	const eventByKey = useMemo(
		() => new Map(data.events.map((event) => [event.eventKey, event])),
		[data.events],
	);
	const selectedEvent = selectedEventKey
		? eventByKey.get(selectedEventKey ?? "")
		: null;
	const selectedModalSeriesEvents = useMemo(() => {
		if (!selectedModalEvent?.seriesKey) return [];
		return data.events
			.filter((event) => event.seriesKey === selectedModalEvent.seriesKey)
			.sort((left, right) => left.date.localeCompare(right.date));
	}, [data.events, selectedModalEvent?.seriesKey]);
	const currentTicketPath = selectedEvent
		? `${basePath}${buildTicketExchangeEventPath(selectedEvent)}`
		: `${basePath}/tickets`;
	const termsHref = `${basePath}/terms?returnTo=${encodeURIComponent(currentTicketPath)}`;
	const draftContactMethodCount = getDraftContactMethodCount(
		data.userEmail,
		profileForm,
	);
	const draftProfile = useMemo(
		() => createDraftContactProfile(data.profile, data.userEmail, profileForm),
		[data.profile, data.userEmail, profileForm],
	);
	const summaryByEventKey = useMemo(
		() => new Map(data.summaries.map((summary) => [summary.eventKey, summary])),
		[data.summaries],
	);
	const eventOptions = useMemo<TypeaheadComboboxOption[]>(
		() =>
			data.events.map((event) => ({
				value: event.eventKey,
				label: event.name,
				description: [
					formatEventPickerDate(event.date),
					event.time,
					event.location,
				]
					.filter(Boolean)
					.join(" · "),
				rightLabel: formatEventPickerDay(event.day),
			})),
		[data.events],
	);
	const selectedEventOption =
		eventOptions.find((option) => option.value === listingForm.eventKey) ??
		null;
	const visibleListings = useMemo(() => {
		const listingsForEvent = selectedEventKey
			? data.listings.filter((listing) => listing.eventKey === selectedEventKey)
			: data.listings;
		if (activeTab === "mine") {
			return listingsForEvent.filter(
				(listing) => listing.isOwner || listing.myInterest,
			);
		}
		return listingsForEvent.filter(
			(listing) =>
				listing.listingType === activeTab &&
				listing.effectiveStatus !== "expired" &&
				listing.effectiveStatus !== "resolved" &&
				listing.effectiveStatus !== "removed",
		);
	}, [activeTab, data.listings, selectedEventKey]);

	const applyResult = (result: TicketExchangeActionResult, success: string) => {
		if (!result.success) {
			setErrorMessage(result.error ?? "Something went wrong.");
			return;
		}
		if (result.data) {
			setData(result.data);
			setSelectedEventKey(result.data.selectedEventKey);
			setProfileForm(createProfileFormState(result.data.profile));
		}
		setErrorMessage(null);
		setPendingMessage(success);
		router.refresh();
	};

	const applyDataFromResult = (result: TicketExchangeActionResult) => {
		if (!result.success || !result.data) return;
		setData(result.data);
		setSelectedEventKey(result.data.selectedEventKey);
		setProfileForm(createProfileFormState(result.data.profile));
	};

	const saveContactDraftIfNeeded =
		async (): Promise<TicketExchangeContactProfile | null> => {
			if (!hasUnsavedContactDraft(data.profile, profileForm)) {
				return data.profile;
			}
			setPendingMessage("Saving contact details...");
			const result = await saveTicketExchangeContactProfile({
				...profileForm,
				acceptRules: false,
				selectedEventKey,
			});
			if (!result.success) {
				setErrorMessage(result.error ?? "Unable to save contact details.");
				return null;
			}
			applyDataFromResult(result);
			return result.data?.profile ?? data.profile;
		};

	const requireLogin = () => {
		if (data.isAuthenticated || auth.isAuthenticated) return true;
		setIsLoginOpen(true);
		return false;
	};

	const openAgreement = (intent: PendingAgreementIntent) => {
		setPendingAgreementIntent(intent);
		setAgreementChecked(false);
		setIsAgreementOpen(true);
		setIsCreateOpen(false);
	};

	const closeAgreement = () => {
		setIsAgreementOpen(false);
		setPendingAgreementIntent(null);
		setAgreementChecked(false);
	};

	const ensureContactDetailsReady = (
		profile: TicketExchangeContactProfile | null,
	): boolean => {
		if (
			getAvailableContactMethodCount(profile) >=
			TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT
		) {
			return true;
		}
		setPendingMessage(
			`Your email counts as one contact method. Add at least one backup method before using Ticket Exchange.`,
		);
		setIsProfileOpen(true);
		setIsCreateOpen(false);
		return false;
	};

	const startCreateListing = (
		type: TicketExchangeListingType,
		profile: TicketExchangeContactProfile | null,
	) => {
		setListingForm(
			createListingFormState(
				selectedEventKey,
				type,
				getDefaultContactMethods(profile),
			),
		);
		setIsCreateOpen(true);
	};

	const submitInterest = async (
		listing: TicketExchangeListingView,
		profile: TicketExchangeContactProfile | null,
	) => {
		if (interestListingId) return;
		setInterestListingId(listing.id);
		setPendingMessage("Sharing contact details...");
		try {
			const result = await expressTicketExchangeInterest({
				listingId: listing.id,
				selectedEventKey,
				contactMethods: getDefaultContactMethods(profile),
			});
			applyResult(result, "Contact details unlocked.");
		} finally {
			setInterestListingId(null);
		}
	};

	const selectEvent = (eventKey: string | null) => {
		const scrollY = window.scrollY;
		const boardTop =
			document.getElementById("ticket-exchange-board")?.getBoundingClientRect()
				.top ?? 0;
		const boardY = Math.max(0, window.scrollY + boardTop - 12);
		const isMobile = window.matchMedia("(max-width: 1023px)").matches;
		const targetY = isMobile ? Math.max(scrollY, boardY) : scrollY;
		setSelectedEventKey(eventKey);
		const nextEvent = eventKey ? eventByKey.get(eventKey) : null;
		const nextPath = nextEvent
			? `${basePath}${buildTicketExchangeEventPath(nextEvent)}`
			: `${basePath}/tickets`;
		window.history.pushState(null, "", nextPath);
		const restoreScroll = () => {
			window.scrollTo({ top: targetY, behavior: "auto" });
		};
		window.requestAnimationFrame(restoreScroll);
		window.setTimeout(restoreScroll, 0);
		window.setTimeout(restoreScroll, 80);
	};

	const openCreateListing = (type: TicketExchangeListingType = "selling") => {
		if (!requireLogin()) return;
		if (!hasAcceptedCurrentAgreement(data.profile)) {
			openAgreement({ kind: "create", listingType: type });
			return;
		}
		if (!ensureContactDetailsReady(draftProfile)) return;
		startCreateListing(type, draftProfile);
	};

	const openListingEvent = (listing: TicketExchangeListingView) => {
		const event = eventByKey.get(listing.eventKey);
		if (!event) {
			setErrorMessage("Could not open event details for this listing.");
			return;
		}
		setErrorMessage(null);
		setSelectedModalEvent(event);
	};

	const handleProfileSubmit = async (
		event: React.FormEvent<HTMLFormElement>,
	) => {
		event.preventDefault();
		if (isSavingProfile) return;
		if (!requireLogin()) return;
		setIsSavingProfile(true);
		setPendingMessage("Saving contact profile...");
		try {
			const result = await saveTicketExchangeContactProfile({
				...profileForm,
				acceptRules: false,
				selectedEventKey,
			});
			applyResult(result, "Contact profile saved.");
			if (result.success) setIsProfileOpen(false);
		} finally {
			setIsSavingProfile(false);
		}
	};

	const handleCreateListing = async (
		event: React.FormEvent<HTMLFormElement>,
	) => {
		event.preventDefault();
		if (createListingInFlightRef.current || isCreatingListing) return;
		if (!requireLogin()) return;
		if (
			listingForm.listingType === "selling" &&
			!listingForm.priceLabel.trim()
		) {
			setErrorMessage("Add the ticket price before posting a selling listing.");
			return;
		}
		createListingInFlightRef.current = true;
		setIsCreatingListing(true);
		setPendingMessage("Posting listing...");
		try {
			const savedProfile = await saveContactDraftIfNeeded();
			if (!savedProfile) return;
			if (!ensureContactDetailsReady(savedProfile)) return;
			setPendingMessage("Posting listing...");
			const result = await createTicketExchangeListing(listingForm);
			applyResult(result, "Listing posted.");
			if (result.success) {
				setIsCreateOpen(false);
				setListingForm(
					createListingFormState(
						selectedEventKey,
						listingForm.listingType,
						getDefaultContactMethods(result.data?.profile ?? data.profile),
					),
				);
			}
		} finally {
			createListingInFlightRef.current = false;
			setIsCreatingListing(false);
		}
	};

	const handleInterest = async (listing: TicketExchangeListingView) => {
		if (!requireLogin()) return;
		if (!hasAcceptedCurrentAgreement(data.profile)) {
			openAgreement({ kind: "interest", listing });
			return;
		}
		if (!ensureContactDetailsReady(draftProfile)) return;
		const savedProfile = await saveContactDraftIfNeeded();
		if (!savedProfile) return;
		if (!ensureContactDetailsReady(savedProfile)) return;
		await submitInterest(listing, savedProfile);
	};

	const handleAgreementAccept = async () => {
		if (isAcceptingAgreement) return;
		if (!requireLogin() || !agreementChecked) return;
		setIsAcceptingAgreement(true);
		setPendingMessage("Saving Ticket Exchange agreement...");
		try {
			const result = await saveTicketExchangeContactProfile({
				...profileForm,
				acceptRules: true,
				selectedEventKey,
			});
			applyResult(result, "Ticket Exchange agreement accepted.");
			if (!result.success) return;
			const nextProfile = result.data?.profile ?? data.profile;
			setIsAgreementOpen(false);
			setPendingAgreementIntent(null);
			setAgreementChecked(false);
			if (!ensureContactDetailsReady(nextProfile)) return;
			if (pendingAgreementIntent?.kind === "create") {
				startCreateListing(pendingAgreementIntent.listingType, nextProfile);
				return;
			}
			if (pendingAgreementIntent?.kind === "interest") {
				await submitInterest(pendingAgreementIntent.listing, nextProfile);
			}
		} finally {
			setIsAcceptingAgreement(false);
		}
	};

	const handleStatus = async (
		listing: TicketExchangeListingView,
		status: "active" | "paused" | "resolved" | "removed",
	) => {
		if (statusListingId) return;
		setStatusListingId(listing.id);
		setPendingMessage("Updating listing...");
		try {
			const result = await updateTicketExchangeListingStatus({
				listingId: listing.id,
				status,
				selectedEventKey,
			});
			applyResult(result, "Listing updated.");
		} finally {
			setStatusListingId(null);
		}
	};

	const handleReport = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isReporting) return;
		if (!reportListingId || !requireLogin()) return;
		setIsReporting(true);
		try {
			const result = await reportTicketExchangeListing({
				listingId: reportListingId,
				reason: reportReason,
				details: reportDetails,
				selectedEventKey,
			});
			applyResult(result, "Report sent.");
			if (result.success) {
				setReportListingId(null);
				setReportDetails("");
			}
		} finally {
			setIsReporting(false);
		}
	};

	const handleRepost = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isReposting) return;
		if (!repostListingId) return;
		setIsReposting(true);
		try {
			const result = await repostTicketExchangeListing({
				listingId: repostListingId,
				quantityLabel: repostQuantity,
				expiryHours: 3,
				selectedEventKey,
			});
			applyResult(result, "Fresh listing posted.");
			if (result.success) {
				setRepostListingId(null);
				setRepostQuantity("");
			}
		} finally {
			setIsReposting(false);
		}
	};

	return (
		<div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-4 sm:gap-6 sm:px-6 sm:py-6 lg:px-8">
			<section className="order-1 rounded-xl border border-border/70 bg-card/78 p-3 shadow-sm sm:rounded-2xl sm:p-5">
				<div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
					<div className="max-w-3xl space-y-2.5 sm:space-y-3">
						<div className="flex flex-wrap items-center gap-2">
							<Badge className="border border-amber-500/25 bg-amber-500/10 text-amber-900 shadow-none dark:text-amber-100">
								<Ticket className="mr-1 h-3 w-3" />
								Ticket Exchange
							</Badge>
							{selectedEvent && (
								<Badge variant="outline">{selectedEvent.name}</Badge>
							)}
						</div>
						<div>
							<h1 className="text-xl font-semibold tracking-normal text-foreground sm:text-3xl">
								Find people trading tickets
							</h1>
							<p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground sm:mt-2 sm:leading-6">
								Pick an event, say whether you are selling or looking, then
								share the contact details you are comfortable with.
							</p>
						</div>
						<div className="rounded-lg bg-background/50 p-2 text-xs leading-5 text-muted-foreground">
							<ShieldAlert className="mr-1 inline h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
							OOOC only connects people. We do not sell, verify, hold, or
							guarantee tickets.{" "}
							<Link href={termsHref} className="underline underline-offset-4">
								Read the rules
							</Link>
							.
						</div>
					</div>
					<div className="hidden flex-wrap gap-2 lg:flex lg:justify-end">
						<Button
							type="button"
							variant={isProfileOpen ? "secondary" : "outline"}
							onClick={() => {
								if (requireLogin()) setIsProfileOpen((current) => !current);
							}}
						>
							<UserRound className="h-4 w-4" />
							{isProfileOpen ? "Hide contacts" : "Contact details"}
						</Button>
						<Button type="button" onClick={() => openCreateListing("selling")}>
							<Plus className="h-4 w-4" />
							Post ticket
						</Button>
					</div>
				</div>
			</section>

			{!data.supported && (
				<div className="order-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100">
					Ticket Exchange needs database storage before listings can go live.
				</div>
			)}

			{(pendingMessage || errorMessage) && (
				<div
					className={cn(
						"order-2 rounded-xl border p-3 text-sm",
						errorMessage
							? "border-destructive/30 bg-destructive/10 text-destructive"
							: "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100",
					)}
				>
					{errorMessage ?? pendingMessage}
				</div>
			)}

			{isProfileOpen && (
				<form
					onSubmit={handleProfileSubmit}
					className="order-4 rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm sm:p-4 lg:order-3"
				>
					<div className="mb-4 flex items-start justify-between gap-3">
						<div className="flex min-w-0 gap-3">
							<div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/70">
								<UserRound className="h-4 w-4 text-muted-foreground" />
							</div>
							<div className="min-w-0">
								<h2 className="text-base font-semibold">
									Your exchange contacts
								</h2>
								<p className="mt-0.5 text-sm leading-5 text-muted-foreground">
									Shown only after someone registers interest or you unlock a
									listing.
								</p>
							</div>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => setIsProfileOpen(false)}
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
					<div className="grid gap-3 md:grid-cols-2">
						<Field label="Display name">
							<Input
								value={profileForm.displayName}
								onChange={(event) =>
									setProfileForm((current) => ({
										...current,
										displayName: event.target.value,
									}))
								}
								placeholder="Alex"
							/>
						</Field>
						<Field label="Email">
							<Input value={data.userEmail ?? ""} disabled />
						</Field>
						<Field label="Exchange email override">
							<Input
								type="email"
								value={profileForm.alternateEmail}
								onChange={(event) =>
									setProfileForm((current) => ({
										...current,
										alternateEmail: event.target.value,
									}))
								}
								placeholder="Use a different email"
							/>
						</Field>
						<Field label="WhatsApp number">
							<Input
								type="tel"
								inputMode="tel"
								value={profileForm.whatsappNumber}
								onChange={(event) =>
									setProfileForm((current) => ({
										...current,
										whatsappNumber: event.target.value,
									}))
								}
								placeholder="+44 7123 456789"
							/>
						</Field>
						<Field label="Instagram">
							<Input
								autoCapitalize="none"
								autoCorrect="off"
								value={profileForm.instagramHandle}
								onChange={(event) =>
									setProfileForm((current) => ({
										...current,
										instagramHandle: event.target.value,
									}))
								}
								placeholder="handle"
							/>
						</Field>
						<Field label="Twitter">
							<Input
								autoCapitalize="none"
								autoCorrect="off"
								value={profileForm.xHandle}
								onChange={(event) =>
									setProfileForm((current) => ({
										...current,
										xHandle: event.target.value,
									}))
								}
								placeholder="handle"
							/>
						</Field>
					</div>
					<p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-xs leading-5 text-muted-foreground">
						<span
							className={cn(
								"h-1.5 w-1.5 rounded-full",
								draftContactMethodCount >=
									TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT
									? "bg-emerald-500"
									: "bg-amber-500",
							)}
						/>
						<span className="font-medium text-foreground">
							{draftContactMethodCount}/
							{TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT} methods ready.
						</span>
						<span>Email plus one backup is required.</span>
					</p>
					<div className="mt-3 flex flex-col gap-2 border-t border-border/70 px-1 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
						<div className="flex min-w-0 items-center gap-2">
							<span
								className={cn(
									"flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
									hasAcceptedCurrentAgreement(data.profile)
										? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
										: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
								)}
							>
								<Check className="h-3 w-3" />
							</span>
							<div className="min-w-0">
								<p className="font-medium">
									{hasAcceptedCurrentAgreement(data.profile)
										? "Safety agreement accepted"
										: "Safety agreement required"}
								</p>
								<p className="text-xs text-muted-foreground">
									Required before listing or unlocking contact.
								</p>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Link
								href={termsHref}
								className="text-xs underline underline-offset-4"
							>
								Read terms
							</Link>
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => openAgreement(null)}
							>
								{hasAcceptedCurrentAgreement(data.profile)
									? "Review"
									: "Accept"}
							</Button>
						</div>
					</div>
					<div className="mt-3 flex justify-end">
						<Button
							type="submit"
							className="w-full sm:w-auto"
							disabled={isSavingProfile}
						>
							<Check className="h-4 w-4" />
							{isSavingProfile ? "Saving..." : "Save contacts"}
						</Button>
					</div>
				</form>
			)}

			{isCreateOpen && (
				<form
					onSubmit={handleCreateListing}
					className="order-4 rounded-xl border border-border/70 bg-card/72 p-4 sm:p-5 lg:order-3"
				>
					<div className="mb-4 flex items-start justify-between gap-3">
						<div>
							<h2 className="text-lg font-semibold">Post a ticket listing</h2>
							<p className="text-sm text-muted-foreground">
								No reservations here. People message you directly to confirm.
							</p>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={() => setIsCreateOpen(false)}
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
					<div className="grid gap-3 lg:grid-cols-2">
						<Field label="What are you doing?">
							<div className="grid grid-cols-2 gap-2">
								{(["selling", "looking"] as const).map((type) => (
									<button
										key={type}
										type="button"
										disabled={isCreatingListing}
										onClick={() =>
											setListingForm((current) => ({
												...current,
												listingType: type,
											}))
										}
										className={cn(
											"rounded-lg border px-3 py-2 text-sm font-medium",
											listingForm.listingType === type
												? "border-primary bg-primary text-primary-foreground"
												: "border-border bg-background/60",
										)}
									>
										{type === "selling" ? "Selling" : "Looking"}
									</button>
								))}
							</div>
						</Field>
						<Field label="Event">
							<TypeaheadCombobox
								options={eventOptions}
								value={selectedEventOption?.label ?? ""}
								placeholder="Search event name"
								emptyMessage="No matching events"
								maxVisibleOptions={7}
								onInputChange={(value) => {
									if (
										selectedEventOption &&
										value !== selectedEventOption.label
									) {
										setListingForm((current) => ({
											...current,
											eventKey: "",
										}));
									}
								}}
								onSelect={(option) =>
									setListingForm((current) => ({
										...current,
										eventKey: option.value,
									}))
								}
								leadingIcon={<Ticket className="h-4 w-4" />}
							/>
						</Field>
						<Field label="Quantity">
							<Input
								value={listingForm.quantityLabel}
								onChange={(event) =>
									setListingForm((current) => ({
										...current,
										quantityLabel: event.target.value,
									}))
								}
								placeholder={
									listingForm.listingType === "selling"
										? "2 tickets"
										: "Looking for 1 ticket"
								}
								required
							/>
						</Field>
						<Field
							label={listingForm.listingType === "selling" ? "Price" : "Budget"}
						>
							<Input
								value={listingForm.priceLabel}
								onChange={(event) =>
									setListingForm((current) => ({
										...current,
										priceLabel: event.target.value,
									}))
								}
								placeholder={
									listingForm.listingType === "selling"
										? "Required - £35 each / face value"
										: "Optional - £35 / face value"
								}
								required={listingForm.listingType === "selling"}
							/>
						</Field>
						<Field label="Expires after">
							<select
								value={listingForm.expiryHours}
								onChange={(event) =>
									setListingForm((current) => ({
										...current,
										expiryHours: Number(event.target.value),
									}))
								}
								className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
							>
								{TICKET_EXCHANGE_EXPIRY_OPTIONS.map((option) => (
									<option key={option.hours} value={option.hours}>
										{option.label}
									</option>
								))}
							</select>
						</Field>
						<Field label="Contact people can see">
							<ContactMethodPicker
								profile={draftProfile}
								value={listingForm.contactMethods}
								onChange={(contactMethods) =>
									setListingForm((current) => ({ ...current, contactMethods }))
								}
							/>
						</Field>
						<div className="lg:col-span-2">
							<Field label="Note">
								<Textarea
									value={listingForm.note}
									onChange={(event) =>
										setListingForm((current) => ({
											...current,
											note: event.target.value,
										}))
									}
									placeholder="Use official transfer where possible. Availability may change."
								/>
							</Field>
						</div>
					</div>
					<div className="mt-4 flex justify-end">
						<Button type="submit" disabled={isCreatingListing}>
							<Ticket className="h-4 w-4" />
							{isCreatingListing ? "Posting..." : "Post listing"}
						</Button>
					</div>
				</form>
			)}

			<section className="order-3 rounded-xl border border-border/70 bg-card/72 p-3 lg:hidden">
				<div className="mb-3 flex items-start justify-between gap-3">
					<div className="min-w-0 flex-1">
						<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
							Viewing
						</p>
						<p className="mt-0.5 truncate text-sm font-semibold">
							{selectedEvent?.name ?? "All tickets"}
						</p>
						{selectedEventKey && (
							<button
								type="button"
								onClick={() => selectEvent(null)}
								className="mt-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
							>
								Show all tickets
							</button>
						)}
					</div>
					<Badge variant="outline" className="shrink-0 text-[10px]">
						{visibleListings.length} shown
					</Badge>
				</div>
				<div className="grid gap-2">
					<TypeaheadCombobox
						options={eventOptions}
						placeholder="Filter by event"
						emptyMessage="No matching events"
						maxVisibleOptions={6}
						clearOnSelect
						leadingIcon={<Search className="h-4 w-4" />}
						className="relative z-50"
						onSelect={(option) => selectEvent(option.value)}
					/>
					<Button
						type="button"
						variant={isProfileOpen ? "secondary" : "outline"}
						className="justify-start"
						onClick={() => {
							if (requireLogin()) setIsProfileOpen((current) => !current);
						}}
					>
						<UserRound className="h-4 w-4" />
						{isProfileOpen ? "Hide contacts" : "Contact details"}
					</Button>
					<p className="px-1 text-xs leading-5 text-muted-foreground">
						Email counts as one contact method. Add one backup method before
						listing or unlocking contact.
					</p>
				</div>
			</section>

			<div
				id="ticket-exchange-board"
				className="order-5 grid gap-4 lg:grid-cols-[17rem_1fr]"
			>
				<aside className="hidden space-y-3 lg:sticky lg:top-[9rem] lg:block lg:self-start">
					<div className="rounded-2xl border border-border/70 bg-card/72 p-3">
						<p className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
							Events
						</p>
						<Link
							href={`${basePath}/tickets`}
							className={cn(
								"mb-1 flex items-center justify-between rounded-lg px-2 py-2 text-sm",
								!selectedEventKey
									? "bg-primary text-primary-foreground"
									: "hover:bg-muted",
							)}
							onClick={(clickEvent) => {
								clickEvent.preventDefault();
								selectEvent(null);
							}}
						>
							<span>All tickets</span>
						</Link>
						<TypeaheadCombobox
							options={eventOptions}
							placeholder="Filter by event"
							emptyMessage="No matching events"
							maxVisibleOptions={6}
							clearOnSelect
							leadingIcon={<Search className="h-4 w-4" />}
							className="mb-2"
							onSelect={(option) => {
								selectEvent(option.value);
							}}
						/>
						<div className="max-h-[34rem] space-y-1 overflow-y-auto">
							{data.events.map((event) => {
								const summary = summaryByEventKey.get(event.eventKey);
								const activeCount =
									(summary?.sellingCount ?? 0) + (summary?.lookingCount ?? 0);
								return (
									<Link
										key={event.eventKey}
										href={`${basePath}${buildTicketExchangeEventPath(event)}`}
										className={cn(
											"block rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted",
											selectedEventKey === event.eventKey &&
												"bg-primary text-primary-foreground hover:bg-primary",
										)}
										onClick={(clickEvent) => {
											clickEvent.preventDefault();
											selectEvent(event.eventKey);
										}}
									>
										<span className="line-clamp-1 font-medium">
											{event.name}
										</span>
										<span className="mt-0.5 block text-xs opacity-75">
											{activeCount > 0
												? `${summary?.sellingCount ?? 0} selling · ${summary?.lookingCount ?? 0} looking`
												: "No active listings"}
										</span>
									</Link>
								);
							})}
						</div>
					</div>
					<div className="rounded-2xl border border-border/70 bg-card/72 p-3">
						<p className="mb-2 text-sm font-semibold">Scam checks</p>
						<ul className="space-y-1.5 text-xs text-muted-foreground">
							{TICKET_EXCHANGE_SCAM_TIPS.map((tip) => (
								<li key={tip} className="flex gap-2">
									<AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
									<span>{tip}</span>
								</li>
							))}
						</ul>
					</div>
				</aside>

				<section className="min-w-0 space-y-4">
					<div className="sticky top-2 z-30 rounded-xl border border-border/70 bg-card/95 p-1.5 shadow-sm backdrop-blur sm:rounded-2xl sm:p-2 lg:static lg:bg-card/72 lg:shadow-none">
						<div className="grid grid-cols-[1fr_1fr_1.25fr_auto] items-center gap-1.5 sm:flex sm:gap-2">
							<div className="contents sm:flex sm:min-w-0 sm:flex-1 sm:flex-wrap sm:gap-2">
								<TabButton
									active={activeTab === "selling"}
									onClick={() => setActiveTab("selling")}
								>
									Selling
								</TabButton>
								<TabButton
									active={activeTab === "looking"}
									onClick={() => setActiveTab("looking")}
								>
									Looking
								</TabButton>
								<TabButton
									active={activeTab === "mine"}
									onClick={() => setActiveTab("mine")}
								>
									My activity
								</TabButton>
							</div>
							<Button
								type="button"
								size="sm"
								onClick={() =>
									openCreateListing(
										activeTab === "looking" ? "looking" : "selling",
									)
								}
								className="h-9 shrink-0 px-2.5 text-xs sm:px-3 sm:text-sm"
							>
								<Plus className="h-3.5 w-3.5" />
								Post
							</Button>
						</div>
					</div>
					{activeTab === "mine" && (
						<p className="rounded-xl border border-border/70 bg-card/60 p-3 text-sm text-muted-foreground">
							This is not a ticket wallet. It shows your listings, interest on
							your listings, and listings where you unlocked contact details.
						</p>
					)}
					<p className="rounded-xl border border-border/70 bg-card/48 px-3 py-2 text-sm text-muted-foreground">
						You can unlock contact on up to{" "}
						{TICKET_EXCHANGE_MAX_ACTIVE_INTERESTS_PER_USER} active listings at
						once. Closed listings clear after{" "}
						{TICKET_EXCHANGE_INTEREST_LOCK_MINUTES} minutes.
					</p>
					{(data.isAuthenticated || auth.isAuthenticated) &&
						data.profile &&
						!hasAcceptedCurrentAgreement(data.profile) && (
							<div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-sm text-muted-foreground">
								<span className="font-medium text-foreground">
									Safety agreement required.
								</span>{" "}
								Accept it once before posting or unlocking contact details.{" "}
								<button
									type="button"
									onClick={() => openAgreement(null)}
									className="font-medium text-foreground underline underline-offset-4"
								>
									Review terms
								</button>
							</div>
						)}

					{visibleListings.length === 0 ? (
						<div className="rounded-2xl border border-dashed border-border bg-card/48 p-8 text-center">
							<Search className="mx-auto h-8 w-8 text-muted-foreground" />
							<p className="mt-3 font-medium">No listings here yet</p>
							<p className="mt-1 text-sm text-muted-foreground">
								Create a selling or looking listing to get the exchange moving.
							</p>
						</div>
					) : (
						<div className="grid gap-3">
							{visibleListings.map((listing) => (
								<ListingCard
									key={listing.id}
									listing={listing}
									profile={data.profile}
									isAuthenticated={data.isAuthenticated || auth.isAuthenticated}
									onLogin={() => setIsLoginOpen(true)}
									onInterest={handleInterest}
									onStatus={handleStatus}
									onReport={(id) => setReportListingId(id)}
									onEventOpen={openListingEvent}
									onRepost={(item) => {
										setRepostListingId(item.id);
										setRepostQuantity(item.quantityLabel);
									}}
									busyInterestId={interestListingId}
									busyStatusId={statusListingId}
								/>
							))}
						</div>
					)}
				</section>
			</div>

			{isAgreementOpen && (
				<ModalShell title="Ticket Exchange agreement" onClose={closeAgreement}>
					<div className="space-y-4">
						<div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-950 dark:text-amber-100">
							<p className="font-medium">OOOC is only a connector.</p>
							<p className="mt-1 leading-6">
								We do not verify, sell, hold, transfer, reserve, or guarantee
								tickets. You are responsible for checking the ticket, the
								person, the transfer method, and whether the exchange is safe
								for you.
							</p>
						</div>
						<ul className="space-y-2 text-sm text-muted-foreground">
							<li className="flex gap-2">
								<Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
								<span>
									Use official transfer where the event or platform supports it.
								</span>
							</li>
							<li className="flex gap-2">
								<Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
								<span>
									Do your own due diligence before sending money or tickets.
								</span>
							</li>
							<li className="flex gap-2">
								<Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
								<span>
									Keep your listing accurate and mark it resolved when done.
								</span>
							</li>
							<li className="flex gap-2">
								<Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
								<span>
									Report suspicious, misleading, abusive, or duplicate listings.
								</span>
							</li>
						</ul>
						<label className="flex gap-2 rounded-xl border border-border/70 bg-background/55 p-3 text-sm">
							<input
								type="checkbox"
								checked={agreementChecked}
								onChange={(event) => setAgreementChecked(event.target.checked)}
								className="mt-1"
							/>
							<span>
								I understand OOOC does not take responsibility for ticket
								exchanges, and I agree to the{" "}
								<Link href={termsHref} className="underline underline-offset-4">
									Ticket Exchange terms
								</Link>
								.
							</span>
						</label>
						<div className="flex justify-end">
							<Button
								type="button"
								disabled={!agreementChecked || isAcceptingAgreement}
								onClick={handleAgreementAccept}
							>
								<ShieldAlert className="h-4 w-4" />
								{isAcceptingAgreement ? "Saving..." : "Accept and continue"}
							</Button>
						</div>
					</div>
				</ModalShell>
			)}

			{reportListingId && (
				<ModalShell
					title="Report listing"
					onClose={() => setReportListingId(null)}
				>
					<form onSubmit={handleReport} className="space-y-3">
						<p className="rounded-lg border border-border/70 bg-muted/35 p-3 text-sm text-muted-foreground">
							Reports go to OOOC moderators. They do not cancel a trade, reverse
							a payment, or guarantee a refund.
						</p>
						<Field label="Reason">
							<select
								value={reportReason}
								onChange={(event) =>
									setReportReason(
										event.target.value as TicketExchangeReportReason,
									)
								}
								className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm"
							>
								{Object.entries(reportReasonLabels).map(([value, label]) => (
									<option key={value} value={value}>
										{label}
									</option>
								))}
							</select>
						</Field>
						<Field label="Details">
							<Textarea
								value={reportDetails}
								onChange={(event) => setReportDetails(event.target.value)}
								placeholder="Optional context for moderators"
							/>
						</Field>
						<div className="flex justify-end">
							<Button
								type="submit"
								variant="destructive"
								disabled={isReporting}
							>
								<Flag className="h-4 w-4" />
								{isReporting ? "Sending..." : "Send report"}
							</Button>
						</div>
					</form>
				</ModalShell>
			)}

			{repostListingId && (
				<ModalShell
					title="Repost with new quantity"
					onClose={() => setRepostListingId(null)}
				>
					<form onSubmit={handleRepost} className="space-y-3">
						<Field label="New quantity">
							<Input
								value={repostQuantity}
								onChange={(event) => setRepostQuantity(event.target.value)}
								required
							/>
						</Field>
						<div className="flex justify-end">
							<Button type="submit" disabled={isReposting}>
								<RefreshCw className="h-4 w-4" />
								{isReposting ? "Posting..." : "Post fresh listing"}
							</Button>
						</div>
					</form>
				</ModalShell>
			)}

			{isLoginOpen && (
				<EmailGateModal
					isOpen={isLoginOpen}
					onClose={() => setIsLoginOpen(false)}
					onEmailSubmit={async () => {
						const refreshed = await auth.refreshSession();
						if (refreshed) {
							setIsLoginOpen(false);
							router.refresh();
						}
						return refreshed;
					}}
				/>
			)}
			<EventModalIsland
				event={selectedModalEvent}
				isAuthenticated={data.isAuthenticated || auth.isAuthenticated}
				isRequestUpdateOpen={isEventUpdateOpen}
				onClose={() => {
					setSelectedModalEvent(null);
					setIsEventUpdateOpen(false);
				}}
				onRequestUpdateOpenChange={setIsEventUpdateOpen}
				submissionsEnabled
				seriesEvents={selectedModalSeriesEvents}
				onNavigateSeriesEvent={setSelectedModalEvent}
			/>
		</div>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: React.ReactNode;
}) {
	return (
		<label className="grid gap-1.5 text-sm">
			<span className="font-medium text-foreground">{label}</span>
			{children}
		</label>
	);
}

function TabButton({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={cn(
				"min-h-9 rounded-lg px-2 text-xs font-medium transition-colors sm:rounded-xl sm:px-4 sm:text-sm",
				active
					? "bg-primary text-primary-foreground"
					: "text-muted-foreground hover:bg-muted hover:text-foreground",
			)}
		>
			{children}
		</button>
	);
}

function ContactMethodPicker({
	profile,
	value,
	onChange,
}: {
	profile: TicketExchangeContactProfile | null;
	value: TicketExchangeContactMethod[];
	onChange: (value: TicketExchangeContactMethod[]) => void;
}) {
	return (
		<div className="grid gap-2">
			<div className="flex flex-wrap gap-2">
				{TICKET_EXCHANGE_CONTACT_METHODS.map((method) => {
					const available = hasContact(profile, method);
					const selected = value.includes(method);
					return (
						<button
							key={method}
							type="button"
							disabled={!available}
							onClick={() => onChange(toggleMethod(value, method))}
							className={cn(
								"rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
								selected
									? "border-primary bg-primary text-primary-foreground"
									: "border-border bg-background/60",
								!available && "cursor-not-allowed opacity-45",
							)}
							title={
								available
									? undefined
									: "Add this detail to your contact profile first"
							}
						>
							{methodLabels[method]}
						</button>
					);
				})}
			</div>
			<p className="text-xs text-muted-foreground">
				Choose at least {TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT}.
			</p>
		</div>
	);
}

function ListingCard({
	listing,
	profile,
	isAuthenticated,
	onLogin,
	onInterest,
	onStatus,
	onReport,
	onEventOpen,
	onRepost,
	busyInterestId,
	busyStatusId,
}: {
	listing: TicketExchangeListingView;
	profile: TicketExchangeContactProfile | null;
	isAuthenticated: boolean;
	onLogin: () => void;
	onInterest: (listing: TicketExchangeListingView) => void;
	onStatus: (
		listing: TicketExchangeListingView,
		status: "active" | "paused" | "resolved" | "removed",
	) => void;
	onReport: (listingId: string) => void;
	onEventOpen: (listing: TicketExchangeListingView) => void;
	onRepost: (listing: TicketExchangeListingView) => void;
	busyInterestId: string | null;
	busyStatusId: string | null;
}) {
	const contactEntries = visibleContactEntries(listing.contactSnapshot);
	const isInterestBusy = busyInterestId === listing.id;
	const isStatusBusy = busyStatusId === listing.id;
	const listingTitle = formatListingQuantityTitle(listing);
	const statusLabel =
		listing.effectiveStatus === "active"
			? `Expires ${getRelativeTime(listing.expiresAt)}`
			: listing.effectiveStatus;
	const listingModeLabel =
		listing.listingType === "selling" ? "Selling" : "Looking";
	const quantityLabel =
		listing.listingType === "selling" ? "Available" : "Needed";
	const priceModeLabel = listing.listingType === "selling" ? "Price" : "Budget";
	const hasAgreement = hasAcceptedCurrentAgreement(profile);
	return (
		<article className="rounded-xl border border-border/70 bg-card/82 p-4 shadow-sm sm:p-5">
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<Badge
							className={cn(
								"shadow-none",
								listing.listingType === "selling"
									? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100"
									: "border border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-100",
							)}
						>
							{listingModeLabel}
						</Badge>
						<Badge variant="outline" className="capitalize">
							{statusLabel}
						</Badge>
					</div>
					<button
						type="button"
						onClick={() => onEventOpen(listing)}
						className="mt-2 block max-w-full text-left text-lg font-semibold leading-tight text-foreground underline-offset-4 hover:underline sm:text-xl"
					>
						<span className="line-clamp-2">{listing.eventName}</span>
					</button>
				</div>
				<button
					type="button"
					onClick={() => onEventOpen(listing)}
					className="mt-0.5 hidden shrink-0 items-center gap-1 rounded-full border border-border/70 bg-background/45 px-2.5 py-1 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline sm:inline-flex"
				>
					<Ticket className="h-3 w-3" />
					View event
				</button>
			</div>

			<div className="mt-5 space-y-3">
				<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
					<div className="min-w-0">
						<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
							{quantityLabel}
						</p>
						<p className="mt-1 text-2xl font-semibold leading-tight tracking-normal text-foreground sm:text-3xl">
							{listingTitle}
						</p>
					</div>
					<div className="flex flex-wrap gap-2 sm:justify-end">
						{listing.priceLabel ? (
							<div className="rounded-full border border-border/70 bg-background/45 px-3 py-1.5">
								<span className="mr-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
									{priceModeLabel}
								</span>
								<span className="text-sm font-semibold">
									{listing.priceLabel}
								</span>
							</div>
						) : null}
						<button
							type="button"
							onClick={() => onEventOpen(listing)}
							className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/45 px-3 py-1.5 text-sm font-medium underline-offset-4 hover:underline sm:hidden"
						>
							View event
							<ExternalLink className="h-3.5 w-3.5" />
						</button>
					</div>
				</div>
				{listing.note && (
					<p className="max-w-2xl text-sm leading-6 text-muted-foreground">
						{listing.note}
					</p>
				)}
				<div className="text-sm text-muted-foreground">
					<span>Confirm availability directly before sending money.</span>
				</div>
			</div>

			<div className="mt-5 grid gap-4 border-y border-border/70 py-4 sm:grid-cols-[0.75fr_1.25fr]">
				<div className="min-w-0">
					<p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						<Clock className="h-3.5 w-3.5" />
						Interest
					</p>
					<p className="mt-1 text-base">
						<span className="font-semibold">{listing.interestCount}</span>{" "}
						{listing.interestCount === 1
							? "person interested"
							: "people interested"}
					</p>
				</div>
				<div className="min-w-0">
					<p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						<MessageCircle className="h-3.5 w-3.5" />
						Contact
					</p>
					{contactEntries.length > 0 ? (
						<div className="mt-2 flex flex-wrap gap-2">
							{contactEntries.map((entry) => (
								<a
									key={`${entry.label}-${entry.value}`}
									href={entry.href}
									target={entry.href.startsWith("http") ? "_blank" : undefined}
									rel={
										entry.href.startsWith("http")
											? "noopener noreferrer"
											: undefined
									}
									className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border/70 bg-background/60 px-2 py-1 text-xs font-medium underline-offset-4 hover:underline"
								>
									{contactIconFor(entry.label)}
									<span className="truncate">{entry.value}</span>
								</a>
							))}
						</div>
					) : (
						<p className="mt-1 text-sm text-muted-foreground">
							Available after you register interest.
						</p>
					)}
				</div>
			</div>

			<div className="mt-4 flex flex-wrap items-center gap-2">
				{listing.isOwner ? (
					<>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={isStatusBusy}
							onClick={() =>
								onStatus(
									listing,
									listing.status === "paused" ? "active" : "paused",
								)
							}
						>
							<Pause className="h-3.5 w-3.5" />
							{listing.status === "paused" ? "Resume" : "Pause"}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={isStatusBusy}
							onClick={() => onStatus(listing, "resolved")}
						>
							<Check className="h-3.5 w-3.5" />
							Resolved
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => onRepost(listing)}
						>
							<RefreshCw className="h-3.5 w-3.5" />
							Repost
						</Button>
						<Button
							type="button"
							variant="destructive"
							size="sm"
							disabled={isStatusBusy}
							onClick={() => onStatus(listing, "removed")}
							className="ml-auto"
						>
							<Trash2 className="h-3.5 w-3.5" />
							Delete
						</Button>
					</>
				) : (
					<>
						<Button
							type="button"
							size="sm"
							disabled={listing.effectiveStatus !== "active" || isInterestBusy}
							title={
								isAuthenticated && !hasAgreement
									? "You will review the Ticket Exchange agreement first."
									: undefined
							}
							onClick={() => {
								if (!isAuthenticated) {
									onLogin();
									return;
								}
								onInterest(listing);
							}}
						>
							<Eye className="h-3.5 w-3.5" />
							{isInterestBusy
								? "Unlocking..."
								: listing.myInterest
									? "Update interest"
									: "I'm interested"}
						</Button>
						<Button
							type="button"
							variant="outline"
							size="sm"
							onClick={() => {
								if (!isAuthenticated) {
									onLogin();
									return;
								}
								onReport(listing.id);
							}}
							className="ml-auto"
						>
							<Flag className="h-3.5 w-3.5" />
							Report
						</Button>
					</>
				)}
			</div>

			{listing.isOwner && listing.interests.length > 0 && (
				<div className="mt-3 rounded-xl border border-border/60 bg-background/45 p-3">
					<p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
						<UserRound className="h-3.5 w-3.5" />
						Interested people
					</p>
					<div className="grid gap-2">
						{listing.interests.map((interest) => (
							<div
								key={interest.id}
								className="rounded-lg border border-border/50 bg-card/60 p-2 text-sm"
							>
								<p className="font-medium">
									{interest.contactSnapshot.displayName ||
										interest.actorEmail ||
										"Interested user"}
								</p>
								<div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
									{visibleContactEntries(interest.contactSnapshot).map(
										(entry) => (
											<a
												key={`${interest.id}-${entry.label}`}
												href={entry.href}
												target={
													entry.href.startsWith("http") ? "_blank" : undefined
												}
												rel={
													entry.href.startsWith("http")
														? "noopener noreferrer"
														: undefined
												}
												className="inline-flex max-w-full items-center gap-1 rounded-full border border-border/60 bg-background/55 px-2 py-1 font-medium text-foreground underline-offset-4 hover:underline"
											>
												{contactIconFor(entry.label)}
												<span className="text-muted-foreground">
													{entry.label}
												</span>
												<span className="truncate">{entry.value}</span>
											</a>
										),
									)}
								</div>
							</div>
						))}
					</div>
				</div>
			)}
		</article>
	);
}

function ModalShell({
	title,
	children,
	onClose,
}: {
	title: string;
	children: React.ReactNode;
	onClose: () => void;
}) {
	return (
		<div className="fixed inset-0 z-[120] flex items-end bg-black/40 p-3 sm:items-center sm:justify-center">
			<div className="w-full max-w-lg rounded-2xl border border-border bg-card p-4 shadow-2xl">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="text-lg font-semibold">{title}</h2>
					<Button type="button" variant="ghost" size="icon" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>
				{children}
			</div>
		</div>
	);
}
