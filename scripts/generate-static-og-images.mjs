import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const LEFT_X = 86;
const RIGHT_FOOTER_X = 1128;
const OUT_DIR = path.join(process.cwd(), "public", "og");

const presets = {
	home: {
		title: "Fête Finder",
		subtitle: "Curated Paris music events by Out Of Office Collective",
	},
	"how-it-works": {
		title: "How Fête Finder Works",
		subtitle:
			"Plan your Paris music weekend with curated picks, filters and community tips",
	},
	privacy: {
		title: "Privacy Policy",
		subtitle: "How Fête Finder handles attendee, host and partner data",
	},
	"submit-event": {
		title: "Submit Your Event",
		subtitle: "Share your event with Out Of Office Collective",
	},
	"feature-event": {
		title: "Partner With OOOC",
		subtitle: "Spotlight and promoted placements in Fête Finder",
	},
	"partner-success": {
		title: "Payment Received",
		subtitle: "Your OOOC placement is now in the activation queue",
	},
	"partner-performance-report": {
		title: "Partner Performance Report",
		subtitle: "Private campaign performance metrics",
	},
	"social-assets": {
		title: "Fête Finder Social Assets",
		subtitle: "Private branded export routes for Out Of Office Collective",
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

	if (current) {
		lines.push(current);
	}

	return lines.slice(0, maxLines);
};

const getTitleLayout = (title) => {
	for (const candidate of [
		{ maxChars: 17, size: 78, maxLines: 2 },
		{ maxChars: 16, size: 70, maxLines: 3 },
		{ maxChars: 15, size: 66, maxLines: 3 },
	]) {
		const lines = wrapText(title, candidate.maxChars, candidate.maxLines);
		const didFitAllWords = lines.join(" ") === title;
		if (didFitAllWords) {
			return {
				lines,
				size: title.length <= 14 && lines.length === 1 ? 106 : candidate.size,
				lineHeight: candidate.size * 0.96,
			};
		}
	}

	const lines = wrapText(title, 16, 3);
	return {
		lines,
		size: 66,
		lineHeight: 63,
	};
};

const renderTextLines = ({
	lines,
	x,
	startY,
	className,
	fontSize,
	lineHeight,
}) =>
	lines
		.map(
			(line, index) =>
				`<text x="${x}" y="${startY + index * lineHeight}" class="${className}" font-size="${fontSize}">${escapeXml(line)}</text>`,
		)
		.join("");

const buildSvg = ({ title, subtitle }) => {
	const titleLayout = getTitleLayout(title);
	const titleTop = titleLayout.lines.length === 1 ? 292 : 252;
	const titleBottom =
		titleTop + (titleLayout.lines.length - 1) * titleLayout.lineHeight;
	const subtitleTop = titleBottom + titleLayout.size * 0.72 + 42;
	const subtitleLines = wrapText(subtitle, 42, 3);

	return `<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">
	<defs>
		<linearGradient id="bg" x1="50" y1="0" x2="1120" y2="630" gradientUnits="userSpaceOnUse">
			<stop offset="0" stop-color="#fbf3e7"/>
			<stop offset="0.46" stop-color="#f2dcc3"/>
			<stop offset="1" stop-color="#dfeee7"/>
		</linearGradient>
		<radialGradient id="warm" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(176 112) rotate(43) scale(390 260)">
			<stop stop-color="#bf4b37" stop-opacity="0.26"/>
			<stop offset="1" stop-color="#bf4b37" stop-opacity="0"/>
		</radialGradient>
		<radialGradient id="cool" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(986 458) rotate(44) scale(430 285)">
			<stop stop-color="#1b695f" stop-opacity="0.25"/>
			<stop offset="1" stop-color="#1b695f" stop-opacity="0"/>
		</radialGradient>
		<linearGradient id="panel" x1="0" y1="0" x2="760" y2="630" gradientUnits="userSpaceOnUse">
			<stop stop-color="#fffaf2" stop-opacity="0.66"/>
			<stop offset="0.72" stop-color="#fffaf2" stop-opacity="0.34"/>
			<stop offset="1" stop-color="#fffaf2" stop-opacity="0"/>
		</linearGradient>
		<style>
			.eyebrow { font: 700 15px Arial, Helvetica, sans-serif; letter-spacing: 3.3px; fill: #6d5546; }
			.badge { font: 700 15px Arial, Helvetica, sans-serif; fill: #6c332b; }
			.title { font-family: Georgia, 'Times New Roman', serif; font-weight: 500; fill: #241911; }
			.subtitle { font: 500 28px Arial, Helvetica, sans-serif; fill: #6d5546; }
			.footer { font: 700 15px Arial, Helvetica, sans-serif; letter-spacing: 2.1px; fill: #705b4d; }
		</style>
	</defs>
	<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
	<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#warm)"/>
	<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#cool)"/>
	<rect width="790" height="${HEIGHT}" fill="url(#panel)"/>
	<path d="M742 0 C686 162 708 330 790 630" stroke="#fffaf2" stroke-opacity="0.34" stroke-width="2"/>
	<circle cx="172" cy="162" r="126" fill="#fffaf2" fill-opacity="0.14"/>
	<circle cx="1010" cy="407" r="210" fill="#fffaf2" fill-opacity="0.08"/>
	<text x="${LEFT_X}" y="70" class="eyebrow">OUT OF OFFICE COLLECTIVE</text>
	<rect x="${LEFT_X}" y="94" width="246" height="36" rx="18" fill="#fffaf2" fill-opacity="0.56" stroke="#6d5546" stroke-opacity="0.22"/>
	<text x="102" y="118" class="badge">Fête de la Musique · Paris</text>
	<rect x="88" y="188" width="82" height="4" rx="2" fill="#7f2f28"/>
	${renderTextLines({
		lines: titleLayout.lines,
		x: LEFT_X,
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
		fontSize: 28,
		lineHeight: 38,
	})}
	<text x="54" y="578" class="footer">PARIS</text>
	<text x="${RIGHT_FOOTER_X}" y="578" text-anchor="end" class="footer">OOOC</text>
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
