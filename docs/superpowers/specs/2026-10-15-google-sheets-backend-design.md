# Xswift Google Sheets Backend Design

## Goal

Keep Xswift's existing single-car interface and Google Sheets data model, while removing the need to sign in to Google or reconnect on every visit. The owner authorizes the backend once; the app asks for a PIN and keeps its session only for the open browser tab.

## Existing system

- The public GitHub Pages app currently accesses Google Sheets and Drive directly from the browser using Google Identity Services. Its short-lived access token is held in memory, so reloads and expiry cause repeated connection prompts.
- The app stores one vehicle record in the `รถยนต์` sheet as key/value data and stores vehicle/license photos in Drive.
- Existing fields are `model`, `plate`, `price`, `taxRenew`, `taxExpire`, `insType`, `insYear`, `insExpire`, `licenseExpire`, `batteryDate`, `maintenanceDate`, `maintenanceIntervalMonths`, `memo`, `carImageFileId`, `licenseImageFileId`, `fuelLimit`, and `fuelSpent`.
- The current local folder is a source snapshot without Git metadata. Repository changes are made against `xserdevper-lab/Xswift` on GitHub.

## Selected architecture

Keep the UI static on GitHub Pages and add a Google Apps Script web app as the backend. The Apps Script project runs as the spreadsheet/Drive owner and uses a fixed spreadsheet ID configured in Script Properties. It can read and write the existing `รถยนต์` tab and manage only the two app vehicle image files in the owner's Drive. The browser no longer uses Google OAuth or receives Google API access tokens.

The Apps Script deployment is publicly reachable so GitHub Pages can call it, but every operation that reads or changes app data requires a valid app session token. Public reachability is not treated as authorization. The PIN and token-signing secret are stored only in Apps Script Script Properties; no PIN, PIN hash, signing secret, or Google credential is placed in the repository or frontend configuration.

## PIN and session lifecycle

1. On first use in a new tab session, the app shows a PIN screen. The owner configures a private PIN in Apps Script Script Properties during setup; the PIN itself is not committed or included in the deployment instructions shared in the repository.
2. The app sends the PIN to a login action over HTTPS. Apps Script verifies it server-side using a salted password hash and constant-time comparison, then issues a signed session token with a 12-hour expiry.
3. The browser stores that token in `sessionStorage`, so it survives reloads in the same tab and disappears when the tab session ends. Every read, write, and image operation sends the token in a POST body. Credentials are not placed in URLs.
4. A missing, invalid, or expired token returns an unauthenticated response and the app asks for the PIN again while retaining unsaved form state when possible.
5. Sign out clears the browser's tab session. It does not revoke the owner's Apps Script authorization; owner-side backend access is managed in Google Apps Script.

Limit failed PIN attempts with a server-side cooldown using Apps Script cache/properties. Use a sufficiently long, non-obvious PIN. Because this is a shared app PIN, it is a practical access gate for this single-owner app and is not equivalent to per-user Google identity or account-level authorization.

## API boundary

Use HTTPS POST requests with URL-encoded form bodies to avoid custom-header preflight issues in the Apps Script web app. All read and write actions, including image reads, go through `doPost` and require a valid session token except the PIN login action.

Allow only these actions:

- `login`: verify the PIN and return a signed, expiring app session token.
- `getCar`: return the validated vehicle key/value record from the fixed `รถยนต์` tab.
- `saveCar`: accept only the known vehicle fields and update only those key/value cells, preserving the tab and all other spreadsheet tabs.
- `uploadImage`: accept a bounded base64 image, save it to Drive, and return its file ID. Enforce an explicit image size/type allowlist compatible with Apps Script quotas.
- `getImage`: accept only an image ID recorded in the vehicle fields and return image content for the app to render. Do not permit arbitrary Drive file reads.

The backend rejects unknown actions, fields, invalid tokens, malformed payloads, and image IDs not associated with the vehicle record. It never accepts a caller-supplied spreadsheet ID, Drive query, or arbitrary Google API URL. Return structured JSON errors and do not log PINs, session tokens, image contents, or private vehicle data.

## Frontend integration

Replace direct Sheets/Drive calls in `src/car-sheets.js` and `src/car-drive.js` with a small `src/xswift-api.js` client. Update `src/main.js` and the current Google auth integration to use the PIN screen, session token, automatic tab-session restore, and re-entry when the token expires. Remove the Google Connect/reconnect flow. Preserve the English UI, existing page design and content, vehicle fields, fuel budget behavior, photo display/edit behavior, and legacy import behavior.

The frontend configuration contains only the public Apps Script web app URL. The URL is not a secret. The app must not silently claim data is synced after an API error, and should keep the current locally entered values available for retry.

## Deployment and configuration

- Create a Google Apps Script project associated with the owner's Google account and authorize the required `SpreadsheetApp` and `DriveApp` access once as the owner.
- Configure Script Properties for the fixed spreadsheet ID, PIN salt/hash, session-signing secret, session duration, and rate-limit settings. Generate secrets locally or in Apps Script setup; never commit their values.
- Deploy the web app as **Execute as: Me** and **Who has access: Anyone** so the public GitHub Pages UI can call it. The PIN/session checks are mandatory for all data actions.
- Put the deployed web app URL in the public frontend config, then publish the updated GitHub Pages UI.
- Document setup, owner authorization, deployment version updates, PIN rotation, and recovery if the session expires. Apps Script quotas and file/response-size limits apply; verify the chosen image bounds against current Apps Script limits during implementation.

## Error handling

- Wrong PIN: show a generic retry message and enforce the cooldown without revealing whether a PIN component was correct.
- Missing/expired/invalid session: prompt for PIN again and retain unsaved edits where possible.
- Sheets permission/schema errors: show a useful error; do not overwrite unrelated tabs or malformed data.
- Drive image failure: keep the prior photo/vehicle record and report the failure rather than displaying a false sync success.
- Network or Apps Script quota failure: preserve displayed/local form data and provide a retry path.

## Verification criteria

- A new browser tab asks for the app PIN, but no Google sign-in or Connect action is required.
- Reloading the same tab restores the app session without another PIN prompt; closing the tab and opening a new tab requires the PIN again.
- The token expires after its configured lifetime and then requires the PIN again.
- Missing/invalid/expired tokens and incorrect PIN attempts cannot read or modify vehicle data or images.
- The published source and browser config contain no PIN, PIN hash, signing secret, or Google credential.
- Existing vehicle fields, fuel budget values, key/value sheet layout, unrelated spreadsheet tabs, and associated Drive photos continue to round-trip.
- Only known fields and the app's associated image IDs can be changed/read; arbitrary sheet IDs, Drive files, actions, and fields are rejected.
- API failures do not show a successful sync state or discard unsaved values.

## Out of scope

- Cloud Run, Secret Manager, Google OAuth client secrets, and user Google OAuth sign-in in the app.
- Moving the UI off GitHub Pages or changing its English language and current content/design.
- Supporting multiple users, vehicles, owners, or spreadsheets.
- Changing the existing vehicle record schema or unrelated spreadsheet tabs.
- Background synchronization while the app is closed.
- Treating a shared PIN as strong identity verification or as a substitute for per-user access control.

## Open deployment prerequisites

- The owner must create/configure the Apps Script project, authorize its Sheets/Drive access, set the private Script Properties, and deploy the web app from their Google account.
- The owner must retain control of the Apps Script and spreadsheet. Revoking the Apps Script project's Google authorization disables backend access and requires owner reauthorization.
- Apps Script quotas and image payload limits must be checked against the planned app use before deployment.
