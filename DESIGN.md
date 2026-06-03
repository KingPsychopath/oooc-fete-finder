# Fete Finder Design Notes

## Product Context

Fete Finder is an Out Of Office Collective guide for finding, saving, and sharing Paris music events. The UI should feel curated, editorial, practical, and warm. It should not feel like a generic SaaS template or a festival poster generator.

## Visual Language

- Use warm paper-like surfaces, dark ink, restrained teal/terracotta/green/purple accents, and quiet contrast.
- Prefer composed structure over decoration. Lines, rails, columns, map-route gestures, and typographic scale should carry the design.
- Metadata must be anchored to a rule, table, list, card edge, or route object. Avoid floating badges or pills that sit in empty space.
- Rounded pills are allowed only when they act as controls in the app. For static/share images, use labels, rules, and compact columns instead.
- Keep accents route-specific but secondary. The brand family should be recognizable across pages.

## Typography

- Display type can be elegant and serif-led for editorial moments.
- Body and metadata should be direct, compact, and legible at small preview sizes.
- Do not use negative letter spacing. Uppercase labels may use modest positive tracking.
- Long titles should wrap before they collide with structural elements.

## OG Image Rules

- OG images are scraper-facing UI. They must read at small preview sizes and render as 1200x630 PNGs.
- Static route images should be reproducible from the generator, not hand-edited one-offs.
- Dynamic OG images may differ only when the route needs live facts:
  - Event shares: event title, date, time, price, venue, genre, arrondissement.
  - Shared plans: plan date and stop count.
- Do not allow arbitrary query string text to render into OG images.
- Avoid glassmorphism, floating badges, loose decorative blobs, purple-blue gradient defaults, and card stacks.

## Anti-References

- Stranded metadata pills.
- Generic hero-gradient layouts.
- Overdecorated social cards that obscure event facts.
- Route-specific art direction without a route-specific job.
