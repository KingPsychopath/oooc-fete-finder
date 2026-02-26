# Admin Workflow

Use this when updating live event data.

## Standard Publish Flow

1. Open `/admin`
2. Load source data:
- `Upload CSV to Postgres`, or
- `Import Google Backup`
3. Review/edit rows in `Event Sheet Editor`
4. Manage featured scheduling in `Featured Events Manager`
5. Create a safety snapshot in `Data Store Controls` (`Backup Now`)
6. Click `Save and Revalidate Homepage`
7. Verify results in `Live Site Snapshot`

## Featured Events Rules

- Canonical source is `app_featured_event_schedule`
- Legacy `Featured` CSV values are rejected on save/import
- Scheduling timezone is Europe/Paris
- Max active featured slots is 3

## Rollback Flow

1. Open `Data Store Controls`
2. Restore `Latest Backup` or a selected snapshot
3. Revalidate homepage
4. Confirm restored payload in `Live Site Snapshot`

## Health Checks

Use these from authenticated admin context:

- `GET /api/admin/health`
- `GET /api/admin/data-store/status`
- `GET /api/admin/postgres/kv`
- `GET /api/admin/tokens/sessions`

## Common Failure Cases

- Save succeeds but publish looks stale: run save/revalidate again and check source in runtime status
- Featured rows not applying: verify event keys exist and legacy `Featured` field is empty
- Submission endpoint closed: check `Event Submissions` settings in admin
