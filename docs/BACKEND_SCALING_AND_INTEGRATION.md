# GramBill POS - Backend Scaling & Integration Plan

Related documents:

- `PLAN.md` - V1 architecture and build plan.
- `Rural Pos V1 Master Plan And Llm Prompt.md.pdf` - source product blueprint.

This document explains how the V1 backend works, what it can and cannot scale
to, how other shop owners would adopt the product, and what must be added
before selling beyond a single shop.

## 1. Executive Summary

GramBill V1 has no separate server. The "backend" runs inside the browser as a
local data layer:

```text
React UI
  -> service layer (TypeScript business logic)
     -> Dexie transaction
        -> IndexedDB on the shop's laptop
```

This is excellent for offline billing, privacy, and zero server cost. It is
also deliberately limited:

- One device and one database per shop.
- No central backup, remote support, or owner dashboard.
- No multi-counter sync.
- No public API or third-party integration.
- No automatic payment confirmation.

The V1 architecture can scale to unlimited shops because the same static app is
installed by each shop. It cannot scale operationally to many shops until a
cloud control plane is added. The recommended path is:

1. Finish V1 as a standalone offline product.
2. Add automatic cloud backup and restore (Tier 1.5) before onboarding other
   shops.
3. Add a shop account and read-only owner dashboard.
4. Add multi-device sync only when a real shop needs a second counter.
5. Add APIs, accounting exports, and payment integrations after the data model
   is stable in real shops.

## 1.1 Chosen Launch Path (Decision)

**Target:** start with our own shop, then expand to 10-20 shops within 6 months.

This choice changes the sequencing, not the V1 architecture:

- V1 standalone offline remains the first milestone.
- Cloud backup and shop accounts are **not optional** once other shops are
  involved. They must be live before shop #4 or #5, not after shop #20.
- Full multi-counter sync can still wait. It is only needed if a target shop
  actually runs two billing counters.
- Onboarding, data import, backup monitoring, and support must be productized
  early. With 10-20 shops, manual hand-holding becomes the bottleneck long
  before the code does.
- The first cloud tier should be a **one-way cloud mirror**: local billing stays
  authoritative, completed invoices and ledgers upload to the cloud, and the
  owner dashboard reads from the cloud. Bidirectional sync belongs to Tier 2.

### Suggested 6-Month Sequence

| Month | Focus | Exit criteria |
| --- | --- | --- |
| Month 1 | Run V1 in our own shop daily | 100+ real bills, zero data loss, restore test passed |
| Month 2 | Cloud backup, shop accounts, CSV import wizard, diagnostics | Restore to a clean laptop in under 30 minutes |
| Month 3 | Pilot 3-5 friendly shops with white-glove onboarding | Onboarding playbook and measured setup time |
| Month 4 | Owner dashboard, GST/accounting export, backup monitoring | Owners can see sales and udhaar remotely |
| Month 5 | Productize onboarding and support, standardize hardware bundle | Repeatable setup with minimal founder time |
| Month 6 | Scale to 10-20 shops | Backup coverage above 95%, support load under control |

### Gate Before Onboarding Other Shops

Do not onboard shop #2 until these are true:

1. Backup and restore have both been tested on a fresh laptop.
2. The CSV catalog import handles real shop data, including errors.
3. A support contact and remote diagnostics path exist.
4. A version update and schema migration process exists.
5. Hardware recommendations are fixed to one scanner and one printer model.
6. A shop can be set up from zero to first printed bill using a checklist.

### Explicitly Deferred

- Bidirectional multi-device sync.
- Public API and webhooks.
- Payment gateway reconciliation.
- WhatsApp Business API automation.
- Distributor ordering and marketplace sync.

These are revisited only when a paying shop asks for them.

### Locked Decisions

| Decision | Choice | Consequence |
| --- | --- | --- |
| Launch path | Own shop, then 10-20 shops in 6 months | Cloud backup and onboarding must land early |
| Counters per shop | One laptop per shop | No bidirectional multi-counter sync in the first 6 months |
| Owner visibility | Phone dashboard is important | Build a one-way cloud mirror and read-only dashboard |
| First integration | Catalog import | Invest in CSV mapping, validation, and onboarding tooling |
| Support model | Founder only | Productize setup, diagnostics, restore, and documentation |

