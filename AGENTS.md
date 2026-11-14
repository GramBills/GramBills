# GramBill POS — Project Memory

This file is the durable session memory for GramBill. Read it first in a new session before making changes. It records what is built, what is pending, and the decisions that must not be accidentally changed.

## Project

GramBill is an offline-first POS for rural Indian electronics and electrical shops.

V1 target:
- One billing laptop per shop.
- No backend or cloud dependency.
- React UI -> service layer -> Dexie transaction -> IndexedDB.
- Future cloud is one-way mirror/backup/read model only.
- Laptop-first UI, A4 invoice printing first, barcode label printing, USB HID scanner.

Locked V1 constraints:
- One billing laptop per shop.
- No backend in V1.
- Full-invoice cancel/return only, no partial line returns.
- Embedded invoice items; do not normalize invoice items into a separate table.
- Centralized rupee rounding.
- English + Hinglish language modes.
- PWA manifest now; service worker planned for Phase 5.

## Stack

- Vite 6
- React 18
- Strict TypeScript
- Tailwind CSS v4
- Dexie 4
- Vitest
- React Testing Library
- `fake-indexeddb`

## Commands

```bash
npm run dev
npm run typecheck
npm run test
npm run lint
npm run build
```

If `npm install` fails because of cache permissions:

```bash
npm install --cache /var/folders/wy/7x14s1gx0l52_4dg_f_y51sw0000gn/T/opencode/npm-cache
```

Dev server currently runs on `0.0.0.0:5173`; verified at `http://127.0.0.1:5173/`.

## Seed Data

Seed shop: `Shree Electronics & Electricals`

Seed data includes:
- 15 products.
- 4 customers.
- Opening stock movements.
- Customers have opening udhaar balances.
- Matching opening `credit_given` khata transactions.

Seeded customers:
- Imran Khan — Katra — ₹2,200 outstanding — ₹5,000 limit
- Lakshmi Bai — Ramgarh — ₹800 outstanding — ₹2,000 limit
- Ramesh Patel — Nandpur — ₹1,250 outstanding — ₹5,000 limit
- Sunita Devi — Bhadohi — ₹0 outstanding — ₹3,000 limit

## Architecture / Important Files

- `src/db/database.ts`: Dexie DB. Currently version 2. Migration backfills opening khata entries for existing customers with balances.
- `src/db/seed.ts`: initial shop, products, customers, opening stock, opening khata.
- `src/types/pos.ts`: all domain types. Phase 4 added optional `InvoiceItem.hsnCode`, `InvoiceItem.costPrice`, `Invoice.customerGstin`, `Invoice.statusReason`, `Invoice.reversedAt`; `KhataTransactionType` includes `credit_reversed`.
- `src/services/invoices.ts`: checkout, search, reversal logic.
- `src/services/khata.ts`: khata balance and payment logic.
- `src/services/products.ts`: product CRUD, CSV import/update behavior.
- `src/services/customers.ts`: customer CRUD.
- `src/services/settings.ts`: shop settings and language mode.
- `src/lib/money.ts`: rupee rounding, INR formatting, INR words.
- `src/lib/reports.ts`: report ranges and summary calculations.
- `src/lib/warranty.ts`: warranty status helper.
- `src/lib/whatsapp.ts`: receipt and khata reminder message builders.
- `src/components/PrintSheets.tsx`: A4/A5 invoice and label print layouts.
- `src/components/ui/primitives.tsx`: shared UI primitives (`Modal`, `Button`, `Input`, `Select`, `Textarea`, `Field`, `Badge`, `Card`, `PageHeader`, `StatCard`, `Toast`).
- `src/index.css`: print isolation and print-color CSS.
- `src/features/pos/`: POS counter, checkout, receipt modal, UPI QR.
- `src/features/inventory/`: inventory and CSV import.
- `src/features/barcode/`: barcode label studio.
- `src/features/khata/`: khata ledger UI and record-payment modal.
- `src/features/invoices/`: past bills, warranty lookup, invoice detail/reversal.
- `src/features/reports/`: reports and daily closing dashboard.

## Phase Status

### Phase 1, 2, 3 — Complete and verified

- Foundation, settings, products, inventory, barcode labels, POS billing.
- 75 tests passed before Phase 4.
- Chrome smoke tests verified cash checkout, udhaar checkout, global scanner input, unknown-barcode quick-add, hold tabs, stock deduction, A4 print-sheet rendering.

