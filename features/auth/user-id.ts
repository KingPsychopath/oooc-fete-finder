import { randomBytes } from "crypto";

export const UUID_V7_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const byteToHex = Array.from({ length: 256 }, (_, index) =>
	index.toString(16).padStart(2, "0"),
);

export const generateUserId = (): string => {
	const timestamp = Date.now();
	const bytes = randomBytes(16);

	bytes[0] = Math.floor(timestamp / 2 ** 40) & 0xff;
	bytes[1] = Math.floor(timestamp / 2 ** 32) & 0xff;
	bytes[2] = Math.floor(timestamp / 2 ** 24) & 0xff;
	bytes[3] = Math.floor(timestamp / 2 ** 16) & 0xff;
	bytes[4] = Math.floor(timestamp / 2 ** 8) & 0xff;
	bytes[5] = timestamp & 0xff;
	bytes[6] = (bytes[6] & 0x0f) | 0x70;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = Array.from(bytes, (byte) => byteToHex[byte]).join("");
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const isValidUserId = (value: string | null | undefined): boolean =>
	typeof value === "string" && UUID_V7_PATTERN.test(value);
