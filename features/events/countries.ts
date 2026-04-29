export interface CountryOption {
	code: string;
	isoCode: string;
	label: string;
	flag: string;
	searchText: string;
}

const ISO_COUNTRY_CODES = [
	"AD",
	"AE",
	"AF",
	"AG",
	"AI",
	"AL",
	"AM",
	"AO",
	"AQ",
	"AR",
	"AS",
	"AT",
	"AU",
	"AW",
	"AX",
	"AZ",
	"BA",
	"BB",
	"BD",
	"BE",
	"BF",
	"BG",
	"BH",
	"BI",
	"BJ",
	"BL",
	"BM",
	"BN",
	"BO",
	"BQ",
	"BR",
	"BS",
	"BT",
	"BV",
	"BW",
	"BY",
	"BZ",
	"CA",
	"CC",
	"CD",
	"CF",
	"CG",
	"CH",
	"CI",
	"CK",
	"CL",
	"CM",
	"CN",
	"CO",
	"CR",
	"CU",
	"CV",
	"CW",
	"CX",
	"CY",
	"CZ",
	"DE",
	"DJ",
	"DK",
	"DM",
	"DO",
	"DZ",
	"EC",
	"EE",
	"EG",
	"EH",
	"ER",
	"ES",
	"ET",
	"FI",
	"FJ",
	"FK",
	"FM",
	"FO",
	"FR",
	"GA",
	"GB",
	"GD",
	"GE",
	"GF",
	"GG",
	"GH",
	"GI",
	"GL",
	"GM",
	"GN",
	"GP",
	"GQ",
	"GR",
	"GS",
	"GT",
	"GU",
	"GW",
	"GY",
	"HK",
	"HM",
	"HN",
	"HR",
	"HT",
	"HU",
	"ID",
	"IE",
	"IL",
	"IM",
	"IN",
	"IO",
	"IQ",
	"IR",
	"IS",
	"IT",
	"JE",
	"JM",
	"JO",
	"JP",
	"KE",
	"KG",
	"KH",
	"KI",
	"KM",
	"KN",
	"KP",
	"KR",
	"KW",
	"KY",
	"KZ",
	"LA",
	"LB",
	"LC",
	"LI",
	"LK",
	"LR",
	"LS",
	"LT",
	"LU",
	"LV",
	"LY",
	"MA",
	"MC",
	"MD",
	"ME",
	"MF",
	"MG",
	"MH",
	"MK",
	"ML",
	"MM",
	"MN",
	"MO",
	"MP",
	"MQ",
	"MR",
	"MS",
	"MT",
	"MU",
	"MV",
	"MW",
	"MX",
	"MY",
	"MZ",
	"NA",
	"NC",
	"NE",
	"NF",
	"NG",
	"NI",
	"NL",
	"NO",
	"NP",
	"NR",
	"NU",
	"NZ",
	"OM",
	"PA",
	"PE",
	"PF",
	"PG",
	"PH",
	"PK",
	"PL",
	"PM",
	"PN",
	"PR",
	"PS",
	"PT",
	"PW",
	"PY",
	"QA",
	"RE",
	"RO",
	"RS",
	"RU",
	"RW",
	"SA",
	"SB",
	"SC",
	"SD",
	"SE",
	"SG",
	"SH",
	"SI",
	"SJ",
	"SK",
	"SL",
	"SM",
	"SN",
	"SO",
	"SR",
	"SS",
	"ST",
	"SV",
	"SX",
	"SY",
	"SZ",
	"TC",
	"TD",
	"TF",
	"TG",
	"TH",
	"TJ",
	"TK",
	"TL",
	"TM",
	"TN",
	"TO",
	"TR",
	"TT",
	"TV",
	"TW",
	"TZ",
	"UA",
	"UG",
	"UM",
	"US",
	"UY",
	"UZ",
	"VA",
	"VC",
	"VE",
	"VG",
	"VI",
	"VN",
	"VU",
	"WF",
	"WS",
	"YE",
	"YT",
	"ZA",
	"ZM",
	"ZW",
] as const;

const COUNTRY_ALIASES: Record<string, string[]> = {
	BR: ["brazilian"],
	CA: ["canadian"],
	DE: ["german"],
	ES: ["spanish"],
	FR: ["french"],
	GB: ["britain", "british", "england", "english", "uk", "united kingdom"],
	IE: ["irish"],
	IT: ["italian"],
	JM: ["jamaican"],
	NG: ["nigerian"],
	NL: ["dutch", "netherlands"],
	PT: ["portuguese"],
	TT: ["trinidad", "trinidadian"],
	US: ["america", "american", "usa", "united states"],
};

const displayNames = new Intl.DisplayNames(["en"], { type: "region" });

const normalizeSearchText = (value: string): string =>
	value
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
		.trim();

const isoToCanonicalCode = (isoCode: string): string =>
	isoCode === "GB" ? "UK" : isoCode;

export const canonicalCodeToIsoCode = (code: string): string => {
	const upper = code.trim().toUpperCase();
	return upper === "UK" ? "GB" : upper;
};

export const flagForIsoCode = (isoCode: string): string =>
	Array.from(canonicalCodeToIsoCode(isoCode))
		.map((char) =>
			String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - "A".charCodeAt(0)),
		)
		.join("");

export const COUNTRY_OPTIONS: CountryOption[] = ISO_COUNTRY_CODES.map(
	(isoCode) => {
		const label = displayNames.of(isoCode) ?? isoCode;
		const code = isoToCanonicalCode(isoCode);
		const aliases = COUNTRY_ALIASES[isoCode] ?? [];
		return {
			code,
			isoCode,
			label,
			flag: flagForIsoCode(isoCode),
			searchText: normalizeSearchText(
				[code, isoCode, label, ...aliases].join(" "),
			),
		};
	},
).sort((left, right) => left.label.localeCompare(right.label));

export const COUNTRY_CODES = COUNTRY_OPTIONS.map((country) => country.code);

const COUNTRY_BY_CODE = new Map(
	COUNTRY_OPTIONS.flatMap((country) => [
		[country.code, country],
		[country.isoCode, country],
	]),
);

export const getCountryOption = (code: string): CountryOption | null =>
	COUNTRY_BY_CODE.get(canonicalCodeToIsoCode(code)) ??
	COUNTRY_BY_CODE.get(code.trim().toUpperCase()) ??
	null;

export const findCountryByText = (value: string): CountryOption | null => {
	const normalized = normalizeSearchText(value);
	if (!normalized) return null;
	return (
		COUNTRY_OPTIONS.find((country) =>
			[country.code, country.isoCode].includes(value.trim().toUpperCase()),
		) ??
		COUNTRY_OPTIONS.find((country) =>
			country.searchText.split(" ").includes(normalized),
		) ??
		COUNTRY_OPTIONS.find(
			(country) => normalizeSearchText(country.label) === normalized,
		) ??
		null
	);
};

export const filterCountryOptions = (
	query: string,
	limit = 8,
): CountryOption[] => {
	const normalized = normalizeSearchText(query);
	if (!normalized) return COUNTRY_OPTIONS.slice(0, limit);
	return COUNTRY_OPTIONS.filter((country) =>
		country.searchText.includes(normalized),
	).slice(0, limit);
};
