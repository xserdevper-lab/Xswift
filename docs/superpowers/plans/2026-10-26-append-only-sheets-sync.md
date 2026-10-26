# Append-only Google Sheets sync Implementation Plan

> **For agentic workers:** Required sub-skill: use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Make explicit Google Sheets uploads append vehicle snapshots and service-history events instead of overwriting existing sheet rows.

**Architecture:** Keep the current manual Upload flow and Apps Script PIN backend. Write vehicle snapshots and service-history events into dedicated append-only tabs; reconstruct current app state from the newest snapshot/events while preserving the old key/value and receipt tabs as readable legacy data.

**Tech Stack:** Google Apps Script, Google Sheets, browser JavaScript.

**Spec:** `docs/superpowers/specs/2026-10-26-append-only-sheets-sync.md`

## Global Constraints

- Upload remains a user-initiated action in Settings.
- Never clear, update, or delete existing sheet data rows during upload.
- Preserve existing sheet tabs and legacy data.
- Validate each new tab's exact header before appending.
- Photos remain in Drive; Sheets stores their IDs.

## Review Focus

- Legacy-only workbook must still load current vehicle and receipts.
- A repeated upload of unchanged receipts must not append duplicate receipt events.
- Receipt deletion must append a tombstone and remain deleted after reloading.
- Invalid headers must fail before any append.
- Concurrent uploads must serialize writes through the Apps Script lock.

### Task 1: Append vehicle snapshots

**Files:** `apps-script/Code.gs`

- [x] Add a versioned snapshot tab with `eventId`, `savedAt`, and `XSWIFT_FIELDS` headers.
- [x] Read the newest valid snapshot as current state, falling back to existing `รถยนต์` key/value data if the snapshot tab is empty.
- [x] Validate snapshot headers and append each upload under the existing script lock; keep image ownership validation and merged-field behavior.

### Task 2: Append service-history events

**Files:** `apps-script/Code.gs`

- [x] Add a versioned event tab with `eventId`, `receiptId`, `operation`, `date`, `itemsJson`, `amount`, and `createdAt` headers.
- [x] Reconstruct current history from legacy receipts plus each receipt ID's newest event.
- [x] Compare uploaded receipts to current history; append only new/changed `upsert` events and `delete` tombstones without clearing existing rows.

### Task 3: Describe append-only upload and deployment

**Files:** `index.html`, `src/i18n.js`, `apps-script/README.md`, `docs/deployment.md`, `README.md`

- [x] Update the confirmation/status copy so Upload clearly states that a new version is appended and previous versions are retained.
- [x] Document the two new tab headers, legacy fallback, and the need to deploy a new Apps Script web-app version separately from GitHub Pages.
