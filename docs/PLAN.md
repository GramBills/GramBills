# GramBill POS V1 - Architecture & Build Plan

Source specification: `Rural Pos V1 Master Plan And Llm Prompt.md.pdf` (21 pages).

Related document: `BACKEND_SCALING_AND_INTEGRATION.md` - backend tiers, cloud
sync, tenant model, and integration roadmap beyond V1.

GramBill POS is a laptop-first, 100% offline Point of Sale, Inventory, Barcode
Generation, and Udhaar (Khata) billing application for Indian electronics shops
and rural/semi-urban retail stores.

## 1. Scope Lock

**In V1**

- Offline laptop PWA for counter billing.
- Inventory management with floor price, low-stock alerts, and serial/IMEI tracking.
- Free barcode generation and A4/thermal sticker printing.
- Serial/IMEI capture with warranty period and expiry tracking.
- Cash, UPI, card, split, and udhaar payments.
- Dynamic amount-locked UPI QR codes.
- Customer udhaar ledger with WhatsApp reminders.
- Past bill, warranty, and serial/IMEI lookup.
- Daily sales, cash, UPI, and profit reports.
- One-click JSON backup and restore.
- English and Hinglish interface.

**Out of V1**

- Cloud sync and multi-shop SaaS.
- Multi-user accounts and permissions.
- Native mobile app (PWA only).
- Online payment gateway and automatic UPI confirmation.
- GST filing, e-invoice, and e-way bill.
- Supplier purchase order management beyond stock-in.
- Item-level returns (full-invoice cancel/return only).

## 2. Stack & Tooling

| Area | Choice |
| --- | --- |
| Runtime | React 18 + TypeScript (strict) + Vite |
| Styling | Tailwind CSS + `lucide-react` |
| Database | Dexie.js + `dexie-react-hooks` (IndexedDB) |
| Barcode/QR | `jsbarcode`, `qrcode`, `html5-qrcode` |
| PWA | `vite-plugin-pwa` (manifest Phase 1, service worker Phase 5) |
| Testing | Vitest + React Testing Library |
| Tooling | npm, ESLint, Prettier, `tsc --noEmit` |
| Backend | None; fully static, no network calls |

## 3. Architecture Decisions

- **Local-first only:** all reads and writes go to IndexedDB. There is no API
  layer and no Supabase in V1.
- **Tab SPA with hash routing** (`#/pos`, `#/inventory`, etc.) so refresh,
  back/forward navigation, and deep links work without a router dependency.
- **Base entity fields** on every table: `id` (crypto UUID), `shopId`
  (`local-shop-01`), `createdAt`, `updatedAt`, `syncStatus`
  (`synced | pending`) for future cloud sync.
- **Money:** store rupee numbers per the blueprint, but route all arithmetic
  through `lib/money.ts` (`round2`, paise-safe helpers). No ad-hoc float math
  in components.
- **Invoice items embedded** in `Invoice.items`, matching Prompt 1, instead of a
  separate physical `invoiceItems` store. Warranty search scans invoices in
  memory; acceptable for V1 volumes (~10k bills). Revisit if search slows.
- **Cached balances are guarded:** `products.stockQty` and
  `customers.currentUdhaarBalance` are updated atomically alongside
  `stockMovements` and `khataTransactions`. Reconciliation utilities handle
  restore/repair.
- **Atomic checkout:** invoice, stock deduction, stock movements, customer
  balance, and khata transaction commit in one Dexie transaction.
- **Invoice numbering:** `shopSettings.nextInvoiceNumber` increments inside the
  checkout transaction. Single-laptop usage avoids contention.
- **GST calculation** lives in `lib/gst.ts`: line net, item and extra discount
  allocation, taxable/tax derivation for inclusive or exclusive pricing,
  invoice rounding, and `roundOff`. Unit tested.
- **Printing** uses dedicated print-only DOM nodes and `@media print`. Screen
  UI never participates in print output.
- **UPI QR** encodes the exact NPCI UPI Linking URI. It is a payment request;
  the app does not claim automatic payment confirmation.

## 4. Data Model

Physical stores:

1. `shopSettings`
2. `products`
3. `customers`
4. `invoices`
5. `khataTransactions`
6. `stockMovements`