### Founder-Only Support Constraints

With one person onboarding and supporting 10-20 shops, the product must absorb
most of the support work:

- Self-serve setup wizard with a printed checklist.
- CSV import with preview, validation, and downloadable error reports.
- In-app diagnostics export and readable error messages.
- Automatic backup status visible to the owner and to the founder.
- Self-serve restore flow that does not require a support call.
- One recommended scanner model and one recommended printer model.
- Short Hinglish setup and training videos.
- A lightweight internal admin view: shop list, last backup, last sync, app
  version, device, and recent errors.
- No per-shop customizations in the first 6 months.
- Cap onboarding at 10-12 shops until setup time drops below one day per shop.

### One-Way Cloud Mirror (Tier 1.5)

Because each shop has one laptop but the owner needs phone visibility, the
first cloud tier is a one-way mirror:

```text
Shop laptop (authoritative)
  -> outbox after each completed bill
     -> Supabase (backup + read model)
        -> owner phone dashboard
        -> founder admin monitoring
```

Rules:

- Local billing never waits for the network.
- Completed invoices, khata transactions, products, customers, and settings
  upload in the background with retries.
- Cloud is a backup and read model, not the source of truth.
- Restore downloads the latest cloud state to a fresh laptop.
- No automatic bidirectional merge in this tier.

## 2. What "Scalable" Means Here

There are three different scaling questions:

| Question | V1 answer |
| --- | --- |
| Can many shops use the same product? | Yes. One static app, unlimited independent installations. |
| Can one shop store a lot of data? | Yes, within browser storage limits, with indexes and backup. |
| Can many shops be operated centrally? | No. Requires cloud accounts, backup, support, and sync. |

Distribution scales. Operations do not, yet.

## 3. V1 Scalability Matrix

| Dimension | V1 local backend | Practical limit | Mitigation / next step |
| --- | --- | --- | --- |
| Shops using the app | Unlimited | None technically | Same PWA served to all shops |
| Products per shop | Good | 10k-50k with indexes | Indexed search, CSV import |
| Invoices per shop | Good to moderate | 10k-100k | Indexed queries, cached report totals |
| Invoice items | Embedded in invoice | Large bills fine | Archived/exported if storage grows |
| Storage | Browser quota | Varies by browser/device | `navigator.storage.persist()`, backup |
| Devices per shop | One | One laptop | Cloud sync in Tier 2 |
| Staff accounts | None | Shared device | Auth and roles in Tier 1.5/2 |
| Owner remote access | None | None | Read-only dashboard in Tier 1.5 |
| Automatic backup | None | Manual JSON | Cloud backup in Tier 1.5 |
| Remote support | None | None | Diagnostics and logs in cloud tier |
| Third-party API | None | CSV only | Public API in Tier 3 |
| UPI confirmation | Manual | Shopkeeper checks phone | Payment gateway in Tier 3 |
| WhatsApp | Click-to-chat | Manual send | WhatsApp Business API later |
| Offline billing | Full | Full | Keep as core advantage |

## 4. Backend Tiers

### Tier 1 - Standalone Offline (V1)

**Goal:** fast, reliable billing with zero internet and zero server cost.

Components:

- Static React PWA.
- Dexie + IndexedDB.
- Service layer with all business rules.
- CSV import/export.
- Manual JSON backup and restore.
- WhatsApp click-to-chat.
- Dynamic UPI QR displayed on screen.

Strengths:

- No hosting bill.
- No data leaves the laptop.
- Works in low-connectivity villages.
- Simple to install and demo.

Limits:

- Manual backup.
- No remote visibility.
- No multi-device.
- No API.
- No central support.

**Use when:** running your own shop, dogfooding, and doing live demos.

### Tier 1.5 - Offline-First + Cloud Backup