### Phase 4 — Mostly complete

Data/service/lib layer:
- `calculateKhataBalance`
- `recordKhataPayment` with overpayment/no-outstanding validation
- `invoiceMatchesSearch`
- `searchInvoices`
- `getInvoiceById`
- `reverseInvoice`
- `makeReturnMovement`
- `getWarrantyInfo`
- Report range presets/custom ranges
- `buildReportSummary`
- Top products and low-stock reorder
- Hinglish khata reminder message

UI:
- `src/features/khata/KhataLedgerView.tsx` — complete.
- `src/features/khata/RecordPaymentModal.tsx` — complete.
- `src/features/invoices/InvoicesWarrantyView.tsx` — complete.
- `src/features/invoices/InvoiceDetailModal.tsx` — complete.
- `src/features/reports/ReportsDashboardView.tsx` — complete.

Phase 4 UI includes:
- Khata stats, search/village/balance filters, customer list, passbook, credit-limit bar, WhatsApp reminders, ledger reconciliation warning.
- Khata cash/UPI payment collection modal.
- Bill search by invoice number, phone, name, product, barcode, serial/IMEI.
- Invoice detail modal with warranty badges, A4/thermal reprint, WhatsApp, cancel/return confirmation and reason.
- Report range controls (today/yesterday/week/month/custom), collection/profit stat cards, galla closing, top products, low-stock reorder list, reorder CSV download.

## Phase 4 Semantics

Full-invoice reversal:
- Only `completed` invoices can be reversed.
- Status becomes `cancelled` or `returned`.
- Stock restored with `return_in` movements.
- Customer `currentUdhaarBalance` reduced by `invoice.udhaarAmount`.
- Customer `totalPurchases` reduced.
- `credit_reversed` khata entry added only if udhaar existed.
- Second reversal rejected.
- Cash/UPI refunds are manual; the app does not track refund cash flow.

Warranty:
- `getWarrantyInfo` statuses: `active`, `expiring_soon` (<=30 days), `expired`, `not_covered`.
- Important: returned/cancelled bills must not count as active warranties. UI now treats reversed bills as `Warranty closed` and excludes them from active/expiring stats and warranty value.

Reports:
- Completed invoices only.
- `netProfit = grandTotal - cgstTotal - sgstTotal - totalCostPrice`.
- Collections combine invoice cash/UPI/card plus khata cash/UPI payments.
- Cancelled/returned bills excluded from sales/profit.
- Low-stock list includes non-deleted products at or below threshold.
- Suggested reorder qty is `max(1, ceil(threshold * 2 - stockQty))`.

## Invoice / Print Notes

- A4 invoice redesign is complete.
- Print isolation hides all body children except `.invoice-print-sheet` / `.label-print-sheet`.
- Verified via Chrome CDP print emulation: only the invoice sheet is visible; modal/root hidden; no modal text/buttons.
- Use Chrome “Save as PDF” to test print layouts without hardware.
- `formatINRInWords` uses Indian numbering and rounds to 2 decimals before splitting rupees/paise.
- A4-first hardware decision: monochrome A4 laser printer, exact A4 sticker sheets, USB HID scanner, UPS. Thermal printers optional.

## Inventory / CSV Notes

- CSV import creates new products with `opening_stock`.
- Existing product details are updated but stock is preserved.
- Blank barcode preserves existing barcode.
- Inventory UI is English-only; Hinglish translation is not fully added.

## Current Verification State

Last full run in this session:

- `npm run typecheck` — passed
- `npm run lint` — passed
- `npm run test -- --run` — 19 files, 87 tests passed
- `npm run build` — passed
- Vite build warning: main JS chunk is ~922 kB (gzip ~266 kB). Code-splitting is a possible later optimization, not a blocker.

