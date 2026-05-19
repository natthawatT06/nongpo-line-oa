# Google Sheets storage

Use this when you want NongPo records to appear in Google Sheets without OAuth in the Node app.

## 1. Create the sheet

1. Create a new Google Sheet.
2. Open `Extensions > Apps Script`.
3. Replace the default code with `scripts/google-sheets-webhook.gs` from this repo.
4. Click `Deploy > New deployment`.
5. Choose type `Web app`.
6. Set:
   - Execute as: `Me`
   - Who has access: `Anyone`
7. Deploy and copy the Web app URL.

## 2. Add Render env

In Render, add:

```text
GOOGLE_SHEETS_WEBHOOK_URL=<your Apps Script Web app URL>
```

Then redeploy the service.

## 3. What gets written

The Apps Script creates these tabs automatically:

- `farmer_registrations`
- `farmer_fields`
- `farmer_planting_plans`

Rows are appended from the existing backend endpoints and LINE field commands.
