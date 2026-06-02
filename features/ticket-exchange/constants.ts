import type {
	TicketExchangeContactMethod,
	TicketExchangeReportReason,
} from "./types";

export const TICKET_EXCHANGE_RULES_VERSION = "2026-06-01";
export const TICKET_EXCHANGE_DEFAULT_EXPIRY_HOURS = 24;
export const TICKET_EXCHANGE_MAX_EXPIRY_HOURS = 72;
export const TICKET_EXCHANGE_CONTACT_REVEAL_GRACE_HOURS = 24;
export const TICKET_EXCHANGE_REQUIRED_CONTACT_METHOD_COUNT = 2;
export const TICKET_EXCHANGE_MAX_ACTIVE_INTERESTS_PER_USER = 3;
export const TICKET_EXCHANGE_INTEREST_LOCK_MINUTES = 60;
export const TICKET_EXCHANGE_MAX_DAILY_UNLOCKS_PER_USER = 8;
export const TICKET_EXCHANGE_PUBLIC_RESOLVED_TOMBSTONE_MINUTES = 60;

export const TICKET_EXCHANGE_CONTACT_METHODS = [
	"email",
	"whatsapp",
	"instagram",
	"x",
] as const satisfies readonly TicketExchangeContactMethod[];

export const TICKET_EXCHANGE_REPORT_REASONS = [
	"scam",
	"wrong_event",
	"misleading_price",
	"abusive_contact",
	"spam",
	"other",
] as const satisfies readonly TicketExchangeReportReason[];

export const TICKET_EXCHANGE_RULES_COPY = [
	"OOOC does not sell, verify, transfer, hold, or guarantee tickets.",
	"Ticket Exchange only helps people find and contact each other.",
	"Any payment, transfer, refund, or dispute is handled directly between users.",
	"Use official ticket transfer tools where possible and do your own checks before sending money.",
] as const;

export const TICKET_EXCHANGE_SCAM_TIPS = [
	"Do not rely on screenshots alone as proof.",
	"Use official ticket transfer links where possible.",
	"Double check ticket date, event, platform, and account details.",
	"Be wary of urgency or odd payment requests.",
	"Do not share login or verification codes.",
	"Prefer payment methods with buyer protection.",
	"Report suspicious listings.",
] as const;

export const TICKET_EXCHANGE_EXPIRY_OPTIONS = [
	{ label: "1 hour", hours: 1 },
	{ label: "3 hours", hours: 3 },
	{ label: "6 hours", hours: 6 },
	{ label: "24 hours", hours: 24 },
	{ label: "36 hours", hours: 36 },
	{ label: "48 hours", hours: 48 },
	{ label: "72 hours", hours: 72 },
] as const;
