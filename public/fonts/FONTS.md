# OOOC brand fonts (Swear Display + Degular)

The site uses **Swear Display** (display/headings) and **Degular** (body) from OH no Type Co. They are declared in `app/globals.css` via `@font-face`.

## Why the wrong fonts were showing

Browsers do **not** use locally installed fonts for web content unless you declare them with `@font-face`. The CSS only had `font-family: "Swear Display"` and `"Degular"` in the stack, so the browser fell back to system fonts (e.g. .SF NS, Iowan Old Style).

## Font formats (woff2 vs otf, etc.)

| Format | Use case | Web? | Size |
|--------|----------|------|------|
| **woff2** | Web fonts | Yes, best | Smallest (Brotli compression), supported in all modern browsers. **Use this for the site.** |
| **woff** | Web fonts | Yes | Larger than woff2; fallback for very old browsers. |
| **otf** / **ttf** | Design apps, desktop, print | Possible but not ideal | Larger; no web-specific compression. Browsers support them but they’re heavier and slower to load. |
| **eot** | Legacy IE | Legacy only | Ignore for new projects. |

**Summary:** For the web, **woff2 is the best choice**: smaller files and faster loading than OTF/TTF. OTF works in browsers too; the CSS loads woff2 first and falls back to OTF if woff2 is missing.

## Option A: Self-hosted font files

Put files in this folder (`public/fonts/`). The CSS loads **woff2 first**, then **otf** if woff2 isn’t there. So you can use either format.

| Role | Preferred | Fallback (also supported) |
|------|-----------|----------------------------|
| Display (Swear Display Light) | `swear_display_light.woff2` | `swear_display_light.otf` |
| Body (Degular Regular) | `degular_regular.woff2` | `degular_regular.otf` |

If you only have OTF right now, rename (or copy) to the names above and drop them in `public/fonts/`. Add woff2 later for smaller, faster loading.

### Converting OTF to WOFF2

If you want to generate woff2 from your OTF files:

- **Command line (fonttools):** `pip install fonttools brotli`, then  
  `fonttools subset yourfont.otf --output-file=yourfont.woff2 --flavor=woff2`  
  (or use `pyftsubset` if you have an older fonttools).
- **Online:** [CloudConvert](https://cloudconvert.com/otf-to-woff2), [FontSquirrel Webfont Generator](https://www.fontsquirrel.com/tools/webfont-generator) (upload OTF, download webfont kit with woff2).
- **npm:** e.g. `npx ttf2woff2 swear_display_light.otf swear_display_light.woff2` (some tools expect TTF; OTF often works or convert OTF→TTF first).

## Option B: Adobe Fonts (Typekit)

If you use an Adobe Fonts subscription:

1. Go to [Adobe Fonts](https://fonts.adobe.com) and create a **Web project**.
2. Add **Swear Display** and **Degular** to the project.
3. Copy the embed code (a `<link>` like `https://use.typekit.net/xxxxx.css`).
4. In `app/layout.tsx`, add that `<link>` inside `<head>`.
5. You can then remove the `@font-face` blocks in `app/globals.css` if you prefer to rely entirely on the Typekit CSS (the font-family names should stay `"Swear Display"` and `"Degular"` to match the kit).

## Local development with installed fonts

The `@font-face` rules include `local("Swear Display Light")` and `local("Degular Regular")` so that if these fonts are installed on your machine, the browser can use them without requesting the files from the server. Font names can vary by OS; if your system uses a different name, add it to the `local()` list in `app/globals.css`.
