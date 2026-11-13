# GramBill POS

**Offline-first billing, inventory, barcode, and udhaar (khata) software for
rural and semi-urban electronics shops.**

GramBill POS runs entirely on the shop laptop. No internet connection is
required for billing, stock, customer balances, or reports. Data is stored in
the browser's IndexedDB database and can be exported to a JSON backup file.

> **Current status:** Phase 2 inventory and barcode work is complete. The app
> shell, local database, shop settings, backup/restore, product CRUD, stock-in,
> CSV import/export, and CODE128 label printing are working. Billing, scanning,
> invoices, khata entries, and reports are planned for Phases 3–4.

## What works today

| Area | Status |
| --- | --- |
| Offline local database (Dexie + IndexedDB) | Working |
| Seeded catalog (15 products) and 4 customers | Working |
| Shop profile and invoice settings | Working |
| English / Hinglish interface switch | Working |
| Live dashboard counts and low-stock stats | Working |
| JSON backup and restore | Working |
| USB barcode scanning | Phase 3 |
| Product add/edit, floor price, and stock-in | Working |
| CSV product import, export, and template | Working |
| CODE128 barcode studio and A4/thermal labels | Working |
| Billing cart, checkout, and invoice printing | Phase 3 |
| Udhaar ledger, warranty lookup, and reports | Phase 4 |
| Installable PWA / offline service worker | Phase 5 |

## Tech stack

- **UI:** React 18, TypeScript (strict), Vite, Tailwind CSS v4
- **Icons:** `lucide-react`
- **Storage:** Dexie 4 over IndexedDB
- **Barcode/QR:** `jsbarcode`, `qrcode`, `html5-qrcode`
- **Testing:** Vitest, React Testing Library, `fake-indexeddb`
- **Backend:** none in V1; fully static and local-first
- **Deployment:** static hosting or local laptop only

## Getting started

### Requirements

- Node.js 20 or newer
- npm 10 or newer
- A modern browser (Chrome, Edge, or Firefox)

### Install and run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

If npm reports permission errors for its cache:

```bash
sudo chown -R "$(id -u):$(id -g)" ~/.npm
```

### Production build

```bash
npm run build
npm run preview
```

The production files are written to `dist/`.

## Available scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run typecheck` | Run TypeScript without emitting files |
| `npm run test` | Run the Vitest test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |

## Project structure

```text
src/
  app/                 App shell, hash routing, layout, and navigation
  components/          Shared UI primitives and placeholder component
  features/            Feature modules:
    pos/               Counter foundation dashboard
    inventory/         Inventory management
    barcode/           Barcode studio
    khata/             Udhaar ledger
    invoices/          Invoices and warranty lookup
    reports/           Sales and profit reports
    settings/          Shop profile, UPI, backup, and storage
  db/                  Dexie schema, seed data, constants, backup/restore
  hooks/               Shared React hooks such as useSettings
  i18n/                English and Hinglish translations
  lib/                 Money, date, invoice number, UPI, validation, and ID helpers
  services/            Database-backed application services
  test/                Vitest setup
  types/               Shared TypeScript domain types
  main.tsx             Database bootstrap and React mount
public/                Manifest, icons, and static assets
docs/
  PLAN.md              Architecture, file map, and phase plan
  BACKEND_SCALING_AND_INTEGRATION.md
                       Future cloud, multi-shop, and integration design
  Rural Pos V1 Master Plan And Llm Prompt.md.pdf
                       Source product blueprint
```

## Data, backup, and privacy

- All business data stays on the shop laptop in IndexedDB under the database
  name `grambill-pos`.
- The database is seeded once with demo products and customers on first launch.
- No customer or sales data is sent to a server in V1.
- Use **Shop Settings → Download backup** regularly. The JSON backup includes
  shop settings, products, customers, invoices, khata transactions, and stock
  movements.
- Restore replaces the local database with the selected backup file.
- Keep backups in a safe location. Do not commit customer backups to Git.

The app requests persistent browser storage when supported, but the browser can
still clear data if storage is manually cleared. JSON backups are the recovery
path.

## Phase roadmap

| Phase | Scope |
| --- | --- |
| **Phase 1** | Foundation: app shell, database, seed data, settings, language, backup/restore |
| **Phase 2** | Inventory and barcode studio: product CRUD, stock adjustments, search, labels |
| **Phase 3** | Billing counter: scanner input, cart, payments, invoices, thermal/A4 printing |
| **Phase 4** | Khata ledger, warranty/serial lookup, daily sales and profit reports |
| **Phase 5** | PWA polish: service worker, offline install, print tuning, performance |

See [docs/PLAN.md](./docs/PLAN.md) for the detailed architecture and acceptance
criteria. See
[docs/BACKEND_SCALING_AND_INTEGRATION.md](./docs/BACKEND_SCALING_AND_INTEGRATION.md)
for the future cloud mirror, owner dashboard, catalog import, and multi-shop
scaling plan.

## Testing

```bash
npm run test
npm run typecheck
npm run lint
```

Current coverage includes money rounding, date/warranty helpers, invoice
numbering, UPI URIs, shop and product validation, barcode/SKU helpers, CSV
round-trips, stock-in movements, label pagination/skip offsets, and JSON backup
validation/restore.

## Known limitations

- Billing, khata, warranty lookup, and reports are placeholders until Phases 3–4.
- No multi-counter sync or cloud backup yet.
- Invoice cancellation/return is designed as full-invoice only.
- Barcode scanning and invoice printing are Phase 3 work; label printing is ready.
- One billing laptop per shop is the intended V1 deployment model.

## Source specification

The product blueprint is in
[`docs/Rural Pos V1 Master Plan And Llm Prompt.md.pdf`](./docs/Rural%20Pos%20V1%20Master%20Plan%20And%20Llm%20Prompt.md.pdf).
