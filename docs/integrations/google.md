# Google Integrations

Google is used for two optional integration paths.

## 1) Geocoding

Purpose:

- Convert event address text to map coordinates

Requires:

- `GOOGLE_MAPS_API_KEY`
- Geocoding API enabled in Google Cloud project

## 2) Admin Backup Import/Preview

Purpose:

- Let admin preview/import backup event data from Google Sheet or remote CSV source

Requires one of:

- `REMOTE_CSV_URL`, or
- `GOOGLE_SHEET_ID` + `GOOGLE_SERVICE_ACCOUNT_KEY`

## Not Used

- Google is not the live runtime event source
- User auth collection is not stored in Google as primary app behavior
