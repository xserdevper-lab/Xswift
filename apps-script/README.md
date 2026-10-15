# Xswift Apps Script backend

This backend lets the public GitHub Pages app read one vehicle record and its two photos without asking the app user to sign into Google. It runs as the spreadsheet owner. The web app URL is public, but data actions require a PIN-derived session token.

## Owner setup

1. Open the Xswift spreadsheet (`1xxaLYpoQvzXhIzkHllMToVo-SKeM4TKNik7kqDbKID4`) while signed into the owner account.
2. Choose **Extensions → Apps Script** so the project is bound to this spreadsheet. Replace `Code.gs` with this folder's `Code.gs`. In **Project Settings**, show the manifest file and replace `appsscript.json` with this folder's manifest.
3. Select `setupXswift` in the editor and run it once. Review and grant the Sheets, Drive, and spreadsheet UI permissions. A private 10-digit PIN appears in a one-time spreadsheet dialog; save it securely. It is stored only as a salted, iterated hash in Script Properties. Running setup again resets the PIN and invalidates existing sessions.
4. Choose **Deploy → New deployment → Web app**. Set **Execute as: Me** and **Who has access: Anyone**, then deploy. Copy the URL ending in `/exec`.
5. Put that public URL into `config.js` as `appsScriptUrl`, then publish the Xswift GitHub Pages update. The PIN and signing secret must never be put in `config.js` or the repository.

## What the backend permits

- `login` checks the PIN and issues a signed session token that expires after 12 hours.
- `getCar` and `saveCar` read or update only the known fields in the `รถยนต์` key/value tab.
- `uploadImage` accepts JPEG, PNG, or WebP data up to 1.1 MB and stores the file in the owner's Drive.
- `getImage` returns only an image ID currently referenced by the vehicle record.
- Every data or image action except `login` requires a valid session token. Requests are URL-encoded POSTs; tokens are never included in URLs.

The script creates the `รถยนต์` tab if missing, initializes its `key | value` header if empty, and leaves unrelated tabs and rows alone. It rejects an unexpected header and unknown fields. Uploaded image IDs are checked before the record can reference them.

## Session, PIN, and maintenance

The app stores the token in `sessionStorage`: reloading the same tab keeps the session, while a new tab asks for the PIN. Signing out clears only that tab's Xswift session. It does not revoke the Apps Script owner's Google authorization.

Eight failed PIN attempts trigger a 10-minute script-wide cooldown. Use a private PIN and do not share the deployment URL alongside the PIN publicly. Since the web app executes with the owner's access, anyone who obtains a valid PIN can access this vehicle record; the PIN is a practical single-owner gate, not per-user Google identity.

When editing the backend, update the Apps Script project and create a new deployment version using **Deploy → Manage deployments → Edit → New version**. The `/exec` URL remains the production URL. To rotate the PIN, run `setupXswift` again. If the PIN is lost, run setup again from the spreadsheet-bound project.

Apps Script, Sheets, and Drive quotas apply. The app compresses photos before upload; uploads above the configured size are rejected. Keep the script project under the spreadsheet owner's control and revoke its authorization in the owner's Google Account if backend access should stop.

