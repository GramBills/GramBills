# GramBill POS - Shop Setup Guide

This guide explains how to give GramBill POS to a shop and help the shop owner
start using it safely.

> **Current status:** Phase 2 is complete. The shop can manage products, stock,
> CSV imports, and barcode labels. Billing, customer receipts, scanner checkout,
> invoices, khata, and reports are not available until Phase 3/4.

## 1. What Works Today

The shop can use these features now:

- Offline local database on the shop laptop.
- Shop profile, GSTIN, UPI details, invoice prefix, and terms.
- Product add/edit, floor price, stock quantity, and stock-in.
- Product CSV import, export, and template download.
- Barcode generation and CODE128 label printing.
- A4 label sheets: 65-up (38 x 21 mm) and 40-up (48 x 25 mm).
- Thermal label layout: 50 x 30 mm.
- JSON backup and restore.
- English / Hinglish interface switch.

These features are **not available yet**:

- Customer billing cart and checkout.
- A4 customer bill/receipt printing.
- Barcode scanner checkout workflow.
- Invoice numbers and sales records.
- Khata/udhaar entries.
- Warranty and serial/IMEI lookup.
- Sales and profit reports.
- Cloud sync between shops or laptops.

Do not tell the shop that billing is ready. For now, the shop can use a manual
receipt book or an external invoice template until Phase 3 is complete.

## 2. How the Shop Will Access the App

The app is a static web app. It has no backend server. All shop data is stored
inside the browser on the shop laptop.

### Option A: Hosted URL (recommended for non-technical shops)

1. On your development laptop, run:

   ```bash
   npm install
   npm run typecheck
   npm run test
   npm run build
   ```

2. The production files are created in `dist/`.
3. Upload the **contents of `dist/`** to a static host:
   - Netlify Drop
   - Vercel
   - Cloudflare Pages
   - GitHub Pages
4. Open the hosted URL on the shop laptop in Chrome or Edge.
5. Share only the hosted URL with the shop.

Do not share:

- `localhost:5173`
- the source code folder
- `node_modules`
- your development machine URL

### Option B: Local offline use on the shop laptop

Use this only if the shop laptop can run a local web server.

1. Copy the built `dist/` folder to the shop laptop.
2. Install Node.js on the shop laptop.
3. Open a terminal in the folder containing `dist/`.
4. Run a local static server, for example:

   ```bash
   npx serve -s dist
   ```

5. Open the printed local URL in Chrome or Edge.

This is more technical. For a non-technical shop, the hosted URL is easier.
A proper installable desktop/PWA version is planned for Phase 5.

### Important URL rule

Browser data is tied to the **exact URL and browser profile**. If the shop
starts using `https://grambill-shop1.netlify.app`, do not later change it to a
different domain without exporting a backup first. A new domain will look like a
fresh empty database.

## 3. What to Share With the Shop

Give the shop a short handover message containing:

1. The final hosted URL.
2. Browser name: Chrome or Edge.
3. Laptop to use: one fixed billing laptop.
4. Backup instruction: download a JSON backup regularly.
5. Hardware list for later: A4 laser printer, A4 sticker sheets, USB barcode
   scanner.
6. Support contact for problems.
7. A warning not to use Incognito/Private mode.
8. A warning not to clear browser data or site data.

## 4. First-Time Setup on the Shop Laptop

### Step 1: Open the app

- Use Chrome or Edge.
- Use a normal browser window, not Incognito/Private mode.
- Use the same laptop and browser every day.
- Keep the laptop charged and connected to a UPS if available.

### Step 2: Set up shop details

Open **Shop Settings** and fill in:

- Shop name
- Owner name
- Phone number
- Full shop address
- GSTIN, if the shop is GST registered
- UPI ID and payee name
- Invoice prefix, for example `SE`
- Default print size: select **A4** for the planned A4 bill format
- Terms and conditions

Click **Save settings**.

### Step 3: Add products

Choose one method:

**Method A: CSV import**