**Goal:** make the product safe to sell to other owners without rebuilding the
billing engine.

Components:

- Supabase project with per-shop accounts.
- Automatic encrypted backup of local data.
- Restore to a new laptop.
- Read-only owner dashboard on a phone.
- Device registration.
- Basic diagnostics and version reporting.

What stays local:

- Billing, printing, scanning, barcode generation, and all offline operations.

What moves to cloud:

- Backup, account identity, owner reporting, device list, and support logs.

Strengths:

- Solves the biggest operational risk: data loss.
- Enables remote owner visibility.
- Low engineering effort compared with full sync.
- Can be sold as a paid tier.

Limits:

- Still one active billing device per shop unless sync is added.
- Restore is not the same as real-time multi-device sync.

**Use when:** onboarding the first 10-50 shops.

### Tier 2 - Multi-Device Sync and Multi-Counter

**Goal:** let a shop run two or more billing counters that share stock, invoices,
customers, and khata.

Components:

- Shop account with members and roles.
- Device registration and revocation.
- Local outbox and background sync worker.
- Server change feed and sync cursors.
- Conflict handling for mutable records.
- Central or device-prefixed invoice numbering.
- Row-Level Security by `shop_id`.

What syncs:

- Invoices and invoice items.
- Stock movements.
- Khata transactions.
- Products and customers.
- Shop settings.

Strengths:

- Real multi-counter support.
- Owner can see live sales.
- Central backup and audit history.

Limits:

- Higher engineering and support complexity.
- Conflict handling must be designed carefully.
- Offline-first semantics must remain intact.

**Use when:** a real shop needs a second counter or the owner needs live
multi-device visibility.

### Tier 3 - Integrations and Ecosystem

**Goal:** connect the POS to the shop's wider business systems.

Components:

- Public REST API and webhooks.
- Accounting exports and Tally integration.
- Distributor ordering and purchase workflows.
- Payment gateway reconciliation.
- WhatsApp Business API reminders.
- E-commerce or marketplace sync.
- GST reporting exports.

Strengths:

- Higher customer value and retention.
- Opens channel partnerships and integrations.

Limits:

- Significant scope.
- Requires stable data model and cloud backend.
- Integration support becomes a product function.

**Use when:** the core product is stable and shops are asking for specific
integrations.

## 5. Tier Comparison

| Capability | Tier 1 | Tier 1.5 | Tier 2 | Tier 3 |
| --- | --- | --- | --- | --- |
| Offline billing | Yes | Yes | Yes | Yes |
| Barcode and sticker printing | Yes | Yes | Yes | Yes |
| Manual JSON backup | Yes | Yes | Yes | Yes |
| Automatic cloud backup | No | Yes | Yes | Yes |
| Shop accounts and login | No | Yes | Yes | Yes |
| Owner phone dashboard | No | Read-only | Live | Live |
| Multi-counter sync | No | No | Yes | Yes |
| Roles and permissions | No | Basic | Yes | Yes |
| Public API | No | No | Limited | Yes |
| Payment confirmation | No | No | No | Yes |
| Accounting integration | No | No | Export | Direct |
| Relative engineering effort | Low | Medium | High | Very high |

## 6. How Other Shop Owners Integrate

Integration is not only an API. For a rural shop, integration means getting
their existing business data in, using the product daily, and getting useful
data out.

### A. Data In

- Install the PWA from a URL.
- Create the shop profile with name, address, phone, GSTIN, and UPI ID.
- Import catalog through CSV/Excel with column mapping.
- Import opening stock.
- Import customers and outstanding udhaar.
- Optionally import past invoices where formats allow.
- Print a test barcode sticker and a test bill.

Requirement: a real import wizard with validation, preview, and error reports.
Manual data entry does not scale across many shops.

### B. Daily Operations

- USB or wireless barcode scanner as keyboard input.
- Laptop webcam as scanner fallback.
- Thermal 58mm/80mm receipt printing.
- A4 invoice printing.
- A4 sticker sheet printing for unbarcoded items.
- Cash, UPI, card, split, and udhaar payments.
- Dynamic UPI QR displayed on the laptop.
- WhatsApp bill sharing through `wa.me`.
- Low-stock alerts and reorder lists.

