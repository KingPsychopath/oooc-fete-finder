import { Resvg } from "@resvg/resvg-js";
import { join } from "node:path";
import sharp from "sharp";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;
export const OG_SCALE = 2;

const FONT_ROOT = join(process.cwd(), "public", "fonts");

export const OG_FONT_FILES = [
	join(FONT_ROOT, "degular_regular.ttf"),
	join(FONT_ROOT, "prata_regular.ttf"),
];

export const OG_RESVG_FONT_CONFIG = Object.freeze({
	fontFiles: OG_FONT_FILES,
	loadSystemFonts: false,
	defaultFontFamily: "Degular",
	serifFamily: "Prata",
	sansSerifFamily: "Degular",
});

export const renderOGSvgToPng = async (svg) => {
	const png2x = new Resvg(svg, {
		font: OG_RESVG_FONT_CONFIG,
		fitTo: { mode: "width", value: OG_WIDTH * OG_SCALE },
		imageRendering: 0,
		logLevel: "error",
		shapeRendering: 2,
		textRendering: 2,
	})
		.render()
		.asPng();

	return sharp(png2x)
		.resize(OG_WIDTH, OG_HEIGHT, {
			fit: "fill",
			kernel: "lanczos3",
		})
		.png({ compressionLevel: 9 })
		.toBuffer();
};