`Invoice.items` is embedded in the invoice record.

Key invariants:

- `invoice.grandTotal = cashPaid + upiPaid + cardPaid + udhaarAmount`
- `udhaarAmount = grandTotal - (cashPaid + upiPaid + cardPaid)`
- `balanceAfter` in a khata transaction reflects the balance after that entry.
- `products.stockQty` mirrors opening stock plus the sum of
  `stockMovements.qtyChange`.
- Serial/IMEI count per line matches quantity when tracking is enabled.
- Cancelled or returned invoices restore stock and reverse udhaar exactly once.

## 5. File Map

```text
package.json, vite.config.ts, tsconfig*.json, tailwind config, index.html
public/                         icons, manifest assets
docs/                           architecture, backend plan, source PDF
src/main.tsx                    database bootstrap + React mount
src/app/App.tsx                 hash router + global shortcuts
src/app/Layout.tsx              sidebar, top bar, offline badge
src/app/navigation.ts           ViewKey + navigation items
src/index.css                   Tailwind + print styles
src/types/pos.ts                all entities, enums, form types
src/db/database.ts              GramBillDB, schema versions, hooks
src/db/seed.ts                  shop settings, 15 products, 4 customers
src/db/backup.ts                export/import JSON, validate, restore
src/db/reconcile.ts             stock/khata consistency checks
src/services/invoices.ts        checkout transaction, cancel/return
src/services/products.ts        CRUD, barcode generation, stock-in
src/services/customers.ts       CRUD, udhaar payments
src/lib/money.ts                round2, INR formatting, margin
src/lib/gst.ts                  taxable/tax/discount allocation
src/lib/invoiceNumber.ts        prefix + sequence formatting
src/lib/upi.ts                  NPCI URI + QR payload
src/lib/whatsapp.ts             receipt/reminder message builders
src/lib/csv.ts                  inventory export/import/template
src/lib/date.ts                 ISO, warranty expiry, ranges
src/lib/id.ts                   UUID + barcode sequence helpers
src/lib/sound.ts                Web Audio beeps/chime
src/i18n/translations.ts        English/Hinglish dictionary
src/hooks/useBarcodeScanner.ts
src/hooks/useKeyboardShortcuts.ts
src/hooks/useSettings.ts
src/features/pos/POSCounterView.tsx
src/features/pos/cart.ts              cart totals, floor checks, 5 hold slots
src/features/pos/CheckoutModal.tsx    cash/UPI/card/split/udhaar checkout
src/features/pos/InvoiceReceiptModal.tsx
src/features/pos/CustomerPicker.tsx
src/features/pos/CameraScannerModal.tsx
src/features/pos/UpiQr.tsx
src/features/pos/useUpiQrDataUrl.ts
src/features/inventory/InventoryView.tsx
src/features/inventory/ProductModal.tsx
src/features/inventory/StockInModal.tsx
src/features/barcode/BarcodeStudioView.tsx
src/features/barcode/BarcodeSvg.tsx
src/features/khata/KhataLedgerView.tsx
src/features/invoices/InvoicesWarrantyView.tsx
src/features/reports/ReportsDashboardView.tsx
src/features/settings/ShopSettingsView.tsx
src/components/ModulePlaceholder.tsx
src/components/PrintSheets.tsx   thermal/A4 invoice + sticker sheets
src/components/ui/               Button, Modal, Field, Badge, Toast
src/test/setup.ts, src/**/*.test.ts(x)
```

## 6. Phases & Acceptance Criteria

### Phase 1 - Foundation (Prompt 1)

**Status:** Complete and verified.

Scaffold Vite + React + TypeScript + Tailwind + Dexie. Define all tables and
indexes. Seed shop settings, 15 products, and 4 customers. Add sound utility,
i18n dictionary, layout with offline badge and `Alt+1..7` navigation, shop
settings form, and JSON backup/restore.

Acceptance:

- `npm run dev` loads the app.
- Seed data appears and settings persist after refresh.
- Backup downloads and restore round-trips.
- Lint, typecheck, tests, and build pass.

### Phase 2 - Inventory & Barcode (Prompt 2)

**Status:** Complete and verified.

