# Mobile Bottom Nav Before Liquid Split

Archived reference for the pre-split mobile bottom navigation design.

- Archive branch: `feature/archive-mobile-nav-before-liquid-split`
- Source commit: `6046056408b8231b7c7ba1f78f5e823a7691bb90`
- Source ref: `origin/main` before the `new-nav-bar` experiment

Useful commands:

```bash
git diff feature/archive-mobile-nav-before-liquid-split..new-nav-bar -- components/MobileBottomNav.tsx app/globals.css
git restore --source feature/archive-mobile-nav-before-liquid-split -- components/MobileBottomNav.tsx app/globals.css
```

The archive branch is intentionally separate from the app code so the old design stays easy to recover without shipping duplicate UI.
