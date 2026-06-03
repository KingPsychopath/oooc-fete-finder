import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const OUT_DIR = path.join(process.cwd(), "public", "og");

const presets = {
	home: {
		label: "Event Guide",
		title: "Fête Finder",
		subtitle: "Curated Paris music events by Out Of Office Collective.",
		accent: "#9a362f",
		chips: ["Paris", "Music picks", "Route planning"],
	},
	"how-it-works": {
		label: "How It Works",
		title: "Plan the night without the spreadsheet",
		subtitle: "Find events, filter by vibe, save your route, and share it.",
		accent: "#176b65",
		chips: ["Discover", "Filter", "Share"],
	},
	privacy: {
		label: "Privacy",
		title: "Clear data rules for Fête Finder",
		subtitle: "How attendee, host, and partner information is handled.",
		accent: "#5a4f8f",
		chips: ["Noindex pages", "Consent first", "OOOC data"],
	},
	"submit-event": {
		label: "Host Submission",
		title: "Submit your event",
		subtitle: "Send the essentials for OOOC review and publication.",
		accent: "#2f7652",
		chips: ["Hosts", "Review", "Listing"],
	},
	"feature-event": {
		label: "Partner Placements",
		title: "Partner with OOOC",
		titleLines: ["Partner with", "OOOC"],
		subtitle: "Spotlight and promoted placements for Fête de la Musique.",
		accent: "#a35f26",
		chips: ["Spotlight", "Promoted", "Community"],
	},
	"partner-success": {
		label: "Payment Confirmed",
		title: "You are in the activation queue",
		subtitle: "The OOOC team will review and activate your placement.",
		accent: "#24725b",
		chips: ["Received", "Queued", "Activation"],
	},
	"partner-performance-report": {
		label: "Private Report",
		title: "Partner performance report",
		subtitle: "Private campaign metrics for OOOC placements.",
		accent: "#2f657d",
		chips: ["Private", "Reach", "Clicks"],
	},
	"social-assets": {
		label: "Social Assets",
		title: "Fête Finder social assets",
		subtitle: "Private branded export routes for OOOC creative assets.",
		accent: "#754f88",
		chips: ["Story", "Square", "Twitter"],
	},
};

const escapeXml = (value) =>
	value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

const wrapText = (value, maxChars, maxLines) => {
	const words = value.split(/\s+/).filter(Boolean);
	const lines = [];
	let current = "";

	for (const word of words) {
		const next = current ? `${current} ${word}` : word;
		if (next.length > maxChars && current) {
			lines.push(current);
			current = word;
			continue;
		}
		current = next;
	}

	if (current) lines.push(current);

	const visible = lines.slice(0, maxLines);
	if (lines.length > maxLines) {
		visible[visible.length - 1] = `${visible[visible.length - 1].replace(
			/[.,;:!?]+$/,
			"",
		)}...`;
	}
	return visible;
};

const getTitleLayout = (title, forcedLines) => {
	if (Array.isArray(forcedLines) && forcedLines.length > 0) {
		return {
			lines: forcedLines,
			size: forcedLines.length === 1 ? 82 : 78,
			lineHeight: 76,
		};
	}

	for (const candidate of [
		{ maxChars: 18, size: 82, maxLines: 2 },
		{ maxChars: 20, size: 74, maxLines: 2 },
		{ maxChars: 22, size: 66, maxLines: 2 },
	]) {
		const lines = wrapText(title, candidate.maxChars, candidate.maxLines);
		if (lines.join(" ").replace(/\.\.\.$/, "") === title) {
			return {
				lines,
				size: title.length <= 14 && lines.length === 1 ? 104 : candidate.size,
				lineHeight: candidate.size * 0.98,
			};
		}
	}

	return {
		lines: wrapText(title, 22, 2),
		size: 66,
		lineHeight: 64,
	};
};

const renderTextLines = ({ lines, x, startY, className, fontSize, lineHeight }) =>
	lines
		.map(
			(line, index) =>
				`<text x="${x}" y="${
					startY + index * lineHeight
				}" class="${className}" font-size="${fontSize}">${escapeXml(
					line,
				)}</text>`,
		)
		.join("");

const renderMetaRow = (items, accent) => {
	const columns = items.slice(0, 3);
	return `<g transform="translate(86 492)">
	<line x1="0" y1="0" x2="540" y2="0" stroke="${accent}" stroke-opacity="0.5" stroke-width="2"/>
	${columns
		.map((item, index) => {
			const x = index * 180;
			return `<g transform="translate(${x} 23)">
	<line x1="0" y1="-13" x2="0" y2="25" stroke="${accent}" stroke-opacity="0.3"/>
	<text x="18" y="10" class="meta">${escapeXml(item)}</text>
</g>`;
		})
		.join("\n")}
</g>`;
};