1. Open **Inventory**.
2. Download the CSV template.
3. Fill in product details in Excel or another spreadsheet app.
4. Keep the column headers unchanged.
5. Import the CSV.
6. Review the import summary for created, updated, skipped, and failed rows.

**Method B: Add manually**

1. Open **Inventory**.
2. Click **Add product**.
3. Enter product name, category, prices, stock, GST rate, and other details.
4. Save the product.

After import, check that stock quantities and selling prices are correct.

### Step 4: Generate barcodes

1. Open **Barcode Studio**.
2. Select the label layout that matches the shop's sticker sheet.
3. Click **Generate missing barcodes** in Inventory if products do not have
   barcodes.
4. Select products and the number of copies.
5. Use the skip setting to match partially used sticker sheets.
6. Print one test sheet on plain paper first.
7. Compare the test print with the actual sticker sheet.
8. Print the real labels only after alignment is correct.

### Step 5: Download the first backup

Open **Shop Settings** and download a JSON backup. Store it in:

- A pen drive, and
- A cloud folder such as Google Drive, if available.

Do this before entering a large amount of real shop data.

## 5. A4 Barcode Label Printing

Recommended hardware:

- A4 monochrome laser printer.
- Laser-compatible A4 sticker sheets.
- USB connection.

Print settings:

- Paper size: A4
- Scale: 100% / Actual size
- Margins: None or app default
- Headers and footers: Off
- Background graphics: On

Supported layouts:

| Layout | Grid | Label size |
| --- | --- | --- |
| 65-up | 5 columns x 13 rows | 38 x 21 mm |
| 40-up | 4 columns x 10 rows | 48 x 25 mm |

Buy one small pack of sticker sheets first. Different brands have slightly
different gaps and margins. Do not buy a large box until one sheet prints
correctly.

## 6. A4 Bill Printing

A4 bill printing is planned for Phase 3. The app does not generate customer
bills yet.

When Phase 3 is available, the expected workflow will be:

1. Add products to the bill.
2. Enter customer details if needed.
3. Apply discount and select payment mode.
4. Save the invoice.
5. Print the A4 bill.

Until then, do not use the app as the only billing record. Use a manual receipt
book or a temporary external invoice template.

## 7. Barcode Scanner

A USB barcode scanner is needed when Phase 3 checkout is available. A scanner
can be tested now because it works like a keyboard.

Recommended scanner:

- USB HID / keyboard-wedge mode.
- 1D laser for normal EAN/CODE128 labels.
- 2D imager if the shop also wants QR-code or screen scanning.
- Enter/CR suffix after each scan.

Before Phase 3, the scanner can be tested in Notepad. It will type the barcode
number into any text field. The app's full scanner checkout flow is not active
yet.

## 8. Backup and Data Safety

All data stays in the shop laptop's browser storage.

The shop must:

- Download a JSON backup at least weekly.
- Download a backup before updating the app.
- Download a backup before changing the laptop or browser.
- Keep backups in two places, such as a pen drive and Google Drive.
- Never share a backup publicly; it contains shop and customer data.
- Never use Incognito/Private mode.
- Never click "Clear browsing data" for the site.
- Never use multiple browsers for the same shop data.

Restore replaces the current local database with the backup file. Restore only
when necessary and after downloading a fresh backup of the current data.

## 9. Daily Shop Routine

1. Open the app in the same browser.
2. Check that the shop name and product count look correct.
3. Use Inventory for stock changes.
4. Print barcode labels when new stock arrives.
5. Download a backup at the end of the week.
6. Keep the laptop and printer on a UPS/surge protector.
7. Report any error message to the support contact.

## 10. Multiple Shops

Each shop must use its own laptop and browser profile. Data is local to that
laptop/browser.

- Shop A and Shop B do not share data automatically.
- Two laptops for the same shop do not sync automatically.
- The same hosted URL can be used by multiple shops, but each laptop has a
  separate local database.
- Do not copy one shop's backup into another shop's laptop unless you intend to
  replace that shop's data.

