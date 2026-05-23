const DEFAULT_SITE_URL = "http://localhost:3000";

export const normalizeBasePath = (value = ""): string => {
	if (!value || value === "/") return "";
	return value.endsWith("/") ? value.slice(0, -1) : value;
};

export const getSiteUrl = (): string =>
	(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, "");

export const getBasePath = (): string =>
	normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || "");

export const buildSiteUrl = (path = "/"): string => {
	const pathname = path.startsWith("/") ? path : `/${path}`;
	if (pathname === "/" && !getBasePath()) return getSiteUrl();
	return new URL(`${getBasePath()}${pathname}`, `${getSiteUrl()}/`).toString();
};
