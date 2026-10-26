# Service History Tab Implementation Plan

> **For agentic workers:** Execute inline in the current repository. Steps use checkbox syntax for tracking.

**Goal:** Move service and repair receipt history out of Details into a dedicated Service bottom-navigation tab.

**Architecture:** Reuse the existing receipt summary, list, and handlers inside a new tab panel. The existing generic tab controller discovers tabs and panels from data attributes, so no new navigation logic is needed.

**Tech Stack:** HTML, CSS, vanilla JavaScript, existing i18n dictionary.

**Spec:** `docs/superpowers/specs/2026-10-26-service-history-tab-design.md`

## Global Constraints

- Preserve receipt creation, totals, deletion, local persistence, and Google Sheets sync.
- Keep the app's existing light surfaces and black bottom navigation.
- Translate the new tab label in English, Thai, Korean, and Japanese.

## Review Focus

- Five bottom tabs fit on narrow mobile screens and retain clear labels.
- The moved list remains connected to the existing Add receipt and Delete handlers.
- The new tab works with generic keyboard tab navigation and does not shift reminders away from the Car tab.

### Task 1: Move receipts into a dedicated tab

**Files:** `index.html`, `src/styles.css`, `src/i18n.js`, `src/main.js`, `service-worker.js`

- [x] Add a `service` panel and bottom tab between Details and Fuel prices; move the existing receipt section without changing its element IDs.
- [x] Add a distinct service SVG icon and set the bottom navigation to five equal columns.
- [x] Add translations for the new visible tab label in Thai, Korean, and Japanese; keep English as the source string.
- [x] Bump cache versions for changed assets and the service worker.
- [x] Review the diff and run `git diff --check`.