const buildSvg = ({ label, title, titleLines, subtitle, accent, chips }) => {
	const titleLayout = getTitleLayout(title, titleLines);
	const titleTop = titleLayout.lines.length === 1 ? 262 : 252;
	const titleBottom =
		titleTop + (titleLayout.lines.length - 1) * titleLayout.lineHeight;
	const subtitleTop = titleBottom + 66;
	const subtitleLines = wrapText(subtitle, 42, 2);

	return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
			<stop offset="0" stop-color="#fff8ef"/>
			<stop offset="0.48" stop-color="#f3e1c8"/>
			<stop offset="1" stop-color="#dce9e1"/>
		</linearGradient>
		<linearGradient id="rail" x1="802" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
			<stop stop-color="#201812"/>
			<stop offset="1" stop-color="#12383a"/>
		</linearGradient>
		<linearGradient id="wash" x1="0" y1="0" x2="760" y2="630" gradientUnits="userSpaceOnUse">
			<stop stop-color="#fffaf2" stop-opacity="0.84"/>
			<stop offset="1" stop-color="#fffaf2" stop-opacity="0.08"/>
		</linearGradient>
		<style>
			.eyebrow { font: 700 15px Arial, Helvetica, sans-serif; letter-spacing: 3px; fill: #624f42; }
			.label { font: 700 17px Arial, Helvetica, sans-serif; letter-spacing: 1.2px; fill: ${accent}; text-transform: uppercase; }
			.title { font-family: Georgia, 'Times New Roman', serif; font-weight: 500; fill: #211811; }
			.subtitle { font: 500 30px Arial, Helvetica, sans-serif; fill: #5f5044; }
			.meta { font: 700 17px Arial, Helvetica, sans-serif; fill: #2f241b; }
			.footer { font: 700 15px Arial, Helvetica, sans-serif; letter-spacing: 2.1px; fill: #6a5849; }
			.railText { font: 700 16px Arial, Helvetica, sans-serif; letter-spacing: 2.6px; fill: #fff8ef; }
			.railSmall { font: 700 15px Arial, Helvetica, sans-serif; fill: #f5debd; }
		</style>
	</defs>
	<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
	<rect width="820" height="${HEIGHT}" fill="url(#wash)"/>
	<path d="M800 0 L1200 0 L1200 630 L874 630 C802 470 778 295 800 0Z" fill="url(#rail)"/>
	<path d="M814 0 C782 206 805 442 874 630" stroke="#fff8ef" stroke-opacity="0.23" stroke-width="2"/>
	<path d="M1002 92 C938 171 926 247 967 317 C1009 390 995 470 932 543" stroke="${accent}" stroke-width="16" stroke-linecap="round"/>
	<path d="M1002 92 C938 171 926 247 967 317 C1009 390 995 470 932 543" stroke="#fff8ef" stroke-opacity="0.34" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 28"/>
	<rect x="86" y="82" width="72" height="6" rx="3" fill="${accent}"/>
	<text x="86" y="122" class="eyebrow">OUT OF OFFICE COLLECTIVE</text>
	<text x="86" y="172" class="label">${escapeXml(label)}</text>
	${renderTextLines({
		lines: titleLayout.lines,
		x: 86,
		startY: titleTop,
		className: "title",
		fontSize: titleLayout.size,
		lineHeight: titleLayout.lineHeight,
	})}
	${renderTextLines({
		lines: subtitleLines,
		x: 90,
		startY: subtitleTop,
		className: "subtitle",
		fontSize: 30,
		lineHeight: 41,
	})}
	${renderMetaRow(chips, accent)}
	<text x="54" y="584" class="footer">PARIS</text>
	<text x="640" y="584" class="footer" text-anchor="end">FETE FINDER</text>
	<text x="912" y="123" class="railText">PARIS ROUTE</text>
	<text x="912" y="554" class="railText">OOOC</text>
	<line x1="900" y1="204" x2="1004" y2="204" stroke="#fff8ef" stroke-opacity="0.24"/>
	<text x="900" y="191" class="railSmall">Curated picks</text>
	<line x1="950" y1="320" x2="1084" y2="320" stroke="#fff8ef" stroke-opacity="0.24"/>
	<text x="950" y="307" class="railSmall">Live details</text>
	<line x1="870" y1="454" x2="986" y2="454" stroke="#fff8ef" stroke-opacity="0.24"/>
	<text x="870" y="441" class="railSmall">Easy sharing</text>
</svg>`;
};

await fs.mkdir(OUT_DIR, { recursive: true });

for (const [slug, content] of Object.entries(presets)) {
	const outputPath = path.join(OUT_DIR, `${slug}.png`);
	await sharp(Buffer.from(buildSvg(content)))
		.png({ compressionLevel: 9 })
		.toFile(outputPath);
	console.log(outputPath);
}