Cloud sync and owner dashboards are future work.

## 11. Hardware Needed for Real Shop Use

Hardware is not required for development or testing. It is required when the
shop starts real printing and scanning.

Recommended starter kit:

- Windows laptop with 8GB RAM and SSD.
- A4 monochrome laser printer with manual feed.
- A4 plain paper.
- Laser-compatible A4 sticker sheets.
- USB barcode scanner.
- 600VA or 1000VA UPS.
- Surge protector.

Optional later:

- 80mm thermal receipt printer.
- 203dpi thermal label printer.
- Cash drawer.

See [HARDWARE_REQUIREMENTS.md](./HARDWARE_REQUIREMENTS.md) for details.

## 12. Deployment Checklist

Before handing the URL to a shop:

- [ ] `npm run typecheck` passes.
- [ ] `npm run test` passes.
- [ ] `npm run lint` passes.
- [ ] `npm run build` passes.
- [ ] `dist/` is uploaded to HTTPS hosting.
- [ ] The URL opens on a fresh Chrome/Edge window.
- [ ] Shop settings save correctly.
- [ ] CSV template downloads and imports correctly.
- [ ] Barcode label preview prints correctly on a test sheet.
- [ ] Backup downloads successfully.
- [ ] Restore works on a test laptop with a test backup.
- [ ] The shop understands that billing is not available yet.
- [ ] The shop has the support contact and backup instructions.

## 13. Troubleshooting

### The app opens but shows no data

- Confirm the shop is using the same URL and browser as before.
- Confirm the shop did not use Incognito/Private mode.
- Confirm browser site data was not cleared.
- Restore the latest JSON backup if needed.

### Barcode labels are misaligned

- Use 100% / Actual size in the print dialog.
- Disable browser headers and footers.
- Confirm the sticker sheet matches the selected layout.
- Print on plain paper and compare before using stickers.
- Try the other supported layout if the sheet dimensions are different.

### The scanner types the barcode into the wrong place

- Click the correct input field first.
- Confirm the scanner is in keyboard-wedge/HID mode.
- Confirm the scanner sends Enter after the barcode.
- Full scanner checkout is a Phase 3 feature.

### The printer does not appear

- Confirm the USB cable is connected.
- Install the official Windows driver.
- Print a Windows test page.
- Restart Chrome/Edge and try again.

### Data disappeared after changing the URL

Browser data is tied to the URL. Restore the last JSON backup on the new URL.
Avoid changing the shop URL after real use begins.

## 14. Handover Message Template

Use this message when giving the app to a shop:

```text
GramBill POS - Shop Setup

Open this link in Chrome or Edge:
<hosted URL>

Use the same laptop and browser every day.
Do not use Incognito/Private mode.
Do not clear browser site data.

First steps:
1. Open Shop Settings and fill shop name, address, GSTIN, and UPI details.
2. Open Inventory and import the product CSV.
3. Check stock and selling prices.
4. Open Barcode Studio and print one test label sheet.
5. Download the first JSON backup from Shop Settings.

Important:
- Billing and customer bill printing are not available yet.
- Use a manual receipt book until Phase 3 is ready.
- Download a backup every week and keep it in two places.

Support contact:
<name and phone number>
```

## 15. Current Limitations

- No billing or A4 customer bill printing.
- No invoice storage or sales reports.
- No scanner checkout workflow.
- No khata/udhaar ledger.
- No cloud sync or multi-laptop sync.
- No service worker yet, so the app needs internet to load unless served
  locally.
- Browser storage can be cleared by the user or by the operating system.
- JSON backups are the recovery path.

## 16. Support Checklist

When a shop reports a problem, ask for:

1. Shop name and laptop name.
2. The URL in the browser address bar.
3. Browser name and version.
4. A screenshot of the error.
5. The last backup date.
6. Whether the browser data was cleared or the URL changed.
7. Whether the problem happens on another browser or laptop.

Do not ask the shop to send customer data or a backup unless it is required for
recovery and the shop agrees.
