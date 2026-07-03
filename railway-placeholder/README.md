# Railway Placeholder

This directory is a tiny static fallback for the off-season Fete Finder page.
It is intentionally plain HTML and CSS served by Caddy, with no app runtime and
no client JavaScript.

## Deploy

Create or update a separate Railway service with this directory as its root:

```bash
railway up --service fete-placeholder --detach -m "Deploy static placeholder"
```

If configuring the service in the Railway dashboard, set:

- Root directory: `railway-placeholder`
- Builder: Dockerfile
- Domain port: the Railway-provided `PORT` env var, with the container fallback
  listening on `8080`

## Off-Season Switch

To save money after deploying this service:

1. Move `fete.outofofficecollective.co.uk` to the placeholder service.
2. Stop or scale down the `oooc-fete-finder` app service.
3. Stop cron services.
4. Stop Postgres only after confirming no live app service still needs it.

To reactivate demos, move the domain back to `oooc-fete-finder`, start Postgres
and any needed cron services, then redeploy or restart the app service.
