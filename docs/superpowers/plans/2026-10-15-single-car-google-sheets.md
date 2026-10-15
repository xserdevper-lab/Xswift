# Xswift Single-Car Google Sheets App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a single-screen car information app from Xswift that opens directly to this vehicle and uses Google OAuth, Google Sheets data, and Drive-hosted photos.

**Architecture:** Use the existing standalone HTML/CSS/JS app as the UI base and make the car information view the only screen, with no page switching or bottom navigation. Render that screen immediately, then connect through Google OAuth and add focused client modules for Sheets/Drive operations. Keep public configuration separate from private data; GitHub Pages serves the app and Google APIs authorize each user.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Google Identity Services, Google Sheets API v4, Google Drive API v3, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-10-15-single-car-google-sheets-design.md`

## Global Constraints

- Preserve spreadsheet ID `1xxaLYpoQvzXhIzkHllMToVo-SKeM4TKNik7kqDbKID4` and existing tabs.
- Use the dedicated tab `รถยนต์`, with `key`/`value` rows for the fixed car fields.
- Use Sheets scope for reading/writing and Drive scope `drive.file` for app-owned photos.
- Never commit OAuth client secrets, access tokens, vehicle data, or image contents.
- Do not report a successful load/save when the API call fails; keep edited values available for retry.
- Do not use localStorage as the primary database.

## Review Focus

- Missing tab or empty tab: initialization must not overwrite unrelated tabs; cover in the storage adapter.
- Expired/revoked OAuth token: show a recoverable authentication state; cover in the auth module.
- API/network failure during save: retain form state and show failure; cover in the sync module.
- Replacing an image: keep the old reference until the new Drive upload succeeds; cover in the Drive module.
- Legacy localStorage data: offer opt-in import without auto-uploading unexpected values; cover in the import flow.

---

### Task 1: Create the single-screen car app

**Files:**
- Create: `index.html` (copy the current local app into the Git checkout, then reduce it to the car page)
- Create: `src/car-app.js` (car-page rendering and form state)
- Create: `src/car-app.test.js` (car UI behavior)

**Interfaces:** `renderCar(record)`, `readCarForm()`, and `setSyncState(state, message)`.

- [ ] Write checks that the initial page is the car page, removed sections are absent, and existing car fields remain; confirm they fail against the empty Git checkout.
- [ ] Add the app source and remove unrelated pages, modals, floating add button, bottom navigation, and unrelated data handlers so the car screen is the only view on first open.
- [ ] Keep car edit, document status, memo, photo, and license-photo interactions.
- [ ] Add sign-in/loading/error shell and sync status; do not expose data before authentication.
- [ ] Run focused checks for the single-car shell.

### Task 2: Add Google sign-in and token lifecycle

**Files:**
- Create: `src/google-auth.js`, `src/google-auth.test.js`, `config.example.js`

**Interfaces:** `initializeGoogleAuth(config)`, `requestAccessToken()`, `getAccessToken()`, and `signOut()`; scopes are Sheets read/write and Drive `drive.file`.

- [ ] Add checks for unauthenticated state, token success/denial/expiration, and sign-out; confirm they fail before implementation.
- [ ] Implement GIS token-client integration with memory-only tokens and consent when needed.
- [ ] Load OAuth Client ID and spreadsheet ID from public config with safe placeholders.
- [ ] Run focused auth checks.

### Task 3: Implement the Sheets data adapter

**Files:** `src/car-sheets.js`, `src/car-sheets.test.js`

**Interfaces:** `loadCar(accessToken, spreadsheetId) -> Promise<CarRecord>`, `saveCar(accessToken, spreadsheetId, carRecord) -> Promise<void>`, and `ensureCarSheet(accessToken, spreadsheetId) -> Promise<void>`. Tab format: `key | value`.

- [ ] Add checks for key/value parsing, missing/unknown keys, empty/missing tab, HTTP errors, and update-in-place; confirm failures before implementation.
- [ ] Implement Sheets API calls; create the `รถยนต์` tab only when absent and do not alter other tabs.
- [ ] Update existing key rows and append only missing keys, avoiding duplicate records.
- [ ] Run focused adapter checks.

### Task 4: Implement Drive photo storage and sync orchestration

**Files:** `src/car-drive.js`, `src/car-sync.js`, `src/car-drive.test.js`, `src/car-sync.test.js`

**Interfaces:** `uploadCarImage(accessToken, file, previousFileId) -> Promise<{fileId: string}>`, `loadCarImage(accessToken, fileId) -> Promise<string>`, and `syncCar(accessToken, config) -> Promise<CarRecord>`.

- [ ] Add checks for upload/load failure, replacement ordering, sheet save failure, and retry state; confirm failures before implementation.
- [ ] Implement Drive upload/download for app-owned files; replace the prior reference only after upload succeeds.
- [ ] Implement initial load, save, image synchronization, and UI status transitions.
- [ ] Confirm error cases preserve edit state and show recoverable errors.

### Task 5: Add legacy import and deployment documentation

**Files:** `README.md`, `docs/deployment.md`, car UI/import code, `src/legacy-import.test.js`.

- [ ] Add checks for absent/valid/malformed legacy data and explicit user confirmation; confirm failures before implementation.
- [ ] Add opt-in one-time import from `myspace-data.car`; do not upload before confirmation.
- [ ] Document enabling Sheets/Drive APIs, OAuth consent screen, authorized GitHub Pages origin, `config.js`, sheet format, GitHub Pages setup, and troubleshooting.
- [ ] Ensure deployment config contains placeholders only.
- [ ] Confirm import behavior and deployment instructions.

### Task 6: Integrate and review the complete app

**Files:** `index.html`, `src/*.js`, `README.md`, `docs/deployment.md`.

- [ ] Run focused checks for app integration and confirm all JavaScript modules load.
- [ ] Verify no removed navigation/page roots remain.
- [ ] Run locally and verify sign-in, load, edit/save, photo upload, sign-out, error recovery, and mobile layout with the target spreadsheet.
- [ ] Review for credential leaks, accidental local data, duplicate car rows, and changes to unrelated spreadsheet tabs.
- [ ] Commit implementation on the feature branch.
- [ ] Push the branch and configure/publish GitHub Pages after OAuth Client ID and Google API permissions are supplied.

## External setup inputs needed for live integration

- Google OAuth Client ID authorized for the final GitHub Pages origin.
- The signed-in Google account must have edit access to the linked spreadsheet.
- Spreadsheet access or confirmation that the app may create the `รถยนต์` tab.
- Repository write permission and intended branch/Pages source if not using the default branch.

