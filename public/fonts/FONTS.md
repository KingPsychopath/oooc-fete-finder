# OOOC Brand Fonts

The canonical web fonts are checked into this folder and loaded with
`next/font/local` from `app/layout.tsx`.

| Role | File | CSS variable |
| --- | --- | --- |
| Display headings | `prata_regular.woff2` | `--font-prata` |
| Body/UI | `degular_regular.woff2` | `--font-degular` |

## Rules

- Use WOFF2 for web delivery.
- Keep fonts same-origin under `public/fonts/`.
- Do not use Google Fonts, Adobe Fonts, Typekit, or remote font CSS for the app shell.
- Do not use CSS `local(...)`; local system fonts make rendering depend on a developer or visitor machine.
- Add new weights only when the UI actually uses them.

The production font stack is defined in `app/globals.css` as
`--ooo-font-display`, `--ooo-font-body`, and `--ooo-font-mono`.