Inventory summary cards and filters. Product CRUD with floor price and margin.
Quick stock-in. CSV import/export and template. Serial/IMEI and warranty fields.
Barcode studio with 65-up and 40-up A4 layouts, thermal layout, skip-offset,
label customization, and print execution.

Acceptance:

- Custom barcode generated as `SKU000XXXX`.
- CODE128 preview renders.
- Stock-in logs a `purchase_in` movement.
- CSV round-trip works.
- Sticker print produces the correct grid and respects skip count.

### Phase 3 - POS & Checkout (Prompt 3)

**Status:** Complete. Automated checks pass and Chrome smoke testing covered
cash checkout, udhaar checkout, global scanner input, unknown-barcode quick-add,
hold tabs, stock deduction, and A4 print-sheet rendering. Camera capture and
physical thermal/A4 printer output still need real-hardware verification.

Global hardware scanner hook and webcam fallback. Five hold tabs. Kachha/Pakka
toggle. Serial/IMEI and warranty capture. Floor-price warnings. Item and extra
discounts. Cash, UPI, split, and udhaar checkout. Dynamic UPI QR. Atomic commit.
Thermal and A4 receipts. WhatsApp share and print.

Acceptance:

- Scan adds an item anywhere on screen.
- Unknown scan opens quick-add with barcode prefilled.
- Checkout updates invoice, stock, and khata atomically.
- Cash change and split totals are correct.
- WhatsApp text includes warranty dates and remaining balance.

### Phase 4 - Khata, Warranty, Reports (Prompt 4)

**Status:** Next.

Khata dashboard with village filter, passbook, payment recording, and WhatsApp
reminder. Invoice/serial/phone search with live warranty status and
cancel/return. Reports with cash, UPI, profit, top products, and low-stock
reorder list.

Acceptance:

- Khata balance reconciles to transactions.
- Warranty badge is correct.
- Cancellation restores stock and reverses udhaar once.
- Report totals match invoices.

### Phase 5 - PWA & Polish

Service worker caching, install manifest, print CSS audit, keyboard audit,
empty/error/loading states, seed reset, and data volume test.

Acceptance:

- App reloads and bills with network disabled after first load.
- No console errors.
- Print isolates only the correct sheet.

## 7. Verification Strategy

- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`
  after every phase.
- Unit tests:
  - Money rounding.
  - GST inclusive/exclusive and discount allocation.
  - Split/udhaar totals.
  - Khata balance.
  - Invoice numbering.
  - Warranty expiry.
  - UPI URI encoding.
  - Backup validation.
- Manual smoke matrix:
  - Real USB scanner.
  - Webcam scan.
  - 58mm and 80mm thermal print.
  - A4 invoice.
  - 65-up and 40-up sticker sheets with skip offset.
  - Offline reload.
  - Backup restore on a clean database.
- Load test with seed data plus a generated dataset of 5k products and 2k
  invoices.

## 8. Main Risks

| Risk | Mitigation |
| --- | --- |
| Browser data loss | One-click JSON backup, restore validation, auto-backup reminder |
| Float rounding | Central money helpers and tests, invoice-level round-off |
| Cache/stock drift | Atomic transactions plus reconciliation utility |
| Print layout differences | mm-based CSS, dedicated print nodes, test on real printers |
| WhatsApp text limits | Compact receipt formatter, truncate long item lists |
| Scanner timing conflicts | 45ms buffer, ignore slow human typing, input override |
| No payment confirmation | Label QR as payment request; shopkeeper confirms manually |

## 9. Locked Defaults

1. Tailwind v4 via `@tailwindcss/vite`.
2. Vitest + React Testing Library added in Phase 1.
3. Embedded invoice items; no separate `invoiceItems` store.
4. Rupee numbers with centralized rounding.
5. Full-invoice cancel/return only in V1.
6. English + Hinglish initially; Hindi strings can be added later.
7. PWA manifest now, service worker in Phase 5.
8. Deploy target: static Netlify/Vercel or local install.

## 10. Working Agreement

- Implement one phase at a time and verify before moving to the next.
- Update this document if a locked default changes.
- Do not commit unless explicitly requested.
- Keep all money, tax, khata, and stock mutations inside tested service
  functions.