These are local and continue working offline.

### C. Data Out

- Daily sales, cash, UPI, profit, and margin reports.
- Customer khata statements.
- Warranty and past bill lookup.
- GST-ready CSV export.
- Full JSON backup.
- Later: Tally XML and accounting exports.

### D. External Systems

V1 cannot be integrated by third-party software because a browser app cannot
accept inbound API calls. Real integrations require either a cloud backend with
APIs and webhooks or a local desktop agent exposing a local API.

For V1, file-based integration is the honest boundary.

## 7. Architecture Principles to Preserve

These principles make the upgrade path possible without a rewrite.

1. **UI never calls Dexie directly.** Screens call service functions. Those
   functions can later call local Dexie or a cloud API.
2. **Domain logic stays pure.** Money, GST, invoice numbering, warranty dates,
   and khata rules live in plain TypeScript modules, independent of React and
   Dexie.
3. **Append-only ledgers.** Stock movements and khata transactions are
   append-only. This makes sync, audit, and repair far easier.
4. **Client-generated UUIDs.** Safe retries and idempotency when sync arrives.
5. **Soft deletes.** Use `deletedAt` instead of hard deletes for synced data.
6. **Base fields everywhere.** `shopId`, `deviceId`, `userId`, `createdAt`,
   `updatedAt`, `syncStatus`.
7. **Schema versioning and migrations from day one.** PWA updates will change
   the local database.
8. **Backup is a product feature.** It cannot be an afterthought for
   non-technical owners.

## 8. Data Model Changes to Plan For

Current V1 stores already include tenant-ready fields. For cloud tiers, add:

| Table | Purpose |
| --- | --- |
| `shops` | Tenant record, plan, GSTIN, UPI settings |
| `shop_members` | Owner, manager, cashier membership |
| `devices` | Registered laptops/phones per shop |
| `subscriptions` | Plan, renewal, offline grace period |
| `sync_outbox` | Pending local changes to push |
| `sync_state` | Per-device last pull cursor |
| `audit_log` | Sensitive actions and support actions |

Existing manufacturing tables gain:

- `deviceId` on invoices to identify the counter.
- `userId` on invoices, payments, and khata actions.
- `deletedAt` on mutable records.
- `serverUpdatedAt` for conflict resolution.
- `version` for optimistic concurrency.

## 9. Sync Design for Tier 2

The data model is friendly to sync because the risky parts are append-only.

| Data | Sync behavior |
| --- | --- |
| Invoices | Immutable after completion; append only |
| Stock movements | Append only |
| Khata transactions | Append only |
| Products | Mutable; field-level or last-write-wins |
| Customers | Mutable; field-level or last-write-wins |
| Shop settings | Server-authoritative or owner-only |
| Deletes | Soft delete with `deletedAt` |

Design rules:

- **Outbox pattern:** every local write that must sync creates an outbox entry.
- **Idempotency:** client UUIDs and unique constraints prevent duplicates.
- **Server timestamps:** order changes on the server; show local time in UI.
- **Pull cursors:** each device tracks the last server change it has seen.
- **Conflict policy:** append-only data never conflicts; product/customer edits
  need an explicit rule and, where necessary, a conflict review screen.
- **Cached projections:** stock quantity and udhaar balance remain cached for
  speed but are rebuildable from movements and transactions.

## 10. Invoice Numbering Across Devices

Two offline devices must never generate the same invoice number.

Options:

1. **Device-prefixed numbers** - `C1-INV-2026-0001`, `C2-INV-2026-0001`.
   Simple, offline-safe, readable.
2. **Server-reserved blocks** - each device reserves a block of numbers when
   online and consumes it offline.
3. **Central sequence** - requires connectivity at billing time; not acceptable
   for rural offline use.

Recommendation: device-prefixed numbers for Tier 2, with the prefix visible on
invoices and reports.

