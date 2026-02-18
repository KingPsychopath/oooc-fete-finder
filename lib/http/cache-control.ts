export const NO_STORE_HEADERS = Object.freeze({
	"Cache-Control":
		"private, no-store, no-cache, max-age=0, must-revalidate, proxy-revalidate",
	Pragma: "no-cache",
	Expires: "0",
});
