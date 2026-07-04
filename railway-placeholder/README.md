# Railway Placeholder

This directory is a tiny static fallback for the off-season Fete Finder page.
It is intentionally plain HTML and CSS served by Caddy, with no app runtime and
no client JavaScript.

## Page Rules

- Keep the root page static, cacheable, and database-free.
- Redirect every non-asset route back to `/` while the finder is resting.
- Keep the live placeholder boring, complete, and cheap to serve.
- Do not put unfinished recap or marketing experiments in this deployable page.

## Deploy

Local iteration:

```bash
cd railway-placeholder/public
python3 -m http.server 8090
```

Production build check:

```bash
docker build -t oooc-fete-placeholder ..
```

The repo root now has a `Dockerfile` and `railway.json` that deploy this folder
as the live off-season site. Railway should build the root Dockerfile, which
copies `railway-placeholder/public` into Caddy.

```bash
railway up --detach -m "Deploy static placeholder"
```

The Caddy service serves `/`, `/styles.css`, and `/favicon.svg`. Other paths
intentionally `302` redirect to `/` so old indexed Fete Finder URLs land on the
resting page.

## Off-Season Switch

To save money after deploying this service:

1. Move `fete.outofofficecollective.co.uk` to the placeholder service.
2. Stop or scale down the `oooc-fete-finder` app service.
3. Stop cron services.
4. Stop Postgres only after confirming no live app service still needs it.

To reactivate demos, move the domain back to `oooc-fete-finder`, start Postgres
and any needed cron services, then redeploy or restart the app service.
