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
import { trackTicketExchangeAnalytics } from "@/features/events/engagement/client-tracking";
import type { Event } from "@/features/events/types";
import {
	createTicketExchangeListing,
	expressTicketExchangeInterest,
	reportTicketExchangeListing,
	repostTicketExchangeListing,
	saveTicketExchangeContactProfile,
	updateTicketExchangeListingStatus,
} from "@/features/ticket-exchange/actions";
import {
	TICKET_EXCHANGE_CONTACT_METHODS,
	TICKET_EXCHANGE_DEFAULT_EXPIRY_HOURS,
	TICKET_EXCHANGE_EXPIRY_OPTIONS,
	TICKET_EXCHANGE_MAX_ACTIVE_INTERESTS_PER_USER,
	TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT,
	TICKET_EXCHANGE_RULES_VERSION,
	TICKET_EXCHANGE_SCAM_TIPS,
} from "@/features/ticket-exchange/constants";
import {
	isMyTicketExchangeActivityVisible,
	isPublicTicketExchangeListingVisible,
} from "@/features/ticket-exchange/listing-visibility";
import {
	buildTicketExchangePricingSuggestion,
	validateTicketExchangeFairPricePolicy,
} from "@/features/ticket-exchange/pricing";
import { requestTicketExchangeTour } from "@/features/ticket-exchange/tour-onboarding";
import type {
	TicketExchangeActionResult,
	TicketExchangeContactMethod,
	TicketExchangeContactProfile,
	TicketExchangeContactSnapshot,
	TicketExchangeListingStatus,
	TicketExchangeListingType,
	TicketExchangeListingView,
	TicketExchangePageData,
	TicketExchangeReportReason,
	TicketExchangeSummary,
} from "@/features/ticket-exchange/types";
import { buildTicketExchangeEventPath } from "@/features/ticket-exchange/urls";
import {
	TICKET_EXCHANGE_NOTE_LANGUAGE_ERROR,
	createTicketExchangeLanguageError,
	hasOffensiveTicketExchangeLanguage,
	normalizeInstagramHandle,
	normalizeOptionalEmail,
	normalizeWhatsAppNumber,
	normalizeXHandle,
	validateTicketExchangeDisplayName,
	validateTicketExchangeNote,
	validateTicketExchangePriceLabel,
	validateTicketExchangeQuantityLabel,
} from "@/features/ticket-exchange/utils";
import {
	OVERLAY_BODY_ATTRIBUTE,
	setBodyOverlayAttribute,
} from "@/lib/ui/overlay-state";
import { cn } from "@/lib/utils";
import {
	AlertTriangle,
	ArrowUpRight,
	AtSign,
	Check,
	CircleHelp,
	Clock,
	ExternalLink,
	Eye,
	Flag,
	Instagram,
	ListChecks,
	Mail,
	MessageCircle,
	Plus,
	RefreshCw,
	Search,
	ShieldAlert,
	SortAsc,
	SortDesc,
	Ticket,
	Trash2,
	UserRound,
	X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
	type ReactNode,
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	useTransition,
} from "react";
import { TicketExchangeTour } from "./TicketExchangeTour";

type TabKey = "all" | "selling" | "looking" | "mine";
type MarketplaceTabKey = Exclude<TabKey, "mine">;
type ListingSortDirection = "newest" | "oldest";

type TicketExchangeClientProps = {
	initialData: TicketExchangePageData;
};
type TicketExchangeEventModalIslandComponent = (props: {
	event: Event | null;
	isAuthenticated: boolean;
	isRequestUpdateOpen: boolean;
	onClose: () => void;
	onRequestUpdateOpenChange: (open: boolean) => void;
	seriesEvents?: Event[];
	onNavigateSeriesEvent?: (event: Event) => void;
}) => ReactNode;

type ProfileFormState = {
	displayName: string;
	alternateEmail: string;
	whatsappNumber: string;
	instagramHandle: string;
	xHandle: string;
};

type ProfileFormErrors = Partial<Record<keyof ProfileFormState, string>>;

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
const TICKET_EXCHANGE_ACTION_TIMEOUT_MS = 15000;
const TICKET_EXCHANGE_TIMEOUT_RESULT = {
	success: false,
	error:
		"This is taking longer than expected. Check your connection and try again.",
} satisfies TicketExchangeActionResult;
const TICKET_EXCHANGE_AGREEMENT_STORAGE_KEY = `oooc_ticket_exchange_agreement_${TICKET_EXCHANGE_RULES_VERSION}`;
const CONTROL_TRANSITION =
	"transition-[background-color,border-color,color,box-shadow,transform] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] active:scale-[0.98]";
const TICKET_EXCHANGE_SQUIRCLE_BUTTON_CLASS = "rounded-xl";
const TICKET_EXCHANGE_SQUIRCLE_INPUT_CLASS = "rounded-2xl";
const MARKETPLACE_TABS: Array<{ key: MarketplaceTabKey; label: string }> = [
	{ key: "all", label: "All" },
	{ key: "selling", label: "Selling" },
	{ key: "looking", label: "Looking" },
];
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
	expiryHours: TICKET_EXCHANGE_DEFAULT_EXPIRY_HOURS,
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
const CREATE_LISTING_CONTROL_CLASS = "h-11 rounded-xl px-3";

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

const formatEventListMetadata = (event: Event): string =>
	[
		formatEventPickerDay(event.day),
		formatEventPickerDate(event.date),
		event.time,
		event.location,
	]
		.filter(Boolean)
		.join(" · ");

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

const getListingStatusLabel = (listing: TicketExchangeListingView): string => {
	if (listing.effectiveStatus === "active") {
		return `Expires ${getRelativeTime(listing.expiresAt)}`;
	}
	if (listing.effectiveStatus === "paused") return "Paused";
	if (listing.effectiveStatus === "expired") return "Expired";
	if (listing.effectiveStatus === "removed") return "Removed";
	const label = listing.listingType === "selling" ? "Sold" : "Found";
	return listing.resolvedAt
		? `${label} ${getRelativeTime(listing.resolvedAt)}`
		: label;
};

const getTicketExchangeLanguageError = (
	checks: Array<{ fieldLabel: string; value: string; errorMessage?: string }>,
): string | null => {
	const flagged = checks.find(
		(check) =>
			check.value.trim() && hasOffensiveTicketExchangeLanguage(check.value),
	);
	if (!flagged) return null;
	return (
		flagged.errorMessage ??
		createTicketExchangeLanguageError(flagged.fieldLabel)
	);
};

const getListingSortTime = (listing: TicketExchangeListingView): number => {
	const ms = new Date(listing.createdAt).getTime();
	return Number.isFinite(ms) ? ms : 0;
};

const getMyActivityStatusRank = (
	status: TicketExchangeListingStatus,
): number => {
	if (status === "active") return 0;
	if (status === "paused") return 1;
	if (status === "expired") return 2;
	if (status === "resolved") return 3;
	if (status === "removed") return 4;
	return 5;
};

const contactIconFor = (label: string) => {
	if (label === "Email") return <Mail className="h-3.5 w-3.5" />;
	if (label === "WhatsApp") return <MessageCircle className="h-3.5 w-3.5" />;
	if (label === "Instagram") return <Instagram className="h-3.5 w-3.5" />;
	if (label === "X") return <AtSign className="h-3.5 w-3.5" />;
	return <ExternalLink className="h-3.5 w-3.5" />;
};

const withTicketExchangeTimeout = async (
	action: Promise<TicketExchangeActionResult>,
): Promise<TicketExchangeActionResult> => {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;
	try {
		return await Promise.race([
			action,
			new Promise<TicketExchangeActionResult>((resolve) => {
				timeoutId = setTimeout(
					() => resolve(TICKET_EXCHANGE_TIMEOUT_RESULT),
					TICKET_EXCHANGE_ACTION_TIMEOUT_MS,
				);
			}),
		]);
	} finally {
		if (timeoutId) clearTimeout(timeoutId);
	}
};

const getPreferredMarketplaceTab = (
	summaries: TicketExchangeSummary[],
	selectedEventKey: string | null,
): MarketplaceTabKey => {
	const relevantSummaries = selectedEventKey
		? summaries.filter((summary) => summary.eventKey === selectedEventKey)
		: summaries;
	const activeCount = relevantSummaries.reduce(
		(total, summary) => total + summary.sellingCount + summary.lookingCount,
		0,
	);
	return activeCount > 0 ? "all" : "selling";
};

const getContactSetupPrompt = (
	actionLabel: "reply" | "post" | "use Ticket Exchange" = "use Ticket Exchange",
): string =>
	`To ${actionLabel}, you need ${TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT} contact methods. Your account email counts as one, so add WhatsApp, Instagram, or Twitter as a backup.`;