Chrome smoke tests completed this session:
- Created cash bill `INV-2026-0001` for one Havells 9W LED bulb.
- Opened Past Bills view; search by invoice number worked.
- Search with a non-matching serial showed the empty state.
- Opened invoice detail; warranty badge and print/WhatsApp/reversal actions appeared.
- Reversed bill as “Customer return” with reason `Defective piece returned`.
- Verified modal showed Returned status, reversal time, reason, and no further Cancel/Return button.
- Verified returned bill shows `Warranty closed` and active warranty stats drop to 0.
- Created cash bill `INV-2026-0002` for Havells bulb + Anchor extension board.
- Reports showed Sales ₹430, Net profit ₹97, 26.4% margin, tax ₹61, correct top products, and 1 cancelled/returned bill excluded.
- Custom range controls worked; invalid custom range showed `End date cannot be before the start date.`
- Low-stock list was verified by temporarily setting Havells bulb stock to 0 via IndexedDB in the throwaway Chrome profile; row showed stock 0, threshold 10, suggested reorder 20.
- Fixed report Galla-closing subtitle duplicate range text.
- Fixed returned/cancelled warranty counting issue.
- Khata payment smoke test completed (headless Chrome via CDP, fresh profile): opened `#/khata`, selected Imran Khan, recorded a ₹500 UPI payment. Verified outstanding ₹2,200 → ₹1,700, `Collected today` ₹500, passbook showed `UPI payment received` `-₹500.00` and `Bal ₹1,700.00`, Toast showed new balance, and IndexedDB had exactly one `payment_received` entry with `amount=500`, `paymentMode=upi`, `balanceAfter=1700`. Script: `/var/folders/wy/7x14s1gx0l52_4dg_f_y51sw0000gn/T/opencode/cdp-khata-smoke.mjs`.

## Pending Work

1. Phase 4 docs updated: `README.md` and `docs/PLAN.md` now mark Phase 4 complete. `docs/SHOP_SETUP_GUIDE.md` was not changed.
2. Optionally test invoice search by actual serial/IMEI by creating a serialized-product bill.
3. Consider Phase 5 work:
   - Service worker/offline app shell.
   - Deeper backup/restore verification.
   - Hinglish translation coverage (inventory screens are still English-only).
   - Code splitting to reduce bundle warning.
4. Physical A4/thermal printer output and webcam camera capture still need real-device verification.

## Environment / Testing Notes

- App is not deployed; data is per browser origin.
- JSON backups are the recovery path.
- Chrome CDP smoke testing uses `--remote-debugging-port=9223` or `9224`.
- `--dump-dom` is unreliable because the app renders after async `initializeDatabase()`.
- CDP helper scripts exist in `/var/folders/wy/7x14s1gx0l52_4dg_f_y51sw0000gn/T/opencode/`:
  - `cdp-khata-smoke.mjs` (current khata payment smoke test)
  - Older Phase 3/4 scripts may be absent; recreate as needed.
- Headless Chrome launch used for smoke tests (Node v26 has global `WebSocket`):
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --remote-debugging-port=9224 --user-data-dir=<temp profile> --no-first-run --no-default-browser-check about:blank`
- Dev server binds IPv6 `[::1]:5173`, so use `http://localhost:5173` (not `127.0.0.1`) when testing.
- Dev server log: `/var/folders/wy/7x14s1gx0l52_4dg_f_y51sw0000gn/T/opencode/grambill-dev.log`
- `dist/` is untracked, ignored, and still on disk.

## Git / Working Tree

Do not commit unless the user explicitly asks.

Current uncommitted work includes:
- Modified: `src/db/database.ts`, `src/db/seed.ts`, `src/features/invoices/InvoicesWarrantyView.tsx`, `src/features/khata/KhataLedgerView.tsx`, `src/features/reports/ReportsDashboardView.tsx`, `src/lib/whatsapp.test.ts`, `src/lib/whatsapp.ts`, `src/services/invoices.test.ts`, `src/services/invoices.ts`, `src/types/pos.ts`, `README.md`, `docs/PLAN.md`
- New: `src/features/invoices/InvoiceDetailModal.tsx`, `src/features/khata/RecordPaymentModal.tsx`, `src/lib/reports.test.ts`, `src/lib/reports.ts`, `src/lib/warranty.test.ts`, `src/lib/warranty.ts`, `src/services/khata.test.ts`, `src/services/khata.ts`
- Also new: this `AGENTS.md` memory file.

## How To Resume

1. Read this file.
2. Run `git status` and inspect the working tree.
3. Run `npm run typecheck && npm run test && npm run lint` to confirm current state.
4. Phase 4 is complete and documented; khata payment smoke test passed.
5. Run `npm run build` before starting new work.
6. Start Phase 5 (service worker/offline app shell) or another feature.
