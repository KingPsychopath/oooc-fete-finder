# OOOC brand fonts (Swear Display + Degular)

The site uses **Swear Display** (display/headings) and **Degular** (body) from OH no Type Co. They are declared in `app/globals.css` via `@font-face`.

## Why the wrong fonts were showing

Browsers do **not** use locally installed fonts for web content unless you declare them with `@font-face`. The CSS only had `font-family: "Swear Display"` and `"Degular"` in the stack, so the browser fell back to system fonts (e.g. .SF NS, Iowan Old Style).

## Option A: Self-hosted .woff2 files

1. Obtain `.woff2` files for **Swear Display Light** and **Degular Regular** (e.g. from your font licence or export from Adobe Fonts / font management).
2. Place them in this folder (`public/fonts/`) with these names:
   - `SwearDisplay-Light.woff2`
   - `Degular-Regular.woff2`
3. The `@font-face` rules in `app/globals.css` will load them from `/fonts/...`.

If your files use different names, either rename them or update the `url(...)` paths in `app/globals.css` to match.

## Option B: Adobe Fonts (Typekit)

If you use an Adobe Fonts subscription:

1. Go to [Adobe Fonts](https://fonts.adobe.com) and create a **Web project**.
2. Add **Swear Display** and **Degular** to the project.
3. Copy the embed code (a `<link>` like `https://use.typekit.net/xxxxx.css`).
4. In `app/layout.tsx`, add that `<link>` inside `<head>`.
5. You can then remove the `@font-face` blocks in `app/globals.css` if you prefer to rely entirely on the Typekit CSS (the font-family names should stay `"Swear Display"` and `"Degular"` to match the kit).

## Local development with installed fonts

The `@font-face` rules include `local("Swear Display Light")` and `local("Degular Regular")` so that if these fonts are installed on your machine, the browser can use them without any files in `public/fonts/`. Font names can vary by OS; if your system uses a different name, add it to the `local()` list in `app/globals.css`.