export function TicketExchangeClient({
	initialData,
}: TicketExchangeClientProps) {
	const router = useRouter();
	const auth = useOptionalAuth();
	const [, startRouteTransition] = useTransition();
	const [data, setData] = useState(initialData);
	const [selectedEventKey, setSelectedEventKey] = useState<string | null>(
		initialData.selectedEventKey,
	);
	const initialMarketplaceTab = getPreferredMarketplaceTab(
		initialData.summaries,
		initialData.selectedEventKey,
	);
	const [activeTab, setActiveTab] = useState<TabKey>(initialMarketplaceTab);
	const lastMarketplaceTabRef = useRef<MarketplaceTabKey>(
		initialMarketplaceTab,
	);
	const [listingSortDirection, setListingSortDirection] =
		useState<ListingSortDirection>("newest");
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
	const [profileErrors, setProfileErrors] = useState<ProfileFormErrors>({});
	const [listingForm, setListingForm] = useState(() =>
		createListingFormState(initialData.selectedEventKey),
	);
	const [listingQuantityError, setListingQuantityError] = useState<
		string | null
	>(null);
	const [listingPriceError, setListingPriceError] = useState<string | null>(
		null,
	);
	const [pendingMessage, setPendingMessage] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isSavingProfile, setIsSavingProfile] = useState(false);
	const [isCreatingListing, setIsCreatingListing] = useState(false);
	const profilePanelRef = useRef<HTMLFormElement | null>(null);
	const createPanelRef = useRef<HTMLFormElement | null>(null);
	const boardControlsRef = useRef<HTMLDivElement | null>(null);
	const createListingInFlightRef = useRef(false);
	const shouldReturnToCreateAfterContactRef = useRef(false);
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
	const [TicketExchangeEventModalIsland, setTicketExchangeEventModalIsland] =
		useState<TicketExchangeEventModalIslandComponent | null>(null);
	const [isEventUpdateOpen, setIsEventUpdateOpen] = useState(false);
	const hasUserSelectedTabRef = useRef(false);

	useEffect(() => {
		if (hasUserSelectedTabRef.current) return;
		const preferredTab = getPreferredMarketplaceTab(
			data.summaries,
			selectedEventKey,
		);
		lastMarketplaceTabRef.current = preferredTab;
		setActiveTab(preferredTab);
	}, [data.summaries, selectedEventKey]);

	useEffect(() => {
		trackTicketExchangeAnalytics({
			actionType: "exchange_view",
			eventKey: selectedEventKey,
			surface: "marketplace",
		});
	}, [selectedEventKey]);

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

	useEffect(() => {
		if (!selectedModalEvent || TicketExchangeEventModalIsland) return;
		let isMounted = true;
		void import("./TicketExchangeEventModalIsland")
			.then((module) => {
				if (!isMounted) return;
				setTicketExchangeEventModalIsland(
					() => module.TicketExchangeEventModalIsland,
				);
			})
			.catch(() => {
				if (!isMounted) return;
				setErrorMessage("Could not load event details. Try again.");
				setSelectedModalEvent(null);
			});
		return () => {
			isMounted = false;
		};
	}, [TicketExchangeEventModalIsland, selectedModalEvent]);

	const currentTicketPath = selectedEvent
		? `${basePath}${buildTicketExchangeEventPath(selectedEvent)}`
		: `${basePath}/exchange`;
	const termsHref = `${basePath}/terms?returnTo=${encodeURIComponent(currentTicketPath)}`;
	const draftContactMethodCount = getDraftContactMethodCount(
		data.userEmail,
		profileForm,
	);
	const isContactReady =
		draftContactMethodCount >= TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT;
	const shouldShowContactReadiness =
		data.isAuthenticated || auth.isAuthenticated;
	const draftProfile = useMemo(
		() => createDraftContactProfile(data.profile, data.userEmail, profileForm),
		[data.profile, data.userEmail, profileForm],
	);
	const summaryByEventKey = useMemo(
		() => new Map(data.summaries.map((summary) => [summary.eventKey, summary])),
		[data.summaries],
	);
	const activitySortedEvents = useMemo(
		() =>
			data.events
				.map((event, index) => {
					const summary = summaryByEventKey.get(event.eventKey);
					const activeCount =
						(summary?.sellingCount ?? 0) + (summary?.lookingCount ?? 0);
					return { event, activeCount, index };
				})
				.sort((left, right) => {
					if (left.activeCount !== right.activeCount) {
						return right.activeCount - left.activeCount;
					}
					return left.index - right.index;
				})
				.map(({ event }) => event),
		[data.events, summaryByEventKey],
	);
	const eventOptions = useMemo<TypeaheadComboboxOption[]>(
		() =>
			activitySortedEvents.map((event) => {
				const summary = summaryByEventKey.get(event.eventKey);
				const sellingCount = summary?.sellingCount ?? 0;
				const lookingCount = summary?.lookingCount ?? 0;
				const activeCount = sellingCount + lookingCount;
				const activityLabel =
					activeCount > 0
						? [
								sellingCount > 0 ? `${sellingCount} selling` : null,
								lookingCount > 0 ? `${lookingCount} looking` : null,
							]
								.filter(Boolean)
								.join(" · ")
						: null;
				return {
					value: event.eventKey,
					label: event.name,
					description: [
						activityLabel,
						formatEventPickerDate(event.date),
						event.time,
						event.location,
					]
						.filter(Boolean)
						.join(" · "),
					rightLabel: formatEventPickerDay(event.day),
				};
			}),
		[activitySortedEvents, summaryByEventKey],
	);
	const selectedEventOption =
		eventOptions.find((option) => option.value === listingForm.eventKey) ??
		null;
	const selectedListingEvent = listingForm.eventKey
		? eventByKey.get(listingForm.eventKey) ?? null
		: null;
	const listingPricingSuggestion = useMemo(
		() =>
			buildTicketExchangePricingSuggestion({
				event: selectedListingEvent,
				listings: data.listings.filter(
					(listing) => listing.eventKey === listingForm.eventKey,
				),
				listingType: listingForm.listingType,
			}),
		[
			data.listings,
			listingForm.eventKey,
			listingForm.listingType,
			selectedListingEvent,
		],
	);
	const priceHelperId = "ticket-exchange-price-helper";
	const priceCommunityId = "ticket-exchange-price-community";
	const activeMarketplaceTab =
		activeTab === "mine"
			? null
			: MARKETPLACE_TABS.find((tab) => tab.key === activeTab);
	const activeMarketplaceTabIndex = activeMarketplaceTab
		? MARKETPLACE_TABS.findIndex((tab) => tab.key === activeMarketplaceTab.key)
		: -1;
	const listingCounts = useMemo(() => {
		const nowMs = Date.now();
		const listingsForEvent = selectedEventKey
			? data.listings.filter((listing) => listing.eventKey === selectedEventKey)
			: data.listings;
		return {
			all: listingsForEvent.filter((listing) =>
				isPublicTicketExchangeListingVisible(listing, "all", nowMs),
			).length,
			selling: listingsForEvent.filter((listing) =>
				isPublicTicketExchangeListingVisible(listing, "selling", nowMs),
			).length,
			looking: listingsForEvent.filter((listing) =>
				isPublicTicketExchangeListingVisible(listing, "looking", nowMs),
			).length,
			mine: listingsForEvent.filter(
				(listing) =>
					isMyTicketExchangeActivityVisible(listing) &&
					listing.effectiveStatus === "active",
			).length,
		};
	}, [data.listings, selectedEventKey]);
	const visibleListings = useMemo(() => {
		const nowMs = Date.now();
		const listingsForEvent = selectedEventKey
			? data.listings.filter((listing) => listing.eventKey === selectedEventKey)
			: data.listings;
		const filteredListings =
			activeTab === "mine"
				? listingsForEvent.filter(isMyTicketExchangeActivityVisible)
				: listingsForEvent.filter((listing) =>
						isPublicTicketExchangeListingVisible(listing, activeTab, nowMs),
					);
		const sortMultiplier = listingSortDirection === "newest" ? -1 : 1;
		return [...filteredListings].sort((left, right) => {
			if (activeTab === "mine") {
				const statusDelta =
					getMyActivityStatusRank(left.effectiveStatus) -
					getMyActivityStatusRank(right.effectiveStatus);
				if (statusDelta !== 0) return statusDelta;
			}
			const createdDelta = getListingSortTime(left) - getListingSortTime(right);
			if (createdDelta !== 0) return createdDelta * sortMultiplier;
			return left.id.localeCompare(right.id) * sortMultiplier;
		});
	}, [activeTab, data.listings, listingSortDirection, selectedEventKey]);
	const firstReplyTourListingId = useMemo(
		() =>
			visibleListings.find(
				(listing) =>
					listing.effectiveStatus === "active" &&
					!listing.isOwner &&
					!listing.myInterest,
			)?.id ?? null,
		[visibleListings],
	);
	const sortListingsButtonLabel =
		listingSortDirection === "newest"
			? "Showing newest listings first"
			: "Showing oldest listings first";
	const trackExchangeFriction = ({
		reason,
		surface,
		detail,
		listing,
		immediate = false,
	}: {
		reason: string;
		surface: Parameters<typeof trackTicketExchangeAnalytics>[0]["surface"];
		detail?: string | null;
		listing?: TicketExchangeListingView | null;
		immediate?: boolean;
	}): void => {
		trackTicketExchangeAnalytics({
			actionType: "flow_blocked",
			eventKey: listing?.eventKey ?? selectedEventKey,
			listingId: listing?.id,
			listingType: listing?.listingType,
			listingStatus: listing?.effectiveStatus,
			surface,
			detail: [reason, detail].filter(Boolean).join(":"),
			immediate,
		});
	};

	const trackExchangeValidationError = (
		field: string,
		surface: Parameters<typeof trackTicketExchangeAnalytics>[0]["surface"],
		detail?: string,
	): void => {
		trackTicketExchangeAnalytics({
			actionType: "validation_error",
			eventKey: selectedEventKey,
			surface,
			detail: [field, detail].filter(Boolean).join(":"),
			immediate: true,
		});
	};

	const trackExchangeActionFailure = (
		action: string,
		surface: Parameters<typeof trackTicketExchangeAnalytics>[0]["surface"],
		detail?: string | null,
	): void => {
		trackTicketExchangeAnalytics({
			actionType: "action_failed",
			eventKey: selectedEventKey,
			surface,
			detail: [action, detail].filter(Boolean).join(":"),
			immediate: true,
		});
	};

	const toggleListingSortDirection = () => {
		setListingSortDirection((current) => {
			const next = current === "newest" ? "oldest" : "newest";
			trackTicketExchangeAnalytics({
				actionType: "sort_change",
				eventKey: selectedEventKey,
				surface: "marketplace",
				detail: next,
			});
			return next;
		});
	};

	const selectMarketplaceTab = (tab: MarketplaceTabKey) => {
		hasUserSelectedTabRef.current = true;
		lastMarketplaceTabRef.current = tab;
		setActiveTab(tab);
		trackTicketExchangeAnalytics({
			actionType: "tab_change",
			eventKey: selectedEventKey,
			surface: "marketplace",
			detail: tab,
		});
	};
	const toggleMyActivityTab = () => {
		hasUserSelectedTabRef.current = true;
		const nextTab =
			activeTab === "mine" ? lastMarketplaceTabRef.current : "mine";
		if (activeTab !== "mine") {
			lastMarketplaceTabRef.current = activeTab;
		}
		setActiveTab(nextTab);
		trackTicketExchangeAnalytics({
			actionType: "tab_change",
			eventKey: selectedEventKey,
			surface: "marketplace",
			detail: nextTab,
		});
	};
	const emptyListingCopy =
		activeTab === "mine"
			? {
					title: "No activity yet",
					body: "Listings you posted or replied to will show here.",
					cta: "Post a listing",
					type: "selling" as const,
				}
			: activeTab === "selling"
				? {
						title: "No tickets available yet",
						body: "Post a selling listing if you have tickets, or check Looking to see who needs one.",
						cta: "Post selling",
						type: "selling" as const,
					}
				: activeTab === "looking"
					? {
							title: "No one looking yet",
							body: "Post a looking listing if you need a ticket, or check Selling for available tickets.",
							cta: "Post looking",
							type: "looking" as const,
						}
					: {
							title: "No ticket exchange activity yet",
							body: "Create a selling or looking listing to get the exchange moving.",
							cta: "Post listing",
							type: "selling" as const,
						};

	const openEmptyStateListing = () => {
		trackTicketExchangeAnalytics({
			actionType: "empty_state_cta",
			eventKey: selectedEventKey,
			listingType: emptyListingCopy.type,
			surface: "marketplace",
			detail: activeTab,
		});
		openCreateListing(emptyListingCopy.type);
	};

	const startTicketExchangeTour = useCallback(() => {
		requestTicketExchangeTour();
	}, []);

	const applyResult = (result: TicketExchangeActionResult, success: string) => {
		if (!result.success) {
			setPendingMessage(null);
			setErrorMessage(result.error ?? "Something went wrong.");
			return;
		}
		if (result.data) {
			setData(result.data);
			setSelectedEventKey(result.data.selectedEventKey);
			setProfileForm(createProfileFormState(result.data.profile));
			setProfileErrors({});
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
		setProfileErrors({});
	};

	const clearProfileError = (field: keyof ProfileFormState): void => {
		setProfileErrors((current) => {
			if (!current[field]) return current;
			const next = { ...current };
			delete next[field];
			return next;
		});
	};

	const validateProfileForm = (): ProfileFormErrors => {
		const errors: ProfileFormErrors = {};
		try {
			validateTicketExchangeDisplayName(profileForm.displayName);
		} catch (error) {
			errors.displayName =
				error instanceof Error
					? error.message
					: "Check the display name before saving.";
		}

		try {
			normalizeOptionalEmail(profileForm.alternateEmail);
		} catch (error) {
			errors.alternateEmail =
				error instanceof Error ? error.message : "Enter a valid email address.";
		}

		try {
			normalizeWhatsAppNumber(profileForm.whatsappNumber);
		} catch (error) {
			errors.whatsappNumber =
				error instanceof Error
					? error.message
					: "Enter a valid WhatsApp number with country code.";
		}

		try {
			normalizeInstagramHandle(profileForm.instagramHandle);
		} catch (error) {
			errors.instagramHandle =
				error instanceof Error
					? error.message
					: "Enter a valid Instagram handle.";
		}

		try {
			normalizeXHandle(profileForm.xHandle);
		} catch (error) {
			errors.xHandle =
				error instanceof Error
					? error.message
					: "Enter a valid Twitter handle.";
		}

		return errors;
	};

	const focusFirstProfileError = (errors: ProfileFormErrors): void => {
		const field = (
			[
				"displayName",
				"alternateEmail",
				"whatsappNumber",
				"instagramHandle",
				"xHandle",
			] satisfies Array<keyof ProfileFormState>
		).find((field) => Boolean(errors[field]));
		if (!field) return;
		window.setTimeout(() => {
			document.getElementById(`ticket-exchange-profile-${field}`)?.focus();
		}, 0);
	};

	const saveContactDraftIfNeeded =
		async (): Promise<TicketExchangeContactProfile | null> => {
			if (!hasUnsavedContactDraft(data.profile, profileForm)) {
				return data.profile;
			}
			const errors = validateProfileForm();
			if (Object.keys(errors).length > 0) {
				const firstError = Object.values(errors)[0];
				setProfileErrors(errors);
				setPendingMessage(null);
				setErrorMessage(firstError ?? "Check your contact details.");
				setIsProfileOpen(true);
				scrollPanelIntoView(profilePanelRef);
				focusFirstProfileError(errors);
				trackExchangeValidationError(
					"contact_profile",
					"listing_form",
					"contact_draft",
				);
				return null;
			}
			setPendingMessage("Saving contact details...");
			const result = await withTicketExchangeTimeout(
				saveTicketExchangeContactProfile({
					...profileForm,
					acceptRules: false,
					selectedEventKey,
				}),
			);
			if (!result.success) {
				setPendingMessage(null);
				setErrorMessage(result.error ?? "Unable to save contact details.");
				trackExchangeActionFailure(
					"profile_save",
					"listing_form",
					result.error,
				);
				return null;
			}
			applyDataFromResult(result);
			trackTicketExchangeAnalytics({
				actionType: "profile_save",
				eventKey: selectedEventKey,
				surface: "listing_form",
			});
			return result.data?.profile ?? data.profile;
		};

	const requireLogin = (
		detail = "unknown",
		surface: Parameters<
			typeof trackTicketExchangeAnalytics
		>[0]["surface"] = "marketplace",
		listing?: TicketExchangeListingView | null,
	) => {
		if (data.isAuthenticated || auth.isAuthenticated) return true;
		trackExchangeFriction({
			reason: "login_required",
			surface,
			detail,
			listing,
			immediate: true,
		});
		setIsLoginOpen(true);
		return false;
	};

	const scrollPanelIntoView = (ref: RefObject<HTMLElement | null>): void => {
		const scroll = () => {
			ref.current?.scrollIntoView({
				block: "start",
				behavior: "smooth",
			});
		};
		window.requestAnimationFrame(scroll);
		window.setTimeout(scroll, 80);
		window.setTimeout(scroll, 180);
	};

	const closeContactDetails = (): void => {
		setIsProfileOpen(false);
		if (shouldReturnToCreateAfterContactRef.current) {
			shouldReturnToCreateAfterContactRef.current = false;
			if (!isCreateOpen) {
				setIsCreateOpen(true);
			}
			scrollPanelIntoView(createPanelRef);
			return;
		}
		shouldReturnToCreateAfterContactRef.current = false;
		scrollPanelIntoView(boardControlsRef);
	};

	const closeCreateListing = (): void => {
		shouldReturnToCreateAfterContactRef.current = false;
		setIsCreateOpen(false);
		scrollPanelIntoView(boardControlsRef);
	};

	const openContactDetailsFromListing = (
		method: TicketExchangeContactMethod,
	): void => {
		if (!requireLogin("profile_open", "listing_form")) return;
		trackTicketExchangeAnalytics({
			actionType: "profile_open",
			eventKey: selectedEventKey,
			surface: "listing_form",
			detail: method,
		});
		setPendingMessage(
			`Contact details opened. Your listing draft is still here.`,
		);
		shouldReturnToCreateAfterContactRef.current = true;
		if (window.matchMedia("(max-width: 1023px)").matches) {
			setIsCreateOpen(false);
		}
		setIsProfileOpen(true);
		scrollPanelIntoView(profilePanelRef);
	};

	const openContactDetails = (): void => {
		if (!requireLogin("profile_open", "profile_panel")) return;
		if (isProfileOpen) {
			closeContactDetails();
			return;
		}
		trackTicketExchangeAnalytics({
			actionType: "profile_open",
			eventKey: selectedEventKey,
			surface: "profile_panel",
		});
		shouldReturnToCreateAfterContactRef.current = false;
		setIsCreateOpen(false);
		setIsProfileOpen(true);
		scrollPanelIntoView(profilePanelRef);
	};

	const focusContactDetailsForReply = (): void => {
		if (!requireLogin("profile_open", "listing_card")) return;
		trackTicketExchangeAnalytics({
			actionType: "profile_open",
			eventKey: selectedEventKey,
			surface: "listing_card",
			detail: "reply_contact_setup",
		});
		setPendingMessage(
			`${getContactSetupPrompt("reply")} Contact details are open so you can finish setup.`,
		);
		shouldReturnToCreateAfterContactRef.current = false;
		setIsCreateOpen(false);
		setIsProfileOpen(true);
		scrollPanelIntoView(profilePanelRef);
	};

	const openAgreement = (intent: PendingAgreementIntent) => {
		shouldReturnToCreateAfterContactRef.current = false;
		trackTicketExchangeAnalytics({
			actionType: "agreement_open",
			eventKey:
				intent?.kind === "interest"
					? intent.listing.eventKey
					: selectedEventKey,
			listingId: intent?.kind === "interest" ? intent.listing.id : undefined,
			listingType:
				intent?.kind === "interest"
					? intent.listing.listingType
					: intent?.listingType,
			surface: "agreement_modal",
			detail: intent?.kind ?? "review",
		});
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
		surface: Parameters<
			typeof trackTicketExchangeAnalytics
		>[0]["surface"] = "profile_panel",
		detail = "contact_profile_incomplete",
	): boolean => {
		if (
			getAvailableContactMethodCount(profile) >=
			TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT
		) {
			return true;
		}
		trackExchangeFriction({
			reason: "contact_profile_incomplete",
			surface,
			detail,
		});
		const actionLabel =
			detail === "interest"
				? "reply"
				: detail === "create"
					? "post"
					: "use Ticket Exchange";
		setPendingMessage(
			`${getContactSetupPrompt(actionLabel)} Contact details are open so you can finish setup.`,
		);
		setIsProfileOpen(true);
		setIsCreateOpen(false);
		scrollPanelIntoView(profilePanelRef);
		return false;
	};

	const startCreateListing = (
		type: TicketExchangeListingType,
		profile: TicketExchangeContactProfile | null,
	) => {
		trackTicketExchangeAnalytics({
			actionType: "listing_form_open",
			eventKey: selectedEventKey,
			listingType: type,
			surface: "listing_form",
		});
		setListingForm(
			createListingFormState(
				selectedEventKey,
				type,
				getDefaultContactMethods(profile),
			),
		);
		shouldReturnToCreateAfterContactRef.current = false;
		setIsProfileOpen(false);
		setIsCreateOpen(true);
		scrollPanelIntoView(createPanelRef);
	};

	const submitInterest = async (
		listing: TicketExchangeListingView,
		profile: TicketExchangeContactProfile | null,
	) => {
		if (interestListingId) return;
		setInterestListingId(listing.id);
		setPendingMessage("Sharing contact details...");
		try {
			const result = await withTicketExchangeTimeout(
				expressTicketExchangeInterest({
					listingId: listing.id,
					selectedEventKey,
					contactMethods: getDefaultContactMethods(profile),
				}),
			);
			applyResult(result, "Contact details are now visible.");
			if (result.success) {
				trackTicketExchangeAnalytics({
					actionType: "contact_unlock",
					eventKey: listing.eventKey,
					listingId: listing.id,
					listingType: listing.listingType,
					listingStatus: listing.effectiveStatus,
					surface: "listing_card",
					immediate: true,
				});
			} else {
				trackTicketExchangeAnalytics({
					actionType: "action_failed",
					eventKey: listing.eventKey,
					listingId: listing.id,
					listingType: listing.listingType,
					listingStatus: listing.effectiveStatus,
					surface: "listing_card",
					detail: ["contact_unlock", result.error].filter(Boolean).join(":"),
					immediate: true,
				});
			}
		} finally {
			setInterestListingId(null);
		}
	};

	const selectEvent = (eventKey: string | null) => {
		setSelectedEventKey(eventKey);
		trackTicketExchangeAnalytics({
			actionType: "event_select",
			eventKey,
			surface: "event_filter",
			detail: eventKey ? "event" : "all",
		});
		const nextEvent = eventKey ? eventByKey.get(eventKey) : null;
		const nextPath = nextEvent
			? `${basePath}${buildTicketExchangeEventPath(nextEvent)}`
			: `${basePath}/exchange`;
		startRouteTransition(() => {
			router.push(nextPath, { scroll: false });
		});
	};

	const openCreateListing = (type: TicketExchangeListingType = "selling") => {
		if (!requireLogin("listing_form_open", "listing_form")) return;
		if (!hasAcceptedCurrentAgreement(data.profile)) {
			trackExchangeFriction({
				reason: "agreement_required",
				surface: "agreement_modal",
				detail: `create:${type}`,
			});
			openAgreement({ kind: "create", listingType: type });
			return;
		}
		if (!ensureContactDetailsReady(draftProfile, "listing_form", "create"))
			return;
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
		trackTicketExchangeAnalytics({
			actionType: "event_details_open",
			eventKey: listing.eventKey,
			listingId: listing.id,
			listingType: listing.listingType,
			listingStatus: listing.effectiveStatus,
			surface: "event_modal",
		});
	};

	const handleProfileSubmit = async (
		event: React.FormEvent<HTMLFormElement>,
	) => {
		event.preventDefault();
		if (isSavingProfile) return;
		if (!requireLogin("profile_save", "profile_panel")) return;
		const errors = validateProfileForm();
		if (Object.keys(errors).length > 0) {
			const firstError = Object.values(errors)[0];
			setProfileErrors(errors);
			setErrorMessage(firstError ?? "Check your contact details.");
			focusFirstProfileError(errors);
			trackExchangeValidationError("contact_profile", "profile_panel");
			return;
		}
		setIsSavingProfile(true);
		setPendingMessage("Saving contact profile...");
		try {
			const result = await withTicketExchangeTimeout(
				saveTicketExchangeContactProfile({
					...profileForm,
					acceptRules: false,
					selectedEventKey,
				}),
			);
			applyResult(result, "Contact profile saved.");
			if (result.success) {
				trackTicketExchangeAnalytics({
					actionType: "profile_save",
					eventKey: selectedEventKey,
					surface: "profile_panel",
					immediate: true,
				});
				closeContactDetails();
			} else {
				trackExchangeActionFailure(
					"profile_save",
					"profile_panel",
					result.error,
				);
			}
		} finally {
			setIsSavingProfile(false);
		}
	};

	const handleCreateListing = async (
		event: React.FormEvent<HTMLFormElement>,
	) => {
		event.preventDefault();
		if (createListingInFlightRef.current || isCreatingListing) return;
		if (!requireLogin("listing_create", "listing_form")) return;
		try {
			validateTicketExchangeQuantityLabel(listingForm.quantityLabel);
			setListingQuantityError(null);
			validateTicketExchangePriceLabel(listingForm.priceLabel);
			if (selectedListingEvent) {
				validateTicketExchangeFairPricePolicy({
					event: selectedListingEvent,
					listingType: listingForm.listingType,
					priceLabel: listingForm.priceLabel,
				});
			}
			setListingPriceError(null);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Add the ticket price or budget before posting.";
			const quantityMessage =
				message.includes("quantity") || message.includes("ticket need");
			setListingQuantityError(quantityMessage ? message : null);
			setListingPriceError(quantityMessage ? null : message);
			setErrorMessage(message);
			window.setTimeout(() => {
				document
					.getElementById(
						quantityMessage
							? "ticket-exchange-quantity-label"
							: "ticket-exchange-price-label",
					)
					?.focus();
			}, 0);
			trackExchangeValidationError(
				quantityMessage ? "quantity" : "price",
				"listing_form",
				"invalid",
			);
			return;
		}
		const languageError = getTicketExchangeLanguageError([
			{
				fieldLabel: "the quantity or ticket need",
				value: listingForm.quantityLabel,
			},
			{ fieldLabel: "the price or budget", value: listingForm.priceLabel },
			{
				fieldLabel: "the note before posting",
				value: listingForm.note,
				errorMessage: TICKET_EXCHANGE_NOTE_LANGUAGE_ERROR,
			},
		]);
		if (languageError) {
			setErrorMessage(languageError);
			trackExchangeValidationError("listing_copy", "listing_form");
			return;
		}
		try {
			validateTicketExchangeNote(listingForm.note);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: TICKET_EXCHANGE_NOTE_LANGUAGE_ERROR;
			setErrorMessage(message);
			window.setTimeout(() => {
				document.getElementById("ticket-exchange-note")?.focus();
			}, 0);
			trackExchangeValidationError("listing_note", "listing_form", "invalid");
			return;
		}
		createListingInFlightRef.current = true;
		setIsCreatingListing(true);
		setPendingMessage("Posting listing...");
		try {
			const savedProfile = await saveContactDraftIfNeeded();
			if (!savedProfile) return;
			if (!ensureContactDetailsReady(savedProfile, "listing_form", "create"))
				return;
			setPendingMessage("Posting listing...");
			const result = await withTicketExchangeTimeout(
				createTicketExchangeListing(listingForm),
			);
			applyResult(result, "Listing posted.");
			if (result.success) {
				trackTicketExchangeAnalytics({
					actionType: "listing_create",
					eventKey: listingForm.eventKey,
					listingType: listingForm.listingType,
					surface: "listing_form",
					immediate: true,
				});
				closeCreateListing();
				setListingForm(
					createListingFormState(
						selectedEventKey,
						listingForm.listingType,
						getDefaultContactMethods(result.data?.profile ?? data.profile),
					),
				);
			} else {
				trackExchangeActionFailure(
					"listing_create",
					"listing_form",
					result.error,
				);
			}
		} finally {
			createListingInFlightRef.current = false;
			setIsCreatingListing(false);
		}
	};

	const handleInterest = async (listing: TicketExchangeListingView) => {
		if (!requireLogin("contact_unlock", "listing_card", listing)) return;
		if (!hasAcceptedCurrentAgreement(data.profile)) {
			trackExchangeFriction({
				reason: "agreement_required",
				surface: "agreement_modal",
				detail: "interest",
				listing,
			});
			openAgreement({ kind: "interest", listing });
			return;
		}
		if (!ensureContactDetailsReady(draftProfile, "listing_card", "interest"))
			return;
		const savedProfile = await saveContactDraftIfNeeded();
		if (!savedProfile) return;
		if (!ensureContactDetailsReady(savedProfile, "listing_card", "interest"))
			return;
		await submitInterest(listing, savedProfile);
	};

	const handleAgreementAccept = async () => {
		if (isAcceptingAgreement) return;
		if (!requireLogin("agreement_accept", "agreement_modal")) return;
		if (!agreementChecked) {
			trackExchangeFriction({
				reason: "agreement_checkbox_required",
				surface: "agreement_modal",
				detail: pendingAgreementIntent?.kind ?? "review",
			});
			return;
		}
		setIsAcceptingAgreement(true);
		setPendingMessage("Saving Ticket Exchange agreement...");
		try {
			const result = await withTicketExchangeTimeout(
				saveTicketExchangeContactProfile({
					...profileForm,
					acceptRules: true,
					selectedEventKey,
				}),
			);
			applyResult(result, "Ticket Exchange agreement accepted.");
			if (!result.success) {
				trackExchangeActionFailure(
					"agreement_accept",
					"agreement_modal",
					result.error,
				);
				return;
			}
			trackTicketExchangeAnalytics({
				actionType: "agreement_accept",
				eventKey:
					pendingAgreementIntent?.kind === "interest"
						? pendingAgreementIntent.listing.eventKey
						: selectedEventKey,
				listingId:
					pendingAgreementIntent?.kind === "interest"
						? pendingAgreementIntent.listing.id
						: undefined,
				listingType:
					pendingAgreementIntent?.kind === "interest"
						? pendingAgreementIntent.listing.listingType
						: pendingAgreementIntent?.listingType,
				surface: "agreement_modal",
				detail: pendingAgreementIntent?.kind ?? "review",
				immediate: true,
			});
			const nextProfile = result.data?.profile ?? data.profile;
			setIsAgreementOpen(false);
			setPendingAgreementIntent(null);
			setAgreementChecked(false);
			if (
				!ensureContactDetailsReady(nextProfile, "agreement_modal", "accepted")
			)
				return;
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
			const result = await withTicketExchangeTimeout(
				updateTicketExchangeListingStatus({
					listingId: listing.id,
					status,
					selectedEventKey,
				}),
			);
			applyResult(result, "Listing updated.");
			if (result.success) {
				trackTicketExchangeAnalytics({
					actionType: "listing_status_update",
					eventKey: listing.eventKey,
					listingId: listing.id,
					listingType: listing.listingType,
					listingStatus: status,
					surface: "listing_card",
					detail: status,
					immediate: true,
				});
			} else {
				trackTicketExchangeAnalytics({
					actionType: "action_failed",
					eventKey: listing.eventKey,
					listingId: listing.id,
					listingType: listing.listingType,
					listingStatus: listing.effectiveStatus,
					surface: "listing_card",
					detail: ["listing_status_update", status, result.error]
						.filter(Boolean)
						.join(":"),
					immediate: true,
				});
			}
		} finally {
			setStatusListingId(null);
		}
	};

	const handleReport = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isReporting) return;
		if (!reportListingId || !requireLogin("report_submit", "report_modal"))
			return;
		const languageError = getTicketExchangeLanguageError([
			{ fieldLabel: "the report details", value: reportDetails },
		]);
		if (languageError) {
			setErrorMessage(languageError);
			trackExchangeValidationError("report_details", "report_modal");
			return;
		}
		const reportedListing = data.listings.find(
			(listing) => listing.id === reportListingId,
		);
		setIsReporting(true);
		try {
			const result = await withTicketExchangeTimeout(
				reportTicketExchangeListing({
					listingId: reportListingId,
					reason: reportReason,
					details: reportDetails,
					selectedEventKey,
				}),
			);
			applyResult(result, "Report sent.");
			if (result.success) {
				trackTicketExchangeAnalytics({
					actionType: "report_submit",
					eventKey: reportedListing?.eventKey ?? selectedEventKey,
					listingId: reportListingId,
					listingType: reportedListing?.listingType,
					listingStatus: reportedListing?.effectiveStatus,
					surface: "report_modal",
					detail: reportReason,
					immediate: true,
				});
				setReportListingId(null);
				setReportDetails("");
			} else {
				trackTicketExchangeAnalytics({
					actionType: "action_failed",
					eventKey: reportedListing?.eventKey ?? selectedEventKey,
					listingId: reportListingId,
					listingType: reportedListing?.listingType,
					listingStatus: reportedListing?.effectiveStatus,
					surface: "report_modal",
					detail: ["report_submit", result.error].filter(Boolean).join(":"),
					immediate: true,
				});
			}
		} finally {
			setIsReporting(false);
		}
	};

	const handleRepost = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		if (isReposting) return;
		if (!repostListingId) return;
		const languageError = getTicketExchangeLanguageError([
			{ fieldLabel: "the quantity", value: repostQuantity },
		]);
		if (languageError) {
			setErrorMessage(languageError);
			trackExchangeValidationError("repost_quantity", "listing_card");
			return;
		}
		const repostedListing = data.listings.find(
			(listing) => listing.id === repostListingId,
		);
		setIsReposting(true);
		try {
			const result = await withTicketExchangeTimeout(
				repostTicketExchangeListing({
					listingId: repostListingId,
					quantityLabel: repostQuantity,
					expiryHours: TICKET_EXCHANGE_DEFAULT_EXPIRY_HOURS,
					selectedEventKey,
				}),
			);
			applyResult(result, "Fresh listing posted.");
			if (result.success) {
				trackTicketExchangeAnalytics({
					actionType: "listing_repost",
					eventKey: repostedListing?.eventKey ?? selectedEventKey,
					listingId: repostListingId,
					listingType: repostedListing?.listingType,
					listingStatus: repostedListing?.effectiveStatus,
					surface: "listing_card",
					immediate: true,
				});
				setRepostListingId(null);
				setRepostQuantity("");
			} else {
				trackTicketExchangeAnalytics({
					actionType: "action_failed",
					eventKey: repostedListing?.eventKey ?? selectedEventKey,
					listingId: repostListingId,
					listingType: repostedListing?.listingType,
					listingStatus: repostedListing?.effectiveStatus,
					surface: "listing_card",
					detail: ["listing_repost", result.error].filter(Boolean).join(":"),
					immediate: true,
				});
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
						</div>
						<div>
							<h1 className="text-xl font-semibold tracking-normal text-foreground sm:text-3xl">
								Find people trading tickets
							</h1>
							<p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground sm:mt-2 sm:leading-6">
								Find tickets people are selling, post what you need, and contact
								each other when there's a match.
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
					<div
						id="ticket-exchange-top-actions"
						className="flex flex-wrap gap-2 lg:justify-end"
					>
						<Button
							id="ticket-exchange-top-contact-button"
							type="button"
							variant={isProfileOpen ? "secondary" : "outline"}
							onClick={openContactDetails}
							className={cn(
								"hidden lg:inline-flex",
								TICKET_EXCHANGE_SQUIRCLE_BUTTON_CLASS,
							)}
						>
							<UserRound className="h-4 w-4" />
							<span>{isProfileOpen ? "Hide contacts" : "Contact details"}</span>
							{shouldShowContactReadiness ? (
								<ContactReadinessBadge
									count={draftContactMethodCount}
									ready={isContactReady}
								/>
							) : null}
						</Button>
						<Button
							id="ticket-exchange-tour-button"
							type="button"
							variant="outline"
							onClick={startTicketExchangeTour}
							className={TICKET_EXCHANGE_SQUIRCLE_BUTTON_CLASS}
						>
							<CircleHelp className="h-4 w-4" />
							Tour
						</Button>
						<Button
							id="ticket-exchange-primary-post-button"
							type="button"
							onClick={() => openCreateListing("selling")}
						>
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
					ref={profilePanelRef}
					onSubmit={handleProfileSubmit}
					className="order-4 scroll-mt-28 rounded-xl border border-border/70 bg-card/80 p-3 shadow-sm sm:p-4 lg:order-3 lg:scroll-mt-36"
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
									Required before you can post or reply. Shown only after
									someone replies to a listing.
								</p>
							</div>
						</div>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							onClick={closeContactDetails}
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
					<div className="grid gap-3 md:grid-cols-2">
						<Field
							label="Display name"
							error={profileErrors.displayName}
							errorId="ticket-exchange-profile-displayName-error"
						>
							<Input
								id="ticket-exchange-profile-displayName"
								value={profileForm.displayName}
								onChange={(event) => {
									clearProfileError("displayName");
									setProfileForm((current) => ({
										...current,
										displayName: event.target.value,
									}));
								}}
								placeholder="Alex"
								aria-invalid={Boolean(profileErrors.displayName)}
								aria-describedby={
									profileErrors.displayName
										? "ticket-exchange-profile-displayName-error"
										: undefined
								}
							/>
						</Field>
						<Field label="Email">
							<Input value={data.userEmail ?? ""} disabled />
						</Field>
						<Field
							label="Exchange email override"
							error={profileErrors.alternateEmail}
							errorId="ticket-exchange-profile-alternateEmail-error"
						>
							<Input
								id="ticket-exchange-profile-alternateEmail"
								type="email"
								value={profileForm.alternateEmail}
								onChange={(event) => {
									clearProfileError("alternateEmail");
									setProfileForm((current) => ({
										...current,
										alternateEmail: event.target.value,
									}));
								}}
								placeholder="Use a different email"
								aria-invalid={Boolean(profileErrors.alternateEmail)}
								aria-describedby={
									profileErrors.alternateEmail
										? "ticket-exchange-profile-alternateEmail-error"
										: undefined
								}
							/>
						</Field>
						<Field
							label="WhatsApp number"
							error={profileErrors.whatsappNumber}
							errorId="ticket-exchange-profile-whatsappNumber-error"
						>
							<Input
								id="ticket-exchange-profile-whatsappNumber"
								type="tel"
								inputMode="tel"
								value={profileForm.whatsappNumber}
								onChange={(event) => {
									clearProfileError("whatsappNumber");
									setProfileForm((current) => ({
										...current,
										whatsappNumber: event.target.value,
									}));
								}}
								placeholder="+44 7123 456789"
								aria-invalid={Boolean(profileErrors.whatsappNumber)}
								aria-describedby={
									profileErrors.whatsappNumber
										? "ticket-exchange-profile-whatsappNumber-error"
										: undefined
								}
							/>
						</Field>
						<Field
							label="Instagram"
							error={profileErrors.instagramHandle}
							errorId="ticket-exchange-profile-instagramHandle-error"
						>
							<HandleInput
								id="ticket-exchange-profile-instagramHandle"
								value={profileForm.instagramHandle}
								onChange={(value) => {
									clearProfileError("instagramHandle");
									setProfileForm((current) => ({
										...current,
										instagramHandle: value,
									}));
								}}
								invalid={Boolean(profileErrors.instagramHandle)}
								describedBy={
									profileErrors.instagramHandle
										? "ticket-exchange-profile-instagramHandle-error"
										: undefined
								}
							/>
						</Field>
						<Field
							label="Twitter"
							error={profileErrors.xHandle}
							errorId="ticket-exchange-profile-xHandle-error"
						>
							<HandleInput
								id="ticket-exchange-profile-xHandle"
								value={profileForm.xHandle}
								onChange={(value) => {
									clearProfileError("xHandle");
									setProfileForm((current) => ({
										...current,
										xHandle: value,
									}));
								}}
								invalid={Boolean(profileErrors.xHandle)}
								describedBy={
									profileErrors.xHandle
										? "ticket-exchange-profile-xHandle-error"
										: undefined
								}
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
						<span>One backup contact is required before buy/sell replies.</span>
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
									Required before listing or sharing contact.
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
					ref={createPanelRef}
					onSubmit={handleCreateListing}
					className="order-4 scroll-mt-28 rounded-xl border border-border/70 bg-card/72 p-4 sm:p-5 lg:order-3 lg:scroll-mt-36"
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
							onClick={closeCreateListing}
						>
							<X className="h-4 w-4" />
						</Button>
					</div>
					<div className="grid gap-x-3 gap-y-4 lg:grid-cols-2">
						<Field label="What are you doing?" className="gap-2">
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
											"flex h-11 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors",
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
						<Field
							label="Quantity"
							error={listingQuantityError}
							errorId="ticket-exchange-quantity-error"
						>
							<Input
								id="ticket-exchange-quantity-label"
								value={listingForm.quantityLabel}
								onChange={(event) => {
									if (listingQuantityError) setListingQuantityError(null);
									setListingForm((current) => ({
										...current,
										quantityLabel: event.target.value,
									}));
								}}
								placeholder={
									listingForm.listingType === "selling"
										? "2 tickets"
										: "Looking for 1 ticket"
								}
								required
								aria-invalid={Boolean(listingQuantityError)}
								aria-describedby={
									listingQuantityError
										? "ticket-exchange-quantity-error"
										: undefined
								}
								className={CREATE_LISTING_CONTROL_CLASS}
							/>
						</Field>
						<Field
							label={listingForm.listingType === "selling" ? "Price" : "Budget"}
							error={listingPriceError}
							errorId="ticket-exchange-price-error"
						>
							<Input
								id="ticket-exchange-price-label"
								value={listingForm.priceLabel}
								onChange={(event) => {
									if (listingPriceError) setListingPriceError(null);
									setListingForm((current) => ({
										...current,
										priceLabel: event.target.value,
									}));
								}}
								placeholder={
									listingForm.listingType === "selling"
										? "Required - £35 each / face value"
										: "Required - £35 / face value"
								}
								required
								aria-invalid={Boolean(listingPriceError)}
								aria-describedby={
									[
										priceHelperId,
										listingPricingSuggestion.communityRangeLabel
											? priceCommunityId
											: null,
										listingPriceError ? "ticket-exchange-price-error" : null,
									]
										.filter(Boolean)
										.join(" ") || undefined
								}
								className={CREATE_LISTING_CONTROL_CLASS}
							/>
							<div className="grid gap-1.5 text-xs leading-5 text-muted-foreground">
								<p id={priceHelperId}>{listingPricingSuggestion.helperText}</p>
								{listingPricingSuggestion.communityRangeLabel ? (
									<p id={priceCommunityId}>
										{listingPricingSuggestion.communityRangeLabel}
									</p>
								) : null}
								{listingPricingSuggestion.eventSuggestedLabel ? (
									<div>
										<button
											type="button"
											disabled={isCreatingListing}
											onClick={() => {
												setListingPriceError(null);
												setListingForm((current) => ({
													...current,
													priceLabel:
														listingPricingSuggestion.eventSuggestedLabel ?? "",
												}));
											}}
											className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border bg-background/70 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50"
										>
											<Check className="h-3.5 w-3.5" />
											Use listed price
										</button>
									</div>
								) : null}
							</div>
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
								className="h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
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
								onUnavailableMethodRequest={openContactDetailsFromListing}
							/>
						</Field>
						<div className="lg:col-span-2">
							<Field label="Note">
								<Textarea
									id="ticket-exchange-note"
									value={listingForm.note}
									onChange={(event) =>
										setListingForm((current) => ({
											...current,
											note: event.target.value,
										}))
									}
									placeholder="Use official transfer where possible. Availability may change."
									className="min-h-20 rounded-xl px-3"
								/>
							</Field>
						</div>
					</div>
					<div className="mt-4 flex justify-end">
						<Button
							type="submit"
							className="h-10 px-3"
							disabled={isCreatingListing}
						>
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
						id="ticket-exchange-mobile-event-filter"
						options={eventOptions}
						placeholder="Filter by event"
						emptyMessage="No matching events"
						maxVisibleOptions={6}
						clearOnSelect
						controlClassName={TICKET_EXCHANGE_SQUIRCLE_INPUT_CLASS}
						inputClassName={TICKET_EXCHANGE_SQUIRCLE_INPUT_CLASS}
						leadingIcon={<Search className="h-4 w-4" />}
						onSelect={(option) => selectEvent(option.value)}
					/>
					<Button
						type="button"
						variant={isProfileOpen ? "secondary" : "outline"}
						className={cn(
							"justify-start",
							TICKET_EXCHANGE_SQUIRCLE_BUTTON_CLASS,
						)}
						onClick={openContactDetails}
					>
						<UserRound className="h-4 w-4" />
						<span>{isProfileOpen ? "Hide contacts" : "Contact details"}</span>
						{shouldShowContactReadiness ? (
							<ContactReadinessBadge
								count={draftContactMethodCount}
								ready={isContactReady}
							/>
						) : null}
					</Button>
					<p className="px-1 text-xs leading-5 text-muted-foreground">
						Accept the rules, then add one backup contact method before posting
						or replying.
					</p>
					<details className="group rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs text-muted-foreground">
						<summary className="flex cursor-pointer list-none items-center justify-between gap-2 font-medium text-foreground">
							<span className="inline-flex items-center gap-1.5">
								<ShieldAlert className="h-3.5 w-3.5 text-amber-700 dark:text-amber-300" />
								Scam checks
							</span>
							<span className="text-muted-foreground transition-transform group-open:rotate-45">
								<Plus className="h-3.5 w-3.5" />
							</span>
						</summary>
						<ul className="mt-2 space-y-1.5 leading-5">
							{[
								"Prefer payment methods with buyer protection.",
								...TICKET_EXCHANGE_SCAM_TIPS.filter(
									(tip) =>
										tip !== "Prefer payment methods with buyer protection.",
								),
							]
								.slice(0, 3)
								.map((tip) => (
									<li key={tip} className="flex gap-2">
										<AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
										<span>{tip}</span>
									</li>
								))}
						</ul>
						<Link
							href={termsHref}
							className="mt-2 inline-flex font-medium text-foreground underline-offset-4 hover:underline"
						>
							Read rules
						</Link>
					</details>
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
							href={`${basePath}/exchange`}
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
						<div id="ticket-exchange-event-filter">
							<TypeaheadCombobox
								options={eventOptions}
								placeholder="Filter by event"
								emptyMessage="No matching events"
								maxVisibleOptions={6}
								clearOnSelect
								leadingIcon={<Search className="h-4 w-4" />}
								controlClassName={TICKET_EXCHANGE_SQUIRCLE_INPUT_CLASS}
								inputClassName={TICKET_EXCHANGE_SQUIRCLE_INPUT_CLASS}
								className="mb-2"
								onSelect={(option) => {
									selectEvent(option.value);
								}}
							/>
						</div>
						<div className="max-h-[34rem] space-y-1 overflow-y-auto">
							{activitySortedEvents.map((event) => {
								const summary = summaryByEventKey.get(event.eventKey);
								const activeCount =
									(summary?.sellingCount ?? 0) + (summary?.lookingCount ?? 0);
								const eventMetadata = formatEventListMetadata(event);
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
										{eventMetadata ? (
											<span className="mt-0.5 block line-clamp-1 text-xs opacity-70">
												{eventMetadata}
											</span>
										) : null}
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
					<div
						id="ticket-exchange-board-controls"
						ref={boardControlsRef}
						className="sticky top-2 z-30 rounded-[1.15rem] border border-border/65 bg-card/86 p-1.5 shadow-[0_18px_44px_-34px_rgba(20,16,12,0.62),inset_0_1px_0_rgba(255,255,255,0.42)] backdrop-blur-xl sm:rounded-2xl sm:p-2 lg:static lg:bg-card/70 lg:shadow-[inset_0_1px_0_rgba(255,255,255,0.34)] dark:bg-card/58 dark:shadow-[0_18px_44px_-34px_rgba(0,0,0,0.82),inset_0_1px_0_rgba(255,255,255,0.08)]"
					>
						{selectedEvent ? (
							<div className="mb-1.5 flex items-center gap-2 border-b border-border/60 px-1 pb-1.5 sm:mb-2 sm:px-1.5 sm:pb-2">
								<div className="min-w-0 flex flex-1 items-center gap-2">
									<span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
										Event
									</span>
									<span className="min-w-0 truncate text-sm font-semibold text-foreground">
										{selectedEvent.name}
									</span>
								</div>
								<button
									type="button"
									onClick={() => selectEvent(null)}
									className="shrink-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
								>
									Show all
								</button>
							</div>
						) : null}
						<div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
							<div
								id="ticket-exchange-marketplace-tabs"
								role="group"
								aria-label="Ticket exchange activity"
								className="relative isolate grid min-w-0 flex-1 grid-cols-3 overflow-hidden rounded-xl border border-border/70 bg-[radial-gradient(ellipse_115%_130%_at_50%_-18%,rgba(255,255,255,0.42),transparent_54%),radial-gradient(ellipse_90%_92%_at_12%_115%,hsl(var(--primary)/0.12),transparent_64%),linear-gradient(145deg,hsl(var(--background)/0.62),hsl(var(--card)/0.7))] p-1 shadow-[0_18px_42px_-34px_rgba(20,16,12,0.78),inset_0_1px_0_rgba(255,255,255,0.58),inset_0_-1px_0_rgba(20,16,12,0.08)] backdrop-blur-xl sm:rounded-2xl dark:bg-[radial-gradient(ellipse_115%_130%_at_50%_-18%,rgba(255,255,255,0.08),transparent_54%),radial-gradient(ellipse_90%_92%_at_12%_115%,hsl(var(--primary)/0.14),transparent_64%),linear-gradient(145deg,hsl(var(--background)/0.44),hsl(var(--card)/0.58))]"
							>
								<span
									aria-hidden="true"
									className={cn(
										"pointer-events-none absolute top-1 bottom-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg border border-white/20 bg-primary shadow-[0_14px_28px_-16px_hsl(var(--primary)/0.7),inset_0_1px_0_rgba(255,255,255,0.32),inset_0_-1px_0_rgba(0,0,0,0.18)] transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.2,0.8,0.2,1)] sm:rounded-xl",
										activeMarketplaceTabIndex < 0 && "opacity-0",
									)}
									style={{
										transform: `translateX(${Math.max(activeMarketplaceTabIndex, 0) * 100}%)`,
									}}
								/>
								{MARKETPLACE_TABS.map((tab) => (
									<SegmentedTabButton
										key={tab.key}
										active={activeTab === tab.key}
										onClick={() => selectMarketplaceTab(tab.key)}
									>
										<span>{tab.label}</span>
										{tab.key === "all" ? null : (
											<TabCountBadge
												active={activeTab === tab.key}
												count={listingCounts[tab.key]}
											/>
										)}
									</SegmentedTabButton>
								))}
							</div>
							<div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-1.5 sm:flex sm:shrink-0">
								<Button
									type="button"
									variant="outline"
									size="sm"
									aria-label={sortListingsButtonLabel}
									title={sortListingsButtonLabel}
									onClick={toggleListingSortDirection}
									className={cn(
										"h-9 w-9 border-border/65 bg-background/48 p-0 text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] backdrop-blur-xl",
										CONTROL_TRANSITION,
										"hover:border-foreground/20 hover:bg-background/70 hover:text-foreground",
									)}
								>
									{listingSortDirection === "newest" ? (
										<SortDesc className="h-3.5 w-3.5" />
									) : (
										<SortAsc className="h-3.5 w-3.5" />
									)}
								</Button>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={toggleMyActivityTab}
									className={cn(
										"h-9 border-border/65 bg-background/48 px-2.5 text-xs text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.42)] backdrop-blur-xl sm:px-3 sm:text-sm",
										CONTROL_TRANSITION,
										activeTab === "mine"
											? "border-foreground/18 bg-foreground/8 text-foreground shadow-[0_12px_28px_-24px_rgba(20,16,12,0.76),inset_0_1px_0_rgba(255,255,255,0.58)]"
											: "hover:border-foreground/20 hover:bg-background/70 hover:text-foreground",
									)}
								>
									<ListChecks className="h-3.5 w-3.5" />
									<span>My activity</span>
									{listingCounts.mine > 0 ? (
										<TabCountBadge
											active={activeTab === "mine"}
											count={listingCounts.mine}
											tone="subtle"
										/>
									) : null}
								</Button>
								<Button
									id="ticket-exchange-board-post-button"
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
					</div>
					{(data.isAuthenticated || auth.isAuthenticated) &&
						data.profile &&
						!hasAcceptedCurrentAgreement(data.profile) && (
							<div className="rounded-xl border border-amber-500/25 bg-amber-500/8 px-3 py-2 text-sm text-muted-foreground">
								<span className="font-medium text-foreground">
									Safety agreement required.
								</span>{" "}
								Accept it once before posting or sharing contact details.{" "}
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
							<p className="mt-3 font-medium">{emptyListingCopy.title}</p>
							<p className="mt-1 text-sm text-muted-foreground">
								{emptyListingCopy.body}
							</p>
							<Button
								type="button"
								onClick={openEmptyStateListing}
								className="mt-4"
							>
								<Plus className="h-4 w-4" />
								{emptyListingCopy.cta}
							</Button>
						</div>
					) : (
						<div className="grid gap-3">
							{visibleListings.map((listing) => (
								<ListingCard
									key={listing.id}
									listing={listing}
									isReplyTourTarget={listing.id === firstReplyTourListingId}
									profile={data.profile}
									isAuthenticated={data.isAuthenticated || auth.isAuthenticated}
									contactMethodCount={draftContactMethodCount}
									onLogin={() => setIsLoginOpen(true)}
									onAgreementOpen={() => openAgreement(null)}
									onContactDetailsOpen={focusContactDetailsForReply}
									onInterest={handleInterest}
									onStatus={handleStatus}
									onReport={(id) => {
										trackTicketExchangeAnalytics({
											actionType: "report_open",
											eventKey: listing.eventKey,
											listingId: id,
											listingType: listing.listingType,
											listingStatus: listing.effectiveStatus,
											surface: "report_modal",
										});
										setReportListingId(id);
									}}
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
						<div className="sticky bottom-0 -mx-1 flex justify-stretch bg-card/95 px-1 pt-2 pb-1 backdrop-blur sm:justify-end">
							<Button
								type="button"
								className="w-full sm:w-auto"
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
			{selectedModalEvent && TicketExchangeEventModalIsland && (
				<TicketExchangeEventModalIsland
					event={selectedModalEvent}
					isAuthenticated={data.isAuthenticated || auth.isAuthenticated}
					isRequestUpdateOpen={isEventUpdateOpen}
					onClose={() => {
						setSelectedModalEvent(null);
						setIsEventUpdateOpen(false);
					}}
					onRequestUpdateOpenChange={setIsEventUpdateOpen}
					seriesEvents={selectedModalSeriesEvents}
					onNavigateSeriesEvent={setSelectedModalEvent}
				/>
			)}
			<TicketExchangeTour selectedEventKey={selectedEventKey} />
		</div>
	);
}

function Field({
	label,
	children,
	className,
	error,
	errorId,
}: {
	label: string;
	children: ReactNode;
	className?: string;
	error?: string | null;
	errorId?: string;
}) {
	return (
		<label className={cn("grid gap-1.5 text-sm", className)}>
			<span className="font-medium text-foreground">{label}</span>
			{children}
			{error ? (
				<span
					id={errorId}
					className="text-xs font-medium leading-5 text-destructive"
				>
					{error}
				</span>
			) : null}
		</label>
	);
}

function HandleInput({
	id,
	value,
	onChange,
	invalid = false,
	describedBy,
}: {
	id?: string;
	value: string;
	onChange: (value: string) => void;
	invalid?: boolean;
	describedBy?: string;
}) {
	return (
		<div
			className={cn(
				"flex h-8 max-w-full min-w-0 items-center rounded-lg border border-input bg-transparent transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30",
				invalid &&
					"border-destructive focus-within:border-destructive focus-within:ring-destructive/20",
			)}
		>
			<span
				aria-hidden="true"
				className="shrink-0 pl-2.5 text-base text-muted-foreground md:text-sm"
			>
				@
			</span>
			<input
				id={id}
				autoCapitalize="none"
				autoCorrect="off"
				className="h-full min-w-0 flex-1 bg-transparent px-1.5 py-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
				placeholder="handle"
				value={value.replace(/^@+/, "")}
				aria-invalid={invalid}
				aria-describedby={describedBy}
				onChange={(event) => onChange(event.target.value.replace(/^@+/, ""))}
			/>
		</div>
	);
}

function SegmentedTabButton({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: ReactNode;
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			onClick={onClick}
			className={cn(
				"relative z-10 inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-1 sm:min-h-9 sm:rounded-xl sm:px-4 sm:text-sm",
				CONTROL_TRANSITION,
				active
					? "text-primary-foreground"
					: "text-muted-foreground hover:text-foreground",
			)}
		>
			{children}
		</button>
	);
}

function TabCountBadge({
	active,
	count,
	tone = "segmented",
}: {
	active: boolean;
	count: number;
	tone?: "segmented" | "subtle";
}) {
	return (
		<span
			className={cn(
				"inline-flex h-4 min-w-4 items-center justify-center rounded-full border px-1 text-[10px] leading-none tabular-nums sm:h-5 sm:min-w-5 sm:px-1.5 sm:text-[11px]",
				active && tone === "segmented"
					? "border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground"
					: active
						? "border-foreground/15 bg-foreground/10 text-foreground"
						: "border-border/70 bg-background/55 text-muted-foreground",
			)}
		>
			{count}
		</span>
	);
}

function ContactReadinessBadge({
	count,
	ready,
}: {
	count: number;
	ready: boolean;
}) {
	const label = ready
		? "Ready"
		: `${count}/${TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT}`;
	return (
		<span
			className={cn(
				"ml-0.5 inline-flex h-5 items-center rounded-full border px-1.5 text-[11px] font-medium leading-none",
				ready
					? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
					: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200",
			)}
			title={
				ready
					? "Contact details are ready for Ticket Exchange."
					: "Add one backup contact method before listing or replying."
			}
		>
			{label}
		</span>
	);
}

function ContactMethodPicker({
	profile,
	value,
	onChange,
	onUnavailableMethodRequest,
}: {
	profile: TicketExchangeContactProfile | null;
	value: TicketExchangeContactMethod[];
	onChange: (value: TicketExchangeContactMethod[]) => void;
	onUnavailableMethodRequest: (method: TicketExchangeContactMethod) => void;
}) {
	const [promptedMethod, setPromptedMethod] =
		useState<TicketExchangeContactMethod | null>(null);

	useEffect(() => {
		if (!promptedMethod || !hasContact(profile, promptedMethod)) return;
		setPromptedMethod(null);
	}, [profile, promptedMethod]);

	return (
		<div className="grid gap-2">
			<div className="flex flex-wrap gap-2">
				{TICKET_EXCHANGE_CONTACT_METHODS.map((method) => {
					const available = hasContact(profile, method);
					const selected = value.includes(method);
					const isPrompted = promptedMethod === method;
					return (
						<button
							key={method}
							type="button"
							onClick={() => {
								if (available) {
									setPromptedMethod(null);
									onChange(toggleMethod(value, method));
									return;
								}
								if (isPrompted) {
									onUnavailableMethodRequest(method);
									setPromptedMethod(null);
									return;
								}
								setPromptedMethod(method);
							}}
							className={cn(
								"rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
								selected
									? "border-primary bg-primary text-primary-foreground"
									: "border-border bg-background/60",
								!available &&
									"border-dashed text-muted-foreground opacity-65 hover:border-primary/40 hover:bg-accent hover:text-foreground",
								isPrompted &&
									"border-amber-500/60 bg-amber-500/10 text-amber-900 opacity-100 dark:text-amber-100",
							)}
							title={
								available
									? undefined
									: "Add this detail to use this option. Click again to edit contact details."
							}
						>
							{methodLabels[method]}
						</button>
					);
				})}
			</div>
			{promptedMethod ? (
				<div className="rounded-lg border border-amber-500/35 bg-amber-500/10 px-2.5 py-2 text-xs leading-5 text-amber-900 dark:text-amber-100">
					Add {methodLabels[promptedMethod]} to use this option. Click{" "}
					{methodLabels[promptedMethod]} again to edit contact details. Your
					listing draft stays here.
				</div>
			) : (
				<p className="text-xs text-muted-foreground">
					Choose at least {TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT}. Grey
					options need adding to your contact details first.
				</p>
			)}
		</div>
	);
}

function ListingCard({
	listing,
	profile,
	isAuthenticated,
	contactMethodCount,
	onLogin,
	onAgreementOpen,
	onContactDetailsOpen,
	onInterest,
	onStatus,
	onReport,
	onEventOpen,
	onRepost,
	busyInterestId,
	busyStatusId,
	isReplyTourTarget = false,
}: {
	listing: TicketExchangeListingView;
	profile: TicketExchangeContactProfile | null;
	isAuthenticated: boolean;
	contactMethodCount: number;
	onLogin: () => void;
	onAgreementOpen: () => void;
	onContactDetailsOpen: () => void;
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
	isReplyTourTarget?: boolean;
}) {
	const contactEntries = visibleContactEntries(listing.contactSnapshot);
	const isInterestBusy = busyInterestId === listing.id;
	const isStatusBusy = busyStatusId === listing.id;
	const listingTitle = formatListingQuantityTitle(listing);
	const statusLabel = getListingStatusLabel(listing);
	const isActiveListing = listing.effectiveStatus === "active";
	const isClosedListing = listing.effectiveStatus !== "active";
	const canOwnerManageLifecycle =
		listing.status === "active" || listing.status === "paused";
	const canOwnerRepost =
		listing.effectiveStatus === "expired" ||
		listing.effectiveStatus === "resolved";
	const canViewerReply =
		isActiveListing && !listing.isOwner && !listing.myInterest;
	const listingModeLabel =
		listing.listingType === "selling" ? "Selling" : "Looking";
	const quantityLabel =
		listing.listingType === "selling" ? "Available" : "Needed";
	const priceModeLabel = listing.listingType === "selling" ? "Price" : "Budget";
	const hasAgreement = hasAcceptedCurrentAgreement(profile);
	const hasContactSetup =
		contactMethodCount >= TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT;
	const replyNoun = listing.listingType === "selling" ? "buyer" : "seller";
	const firstReplyCta =
		listing.listingType === "selling" ? "I want to buy" : "I can sell";
	const replyRequirementText = !isAuthenticated
		? "Sign in to reply."
		: !hasAgreement && !hasContactSetup
			? "First: accept the rules, then add one backup contact method."
			: !hasAgreement
				? "First: accept the Ticket Exchange rules."
				: !hasContactSetup
					? "First: add one backup contact method in Contact details."
					: "This shares your contact details, then reveals theirs.";
	const resolvedActionLabel =
		listing.listingType === "selling" ? "Mark sold" : "Mark found";
	const closedListingTextClassName = isClosedListing
		? "text-muted-foreground/70"
		: "text-foreground";
	const setupLinkClassName =
		"font-medium text-foreground underline underline-offset-4 hover:text-primary";
	const contactSetupButton = (
		<button
			type="button"
			onClick={onContactDetailsOpen}
			className={setupLinkClassName}
		>
			add one backup contact method
		</button>
	);
	const replyRequirementNote = () => {
		if (!isAuthenticated) {
			return "Sign in to reply.";
		}
		if (!hasAgreement && !hasContactSetup) {
			return (
				<>
					First:{" "}
					<button
						type="button"
						onClick={onAgreementOpen}
						className={setupLinkClassName}
					>
						accept the rules
					</button>{" "}
					and then {contactSetupButton}.
				</>
			);
		}
		if (!hasAgreement) {
			return (
				<>
					First:{" "}
					<button
						type="button"
						onClick={onAgreementOpen}
						className={setupLinkClassName}
					>
						accept the Ticket Exchange rules
					</button>
					.
				</>
			);
		}
		if (!hasContactSetup) {
			return <>First: {contactSetupButton}.</>;
		}
		return "This shares your contact details, then reveals theirs.";
	};
	const startReplyFlow = () => {
		if (!canViewerReply) return;
		if (!isAuthenticated) {
			onLogin();
			return;
		}
		onInterest(listing);
	};
	return (
		<article
			className={cn(
				"relative overflow-hidden rounded-xl border p-4 shadow-sm transition-colors sm:p-5",
				isClosedListing
					? "border-border/35 bg-muted/18 text-muted-foreground shadow-none opacity-65 grayscale-[0.25]"
					: listing.isOwner
						? "border-foreground/18 bg-[linear-gradient(90deg,rgba(20,16,12,0.045),transparent_20%),hsl(var(--card)/0.86)]"
						: listing.listingType === "selling"
							? "border-emerald-500/18 bg-[linear-gradient(90deg,rgba(16,185,129,0.045),transparent_18%),hsl(var(--card)/0.82)]"
							: "border-sky-500/18 bg-[linear-gradient(90deg,rgba(14,165,233,0.045),transparent_18%),hsl(var(--card)/0.82)]",
			)}
		>
			{!isClosedListing ? (
				<span
					aria-hidden="true"
					className={cn(
						"absolute top-4 bottom-4 left-0 w-1 rounded-r-full",
						listing.listingType === "selling"
							? "bg-emerald-500/45"
							: "bg-sky-500/45",
					)}
				/>
			) : null}
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-center gap-2">
						<Badge
							className={cn(
								"shadow-none",
								isClosedListing
									? "border border-border/40 bg-background/20 text-muted-foreground/65"
									: listing.listingType === "selling"
										? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-100"
										: "border border-sky-500/25 bg-sky-500/10 text-sky-800 dark:text-sky-100",
							)}
						>
							{listingModeLabel}
						</Badge>
						<Badge
							variant="outline"
							className={cn(
								"capitalize",
								isClosedListing &&
									"border-border/60 bg-background/35 text-muted-foreground",
							)}
						>
							{statusLabel}
						</Badge>
						{listing.isOwner ? (
							<Badge
								variant="outline"
								className="border-foreground/15 bg-background/45 text-foreground/75 shadow-none"
							>
								Your listing
							</Badge>
						) : null}
					</div>
					<button
						type="button"
						onClick={() => onEventOpen(listing)}
						className={cn(
							"mt-2 block max-w-full text-left text-lg font-semibold leading-tight underline-offset-4 hover:underline sm:text-xl",
							closedListingTextClassName,
						)}
					>
						<span className="line-clamp-2">{listing.eventName}</span>
					</button>
				</div>
				<Button
					type="button"
					variant="link"
					onClick={() => onEventOpen(listing)}
					className="mt-0.5 h-auto shrink-0 px-0 py-0 text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground"
				>
					Event details
					<ArrowUpRight className="h-3.5 w-3.5" />
				</Button>
			</div>

			<div className="mt-5 space-y-3">
				<div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
					<div className="min-w-0">
						<p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
							{quantityLabel}
						</p>
						<p
							className={cn(
								"mt-1 text-2xl font-semibold leading-tight tracking-normal sm:text-3xl",
								closedListingTextClassName,
							)}
						>
							{listingTitle}
						</p>
					</div>
					<div className="flex flex-wrap gap-2 sm:justify-end">
						{listing.priceLabel ? (
							<div
								className={cn(
									"rounded-full border px-3 py-1.5",
									isClosedListing
										? "border-border/35 bg-background/20 text-muted-foreground/70"
										: "border-border/70 bg-background/45",
								)}
							>
								<span className="mr-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
									{priceModeLabel}
								</span>
								<span className="text-sm font-semibold">
									{listing.priceLabel}
								</span>
							</div>
						) : null}
					</div>
				</div>
				{listing.note && (
					<p className="max-w-2xl text-sm leading-6 text-muted-foreground">
						{listing.note}
					</p>
				)}
				<div className="text-sm text-muted-foreground">
					<span>
						{isClosedListing
							? "This listing is no longer active."
							: "Confirm availability directly before sending money."}
					</span>
				</div>
			</div>

			<div
				className={cn(
					"mt-5 grid gap-4 border-y py-4 sm:grid-cols-[0.75fr_1.25fr]",
					isClosedListing ? "border-border/35" : "border-border/70",
				)}
			>
				<div className="min-w-0">
					<p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
						<Clock className="h-3.5 w-3.5" />
						Replies
					</p>
					<p className="mt-1 text-base">
						<span className="font-semibold">{listing.interestCount}</span>{" "}
						{listing.interestCount === 1
							? `${replyNoun} replied`
							: `${replyNoun}s replied`}
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
									onClick={() =>
										trackTicketExchangeAnalytics({
											actionType: "contact_link_click",
											eventKey: listing.eventKey,
											listingId: listing.id,
											listingType: listing.listingType,
											listingStatus: listing.effectiveStatus,
											surface: "listing_card",
											detail: entry.label.toLowerCase(),
											immediate: true,
										})
									}
									className={cn(
										"inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium underline-offset-4 hover:underline",
										isClosedListing
											? "border-border/35 bg-background/25 text-muted-foreground/70"
											: "border-border/70 bg-background/60",
									)}
								>
									{contactIconFor(entry.label)}
									<span className="truncate">{entry.value}</span>
								</a>
							))}
						</div>
					) : (
						<button
							type="button"
							disabled={!canViewerReply || isInterestBusy}
							onClick={startReplyFlow}
							className={cn(
								"mt-1 block w-full rounded-lg border border-dashed border-border/60 bg-background/35 px-3 py-2 text-left text-sm text-muted-foreground transition-colors",
								canViewerReply
									? "hover:border-primary/45 hover:bg-accent hover:text-foreground"
									: "disabled:cursor-not-allowed disabled:opacity-70",
							)}
						>
							Available after you reply to this listing.
						</button>
					)}
				</div>
			</div>

			<div className="mt-4 flex flex-wrap items-center gap-2">
				{listing.isOwner ? (
					<>
						{canOwnerManageLifecycle && (
							<>
								<Button
									type="button"
									variant="outline"
									size="sm"
									disabled={isStatusBusy}
									onClick={() => onStatus(listing, "resolved")}
								>
									<Check className="h-3.5 w-3.5" />
									{resolvedActionLabel}
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
						)}
						{canOwnerRepost && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								onClick={() => onRepost(listing)}
								className={!canOwnerManageLifecycle ? "ml-auto" : undefined}
							>
								<RefreshCw className="h-3.5 w-3.5" />
								Repost
							</Button>
						)}
					</>
				) : (
					<>
						{isActiveListing ? (
							<div className="min-w-[13rem] max-w-full">
								{listing.myInterest ? (
									<div className="flex flex-wrap items-center gap-2">
										<span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
											<Check className="h-3.5 w-3.5" />
											Contact details shown
										</span>
									</div>
								) : (
									<Button
										id={
											isReplyTourTarget
												? "ticket-exchange-first-reply-button"
												: undefined
										}
										type="button"
										size="sm"
										disabled={isInterestBusy}
										className={TICKET_EXCHANGE_SQUIRCLE_BUTTON_CLASS}
										title={
											isAuthenticated && (!hasAgreement || !hasContactSetup)
												? replyRequirementText
												: undefined
										}
										onClick={() => {
											startReplyFlow();
										}}
									>
										<Eye className="h-3.5 w-3.5" />
										{isInterestBusy ? "Sharing..." : firstReplyCta}
									</Button>
								)}
								{!listing.myInterest && (
									<p className="mt-1 text-[11px] leading-4 text-muted-foreground">
										{replyRequirementNote()} You can view contact details for up
										to {TICKET_EXCHANGE_MAX_ACTIVE_INTERESTS_PER_USER} active
										listings.
									</p>
								)}
							</div>
						) : (
							<Badge
								variant="outline"
								className="h-8 rounded-full border-border/60 bg-background/35 px-3 text-xs text-muted-foreground"
							>
								{statusLabel}
							</Badge>
						)}
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
							className={cn("ml-auto", TICKET_EXCHANGE_SQUIRCLE_BUTTON_CLASS)}
						>
							<Flag className="h-3.5 w-3.5" />
							Report
						</Button>
					</>
				)}
			</div>

			{listing.isOwner && listing.interests.length > 0 && (
				<div
					className={cn(
						"mt-3 rounded-xl border p-3",
						isClosedListing
							? "border-border/35 bg-background/20"
							: "border-border/60 bg-background/45",
					)}
				>
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
												onClick={() =>
													trackTicketExchangeAnalytics({
														actionType: "contact_link_click",
														eventKey: listing.eventKey,
														listingId: listing.id,
														listingType: listing.listingType,
														listingStatus: listing.effectiveStatus,
														surface: "listing_card",
														detail: `owner:${entry.label.toLowerCase()}`,
														immediate: true,
													})
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
	closeOnOutsideClick = true,
}: {
	title: string;
	children: React.ReactNode;
	onClose: () => void;
	closeOnOutsideClick?: boolean;
}) {
	useEffect(() => {
		setBodyOverlayAttribute(OVERLAY_BODY_ATTRIBUTE.TICKET_EXCHANGE_MODAL, true);

		return () => {
			setBodyOverlayAttribute(
				OVERLAY_BODY_ATTRIBUTE.TICKET_EXCHANGE_MODAL,
				false,
			);
		};
	}, []);

	return (
		<div
			className="fixed inset-x-0 top-0 z-[120] flex h-dvh items-end justify-center bg-black/40 px-3 pt-[max(env(safe-area-inset-top),0.75rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)] sm:items-center sm:p-4"
			onMouseDown={(event) => {
				if (closeOnOutsideClick && event.target === event.currentTarget) {
					onClose();
				}
			}}
		>
			<div
				className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-2xl"
				role="dialog"
				aria-modal="true"
				aria-label={title}
			>
				<div className="mb-3 flex shrink-0 items-center justify-between">
					<h2 className="text-lg font-semibold">{title}</h2>
					<Button type="button" variant="ghost" size="icon" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<div className="min-h-0 overflow-y-auto overscroll-contain px-1 pb-1">
					{children}
				</div>
			</div>
		</div>
	);
}
