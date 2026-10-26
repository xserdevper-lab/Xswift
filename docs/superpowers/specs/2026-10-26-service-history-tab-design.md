# Service history tab

## Intent

Give service and repair receipts a dedicated destination so the Details page stays focused on vehicle records. The user approved moving the existing receipt list into a new bottom-navigation tab and keeping receipts expandable to view the full itemized receipt.

## Design

- Add a fifth bottom tab named **Service** between Details and Fuel prices.
- Move the service and repair history summary, Add receipt action, empty state, and receipt list from Details into the new Service panel.
- Preserve existing receipt behavior and local/Google Sheets data; do not change the receipt schema or persistence.
- Keep the existing white surface, black bottom navigation, typography, and icon treatment. Use a receipt/list icon and evenly distribute five tabs.
- Translate the new tab label in English, Thai, Korean, and Japanese.

## Alternatives

- Keep receipts in Details: no navigation change, but leaves the long Details page crowded.
- Replace Details with Service: saves a tab but removes the vehicle document page from direct navigation.
- **Chosen:** add a dedicated Service tab, preserving both existing destinations and separating the receipt history.

## Out of scope

No changes to receipt creation, totals, delete behavior, data syncing, or Google Sheets schema.