## 11. Tenant, Auth, and Security Model

When cloud is added:

- **Tenant isolation:** every row carries `shop_id`; Postgres Row-Level Security
  enforces isolation.
- **Authentication:** phone OTP plus a shop PIN. Rural-friendly and familiar.
- **Offline session:** cache the authenticated session locally, but require a
  local PIN to open the app.
- **Roles:** owner, manager, cashier. Cashier cannot view purchase price,
  profit reports, or shop settings.
- **Device control:** register devices and allow remote revocation.
- **Backup encryption:** encrypt cloud backups and protect restore operations.
- **Audit log:** record invoice cancellation, returns, price overrides, khata
  adjustments, and support access.
- **Support access:** read-only and consent-based, never silent impersonation.

Local V1 risk: IndexedDB is not encrypted by default. A stolen laptop exposes
shop data. A PIN lock and encrypted backup should be considered for Tier 1.5.

## 12. Backup Strategy

Manual JSON backup is not enough for other owners.

Recommended progression:

1. **V1:** manual JSON export/import plus a reminder to back up.
2. **Tier 1.5:** automatic encrypted cloud backup after each completed bill or
   on a schedule, with restore to a new laptop.
3. **Tier 2:** server-side point-in-time history and per-device sync.
4. **All tiers:** periodic restore test, because an untested backup is not a
   backup.

Success metrics:

- Backup success rate.
- Time to restore a shop to a new laptop.
- Number of shops with no backup in the last 7 days.

## 13. Integration Roadmap

| Priority | Integration | Tier | Notes |
| --- | --- | --- | --- |
| 1 | CSV catalog import/export | V1 | Required for onboarding |
| 2 | Manual JSON backup/restore | V1 | Data safety |
| 3 | WhatsApp click-to-chat | V1 | Bills and reminders |
| 4 | UPI QR | V1 | Payment request only |
| 5 | Cloud backup and restore | Tier 1.5 | First paid cloud feature |
| 6 | Owner phone dashboard | Tier 1.5 | Read-only sales and udhaar |
| 7 | GST/accounting CSV export | Tier 1.5 | Accountant-friendly |
| 8 | Multi-counter sync | Tier 2 | Requires real demand |
| 9 | Tally XML export | Tier 2/3 | Common in Indian retail |
| 10 | Public API and webhooks | Tier 3 | Third-party integration |
| 11 | Payment gateway reconciliation | Tier 3 | Removes manual UPI checks |
| 12 | WhatsApp Business API | Tier 3 | Automated reminders |
| 13 | Distributor ordering | Tier 3 | Purchase workflow |
| 14 | E-commerce/marketplace sync | Tier 3 | Only if demanded |

## 14. Honest Limitations and Customer Messaging

Do not oversell capabilities that V1 does not have.

| Claim risk | Reality | Honest message |
| --- | --- | --- |
| "Automatic UPI confirmation" | QR is a payment request | "Customer pays by UPI; you confirm on your phone." |
| "Automatic WhatsApp reminders" | V1 opens a pre-filled chat | "One-click reminder; you press send." |
| "Multi-counter" | V1 is one laptop | "One counter per laptop in V1." |
| "Cloud backup" | V1 is manual | "Manual backup in V1; automatic backup in the cloud plan." |
| "Works on any printer" | Browser print depends on drivers | "Tested with 58/80mm thermal and A4 printers." |
| "Unlimited storage" | Browser quota | "Designed for typical shop volumes; backups protect against loss." |

## 15. Commercial and Operational Model

Distribution is cheap because there is no server per shop. The paid value is in
operational reliability and visibility.

Possible tiers:

| Plan | Includes |
| --- | --- |
| Free/Starter | Offline billing, inventory, barcode, manual backup |
| Pro | Automatic cloud backup, owner dashboard, accounting export |
| Multi-counter | Device sync, roles, live owner view |
| Integration | API, payment reconciliation, distributor ordering |

Onboarding services:

