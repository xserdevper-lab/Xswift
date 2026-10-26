# Append-only Google Sheets sync

## Goal

Keep all existing Xswift vehicle and service-history data in Google Sheets without overwriting prior rows.

## Scope and interaction

- Google Sheets transfer remains explicit: the user connects and chooses **Upload this device's data** in Settings.
- A successful upload appends a full vehicle snapshot containing every current `XSWIFT_FIELDS` value, including vehicle details, installments, notes, fuel limit/usage, maintenance dates and Drive image IDs.
- Each upload creates a new vehicle snapshot row. The app loads the newest valid snapshot as the current vehicle record.
- Service history is stored as append-only receipt events. Upload adds new/changed receipts and deletion events; unchanged receipts are not duplicated on repeated uploads.
- Service history loads from the existing legacy receipt tab plus the new event tab. Event rows take precedence by receipt ID; deletion events hide legacy or prior receipt rows without deleting them.
- Existing `รถยนต์` key/value rows and `ประวัติบำรุงรักษา` receipt rows are preserved and remain readable as fallback data.
- Vehicle photos continue to live in Drive. Snapshot rows keep their Drive file IDs. Live weather and public fuel-price feed data are not personal records and are outside the Sheets backup.
- Data uses appended rows with fixed, validated headers; the Apps Script must never clear or edit existing data rows as part of upload.

## Proposed tabs

- `บันทึกรถ`: `eventId`, `savedAt`, then one column per `XSWIFT_FIELDS` field in declared order.
- `ประวัติบำรุงรักษา (บันทึก)`: `eventId`, `receiptId`, `operation`, `date`, `itemsJson`, `amount`, `createdAt`. `operation` is `upsert` or `delete`.

## Acceptance criteria

1. Repeated vehicle uploads add rows and never change previous values.
2. The latest valid vehicle snapshot is returned; a workbook with no snapshots still loads its prior key/value vehicle data.
3. Upload appends only new or changed receipt events and appends tombstones for removed receipts; previous receipt rows remain intact.
4. Reading service history combines legacy records and append-only events, with the latest event for a receipt ID determining whether it appears.
5. A tab with unexpected headers fails safely before writing; unrelated spreadsheet tabs and rows stay unchanged.
6. Settings clearly describes Upload as adding a new saved version rather than replacing existing data.

## Deployment constraint

The Apps Script backend is deployed separately from GitHub Pages. The updated `apps-script/Code.gs` must be deployed as a new web-app version before the live app uses the append-only schema.
