# Xswift Google Sheets Backend Design

## Goal

Keep the Xswift interface on GitHub Pages and let the app read and write its existing Google Sheets and Drive data without asking the owner to reconnect for every page load or expired browser access token.

## Existing system

- The public GitHub Pages app uses Google Identity Services token flow in the browser.
- The browser keeps the Google access token in memory. It is lost on reload and Google access tokens expire.
- The app stores one vehicle record in the `รถยนต์` sheet and stores vehicle/license photos in Drive.
- Existing record fields are `model`, `plate`, `price`, `taxRenew`, `taxExpire`, `insType`, `insYear`, `insExpire`, `licenseExpire`, `batteryDate`, `maintenanceDate`, `maintenanceIntervalMonths`, `memo`, `carImageFileId`, `licenseImageFileId`, `fuelLimit`, and `fuelSpent`.
- The current local folder is a source snapshot without Git metadata. Changes for the repository are therefore made against `xserdevper-lab/Xswift` on GitHub.

## Selected architecture

Keep the current static UI on GitHub Pages. Add a small Node.js service on Google Cloud Run as the only component that calls Google Sheets and Drive APIs. Store the Google OAuth client secret and owner refresh token in Google Secret Manager; the Cloud Run service account receives only the Secret Manager permissions it needs. The spreadsheet ID, owner email, and allowed Pages origin are fixed server configuration. No browser request can supply a different spreadsheet ID or arbitrary Google API URL.

The browser uses Google Identity Services to obtain a signed Google ID token for the owner. It sends that token as a bearer credential with each app API request. The backend verifies the token signature, issuer, audience, expiry, verified email, and configured owner email before returning or changing data. The browser tries to resume Google sign-in when the app opens; if Google requires account interaction, the app presents that step. The ID token is used only to identify the caller and is not a Sheets/Drive access token.

## First authorization and token lifecycle

1. The owner uses the app's Connect action to start the Google Identity Services authorization-code popup flow for `openid`, `email`, Sheets read/write, and Drive `drive.file` scopes.
2. The browser posts the one-use authorization code to a dedicated Cloud Run endpoint with the required `X-Requested-With: XmlHttpRequest` header. The backend validates the exact allowed origin, exchanges the code using the OAuth client secret, verifies the returned Google identity against the configured owner, and checks that offline access was granted.
3. The backend stores the returned refresh token as a new Secret Manager secret version and returns only a success/failure result to the browser. If Google does not return a refresh token, the backend reports that authorization did not complete and does not mark the app connected.
4. For Sheets/Drive calls, the backend reads the refresh token, obtains a short-lived access token from Google, performs the requested operation, and never returns the access or refresh token to the browser.
5. Sign out clears the app session and revokes/deletes the stored Google authorization. A revoked, invalid, or otherwise unusable refresh token returns a reconnect-required response.

The OAuth consent screen must target the In production publishing status for persistent refresh tokens. Google documents that an external OAuth app left in Testing issues refresh tokens that expire after seven days for these non-basic scopes. Production status may show an unverified-app warning and may require Google verification for broader distribution. User revocation, inactivity, account policy, or other Google limits can still invalidate a refresh token; the app must recover by requesting authorization again.

## API boundary

- `GET /api/car` returns the validated vehicle record and photo content/URLs needed by the existing UI.
- `PUT /api/car` accepts only the known vehicle fields and preserves the existing key/value sheet format, tab name, and unrelated spreadsheet tabs.
- `POST /api/images` accepts a bounded image upload, stores it in the owner's Drive using `drive.file`, and returns a file ID.
- `GET /api/images/:fileId` returns an image only after authentication and uses the owner's Drive authorization.
- `POST /auth/connect` exchanges a one-use Google authorization code and stores the owner refresh token; it does not act as a general token proxy.
- `POST /auth/sign-out` requires the owner's verified Google ID token, revokes the stored authorization, and deletes/invalidates the refresh-token secret version.

All endpoints require HTTPS, validate allowed origin, validate request sizes and field names, and return structured errors. CORS allows only the GitHub Pages origin and an explicitly configured local development origin. Google API calls remain server-side. The backend must not expose arbitrary proxy, file, or spreadsheet operations.

## Frontend integration

Replace direct Sheets/Drive calls in `src/car-sheets.js` and `src/car-drive.js` with a small `src/xswift-api.js` client. Update `src/main.js` and `src/google-auth.js` to handle Google ID-token sign-in, first-time authorization-code connect, authenticated API requests, and reconnect-required states. Preserve existing field names, UI content, photo behavior, and legacy import behavior. Configure the Cloud Run base URL through a public API URL setting; no credential is placed in `config.js`.

## Deployment and configuration

- Deploy the backend as a Cloud Run service in the existing Google Cloud project.
- Enable Cloud Run, Secret Manager, Google Sheets API, and Google Drive API.
- Set a dedicated Cloud Run service account with Secret Manager access limited to the required OAuth and refresh-token secrets.
- Configure the owner email, spreadsheet ID, allowed Pages origin, OAuth client ID, and OAuth client secret. Keep the client secret and refresh token in Secret Manager; keep only non-secret endpoint/client identifiers in frontend configuration.
- Configure the OAuth consent screen as In production, authorized JavaScript origin for GitHub Pages, and any required OAuth redirect/origin settings for the code flow.
- Document first authorization, deployment, reconnect recovery, and how to revoke access. Cloud Run/Google API usage may incur charges according to the Google Cloud project and usage.

## Error handling

- Expired browser ID token: attempt Google sign-in resumption, then ask the owner to sign in if required.
- Google refresh token invalid/revoked: do not report sync success; show a reconnect-required message and retain unsaved form changes.
- Sheets permission/schema errors: report a useful error and do not overwrite unrelated tabs or malformed data.
- Drive image failure: retain the current photo and report upload/load failure without claiming the record was synced.
- Network/server failures: preserve the current UI data and surface a retryable error.

## Verification criteria

- Cold page load with an existing authorized Google session can retrieve the vehicle without pressing Connect.
- A Sheets read or write still works after the previous short-lived access token has expired, provided the backend refresh token remains valid.
- An account other than the configured owner cannot read, write, upload, or download data.
- Requests with an unapproved origin, invalid ID token, unknown vehicle field, arbitrary spreadsheet ID, or arbitrary Drive operation are rejected.
- Existing car fields, fuel budget values, sheet layout, and Drive photos continue to round-trip correctly.
- Revoked refresh authorization returns a reconnect-required state and recovers after the owner authorizes again.
- Secrets never appear in browser responses, frontend configuration, repository files, or application logs.

## Out of scope

- Moving the UI off GitHub Pages.
- Supporting multiple owners or multiple spreadsheets.
- Changing the vehicle record schema, page design, or Google Sheets data model.
- Background sync while the app is closed; the backend refreshes credentials when the app makes a request but does not run scheduled vehicle jobs.

## Open deployment prerequisites

- The owner must supply/confirm the email address allowed to use the backend during deployment configuration.
- The owner must configure Cloud Run, Secret Manager, the OAuth client secret, and OAuth consent publishing status in the Google Cloud project. This design does not change Google Cloud resources by itself.
- OAuth verification requirements and any billing enablement must be resolved in the owner's Google Cloud account before production deployment.