- Done-for-you catalog import.
- First 100 products and barcode sticker sheets.
- Hardware setup: scanner, thermal printer, A4 sticker paper.
- Staff training and a test bill.
- Local agent commission model for villages.

## 16. Risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Data loss on laptop | Business-critical | Automatic cloud backup, restore tests |
| Stock/khata drift | Wrong reports and balances | Append-only ledgers, reconciliation jobs |
| Sync conflicts | Wrong prices or stock | Last-write-wins for mutable data, append-only for ledgers |
| Invoice number collision | Legal/accounting confusion | Device prefixes or reserved blocks |
| Tenant data leakage | Trust and legal damage | RLS, tests, least-privilege roles |
| Browser storage eviction | Data loss | Persistent storage, backup |
| PWA stale version | Mixed schema behavior | Version checks and migrations |
| Support burden | Costs grow with shops | Diagnostics, logs, self-serve restore |
| Integration scope creep | Delays core product | Tiered roadmap and paid integrations |
| Payment gateway complexity | Reconciliation errors | Add only with a clear provider and support plan |

## 17. Decision Framework

Before changing the architecture, answer these questions:

1. **Launch target:** only your own shop, or 10-50 shops within 6 months?
2. **Counters per shop:** does any target shop need two billing counters?
3. **Remote owner access:** does the owner need to see sales from home?
4. **Integration priority:** catalog import, accounting export, or distributor
   ordering?
5. **Connectivity:** are target shops offline most of the day?
6. **Support model:** who restores data and trains staff?
7. **Pricing:** is cloud backup a paid feature or included?
8. **Data privacy:** do shops require local-only data, or is encrypted cloud
   backup acceptable?

Decided for this launch:

- Start with our own shop, then reach 10-20 shops within 6 months.
- One billing laptop per shop; defer multi-counter sync.
- Owner phone dashboard is important; build it in the first cloud tier.
- Catalog import is the first integration.
- Support is founder-only, so setup and recovery must be self-serve.
- Automatic cloud backup is required before onboarding shop #2.
- Keep offline billing as the non-negotiable core.

## 18. Recommended Roadmap

### Milestone 0 - V1 standalone (current plan)

- Offline billing, inventory, barcode studio, checkout, khata, reports.
- Manual backup and CSV import/export.
- Dogfood in a real shop.

### Milestone 1 - Cloud backup and accounts

- Shop account, device registration, automatic encrypted backup.
- Restore to a new laptop.
- Basic diagnostics and version reporting.

### Milestone 2 - Owner dashboard

- Read-only phone view of sales, udhaar, and low stock.
- Daily WhatsApp summary.
- GST/accounting export.

### Milestone 3 - Multi-counter sync

- Outbox, change feed, conflict policy.
- Device-prefixed invoice numbers.
- Roles for owner, manager, and cashier.

### Milestone 4 - Integrations

- Public API and webhooks.
- Tally XML and accounting exports.
- Payment gateway reconciliation.
- WhatsApp Business API reminders.
- Distributor ordering.

## 19. Non-Goals for V1

- No cloud dependency for billing.
- No real-time multi-device sync.
- No staff accounts or permissions.
- No payment gateway.
- No automatic WhatsApp messages.
- No third-party API.
- No e-commerce integration.
- No GST portal filing.

## 20. Success Metrics for the Backend Evolution

- Zero data-loss incidents for shops with cloud backup enabled.
- Restore to a new laptop completed in under 30 minutes.
- Backup success rate above 99%.
- Sync conflict rate below 1% of synced records.
- Tenant isolation tests pass on every release.
- Onboarding a shop's catalog completed in under one day.
- Support tickets per shop decrease as diagnostics and self-serve restore
  improve.

## 21. Summary

V1's in-browser backend is the right choice for offline reliability, privacy,
and low cost. It scales distribution to unlimited shops, but not central
operations.

Do not rewrite V1 for a SaaS future. Preserve the service boundaries, keep the
ledgers append-only, add sync-ready fields now, and add cloud backup before
onboarding other owners. Multi-device sync, APIs, and payment integrations
should follow real demand, not assumptions.
