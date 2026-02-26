# Google integrations (current)

The app uses Google for **two things only**:

1. **Geocoding** — Address → coordinates for the map. Requires `GOOGLE_MAPS_API_KEY` (Maps Geocoding API). No service account.
2. **Admin sheet import/preview** — In the admin **Data Store** card, "Import Google Backup" and "Preview Google Backup" read event data from a Google Sheet (or a CSV URL). Requires either:
   - `REMOTE_CSV_URL` (public or signed CSV URL), or
   - `GOOGLE_SHEET_ID` + service account via **`GOOGLE_SERVICE_ACCOUNT_KEY`**.

User collection (auth modal) is **not** sent to Google; it is stored only in the app store (Postgres/file/memory). Apps Script and `GOOGLE_SHEETS_URL` have been removed; you can delete that script from your Google account.
