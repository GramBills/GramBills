# GramBill POS - Hardware Requirements

This document defines the recommended hardware for a shop running GramBill POS.
The default plan is **A4 bill printing** instead of thermal receipt printing.

## 1. Decision Summary

- **Bills:** print on **A4 plain paper** using a monochrome laser printer.
- **Barcode labels:** print on **A4 sticker sheets** using the same laser printer,
  or use an optional thermal label printer for high-volume label printing.
- **Barcode scanner:** use a **USB keyboard-wedge scanner**.
- **Internet:** not required for daily billing after the app has loaded.
- **Thermal receipt printer:** optional, not required for the A4-first setup.

> Phase 3 now supports A4/thermal **barcode label** printing, A4/thermal invoice
> printing, USB scanner checkout, and a webcam scanner fallback. Verify print
> alignment on the actual printer before real shop billing.

## 2. One-Shop Reference Kit

| Item | Priority | Recommended specification | Purpose |
| --- | --- | --- | --- |
| Laptop | Required | Windows 10/11, i3 8th gen or Ryzen 3, 8GB RAM, 256GB SSD, 2 USB-A ports | Runs the offline app in Chrome/Edge |
| A4 laser printer | Required | Monochrome laser, USB, 20+ ppm, manual/rear feed, Windows driver | Bills, invoices, and A4 sticker sheets |
| Barcode scanner | Required for billing | USB HID keyboard-wedge, 1D laser or 2D imager | Scan product barcodes at the counter |
| A4 paper | Required | 75-90 GSM plain paper | Customer bills |
| A4 sticker sheets | Required for labels | Laser-compatible, exact 65-up or 40-up layout | Product barcode labels |
| UPS | Strongly recommended | 600-1000VA | Protect billing during power cuts |
| Surge protector | Recommended | Good-quality spike guard | Protect laptop and printer |
| Thermal label printer | Optional | 203dpi, 50x30mm labels, USB | Faster single-label printing |
| 80mm thermal printer | Optional | USB, ESC/POS, Windows driver | Faster counter bills if A4 is too slow |
| Cash drawer | Optional | RJ11 trigger from receipt printer | Only if using a receipt printer |
| USB hub | Optional | Powered USB-A hub | Laptops with few USB ports |

## 3. Laptop Requirements

### Minimum

- Windows 10 or Windows 11, 64-bit.
- Intel Core i3 6th gen / AMD Ryzen 3 or better.
- 4GB RAM minimum, **8GB recommended**.
- 128GB SSD minimum, **256GB SSD recommended**.
- 1366x768 display or better.
- Chrome, Edge, or Firefox.
- At least 2 USB-A ports, or a USB hub.
- Working battery for short power cuts.

### Recommended

- Intel Core i3 8th gen / Ryzen 3 3000 series or better.
- 8GB RAM.
- 256GB SSD.
- 1920x1080 display.
- 3 USB-A ports.
- Windows 11 Pro or Home with current updates.

An existing laptop can be used if it has an SSD, 8GB RAM, and a working USB port.
Avoid very old hard-disk-only laptops; the app itself is light, but Windows
startup and updates will feel slow.

## 4. A4 Printer for Bills

### Recommended type

Use a **monochrome laser printer**. It is the best fit for shop billing:

- Fast per-page printing.
- Cheap per-page toner cost.
- No ink smudging.
- Good for A4 bills, GST invoices, and warranty copies.
- Works well with laser-compatible A4 sticker sheets.

### Required features

- A4 paper support.
- USB connection.
- Windows driver available from the manufacturer.
- Manual feed or rear feed for sticker sheets.
- At least 20 pages per minute for busy counters.
- 250-sheet paper tray recommended.
- Automatic duplex optional; useful for saving paper but not required.

An all-in-one printer with scanner/copier is fine, but the scanner is not needed
for GramBill POS.

### Printer examples

Verify current availability and driver support before purchase. Common business
laser models include:

- HP LaserJet Pro series.
- Brother HL-L2321D / HL-L2365DW or similar.
- Canon imageCLASS LBP series.
- Pantum P3300 series or similar business laser.

Avoid very cheap printers with expensive toner, no Windows driver, or no manual
feed.

### Avoid for sticker printing

- Inkjet printers: ink can smudge on sticker sheets.
- Photo printers: slow and expensive for invoices.
- Cloud-only printers: they may require an account or internet.
- Printers with only a front paper tray and no straight paper path: sticker
  sheets may curl or jam.

## 5. A4 Bill Printing Settings

Use these settings in the browser print dialog:

- Paper size: **A4**
- Scale: **100% / Actual size**
- Margins: **None** or the app's default margins
- Headers and footers: **Off**
- Background graphics: **On**
- Color: **Black and white** for normal bills
- Pages: only the required invoice page

Test with plain paper before printing a real customer bill. Check that:

- Shop name and address are correct.
- Invoice number and date are visible.
- Item table does not overflow the page.
- GST, discount, round-off, and grand total are correct.
- Terms and warranty text are readable.
- Page breaks do not split an item table awkwardly.

## 6. A4 Sticker Sheets

The barcode studio supports these A4 sticker layouts:

| Layout | Grid | Label size |
| --- | --- | --- |
| 65-up | 5 columns x 13 rows | 38 x 21 mm |
| 40-up | 4 columns x 10 rows | 48 x 25 mm |

Buy sticker sheets that match these dimensions exactly. Sheet dimensions vary
between brands, so buy one small pack first and test alignment before buying a
large box.

### Sticker sheet requirements

- Laser-compatible adhesive sheets.
- A4 size.
- Correct label dimensions and gaps.
- Matte paper finish recommended.
- Avoid thick vinyl or glossy sheets unless the printer supports them.

Print one test sheet on plain paper first. Hold it against the sticker sheet to
confirm alignment before printing the actual labels.

## 7. Barcode Scanner

### Recommended type

Use a **USB HID keyboard-wedge scanner**. It behaves like a keyboard and sends
the barcode followed by Enter.

- **1D laser/CCD scanner:** enough for EAN-13, UPC, and CODE128 labels.
- **2D imager:** better if you also want to scan QR codes, phone screens, or
  damaged labels.

### Required features

- USB connection.
- Keyboard-wedge / HID mode.
- Enter/CR suffix after scan.
- Windows plug-and-play support.
- Good scan speed and depth of field.
- Wired USB preferred for reliability.

### Scanner examples

Verify availability and support before purchase. Common retail scanners
include:

- Honeywell Voyager 1250g or 1470g.
- Zebra LS2208 or DS2208.
- Datalogic QuickScan series.
- TVS barcode scanner models.

Avoid serial-only scanners, scanner guns that require custom software, and
Bluetooth-only models without a USB dongle.

### Scanner setup checklist

- Plug in the scanner and confirm it types into Notepad.
- Scan a CODE128 label generated by GramBill POS.
- Confirm Enter is sent after the scan.
- Test with the laptop keyboard layout set to English.
- Keep the scanner manual for suffix/prefix configuration.

## 8. Optional Thermal Printers

### 80mm receipt printer

Use only if you later want faster counter bills or a smaller paper format.
Requirements:

- 80mm thermal paper.
- USB connection.
- ESC/POS support.
- Windows driver.
- Auto-cut optional.

A 58mm printer is not recommended unless space or budget is very tight. Bills
are cramped and harder to read.

### Thermal label printer

Use only if label printing volume is high. Requirements:

- 203dpi resolution.
- 50 x 30 mm label roll.
- USB connection.
- Windows driver.
- Supports direct thermal or thermal transfer labels.

The app already includes a 50 x 30 mm thermal label layout.

## 9. Power and Accessories

- **UPS:** 600VA minimum, 1000VA preferred. Connect the laptop and printer if
  the UPS can handle both.
- **Surge protector:** protects against voltage spikes common in rural areas.
- **USB extension cable:** useful if the scanner cable is short.
- **Powered USB hub:** recommended if the laptop has only one or two USB ports.
- **Spare A4 paper and sticker sheets:** keep at least one week of stock.
- **Printer cleaning kit:** for laser printer rollers and paper dust.

## 10. Recommended Configurations

### Lean setup

- Existing Windows laptop with SSD and 8GB RAM.
- A4 monochrome laser printer with manual feed.
- USB 1D barcode scanner.
- A4 paper and laser sticker sheets.
- 600VA UPS.

### Standard setup

- New or refurbished i3/Ryzen 3 laptop, 8GB RAM, 256GB SSD.
- A4 monochrome laser printer with 250-sheet tray and manual feed.
- USB 2D barcode scanner.
- 1000VA UPS and surge protector.
- Spare paper, toner, and sticker sheets.

### High-volume setup

- Standard setup.
- Optional 80mm thermal receipt printer for fast counter bills.
- Optional 203dpi thermal label printer for single stickers.
- Cash drawer if using a receipt printer.

## 11. Procurement Checklist

Before buying multiple units:

1. Test the printer with a Windows laptop and Chrome/Edge.
2. Print one A4 invoice on plain paper.
3. Print one A4 sticker sheet and check alignment.
4. Scan a CODE128 barcode into Notepad and into the app.
5. Confirm the printer has a Windows driver and USB cable.
6. Confirm the scanner sends Enter after each scan.
7. Check local service and toner/label availability.
8. Buy one unit first, test it in the shop, then standardize the model.

## 12. Not Recommended

- 58mm-only thermal printer for the main billing setup.
- Inkjet printer for sticker sheets.
- Cloud-only printer that needs an account or internet.
- Serial-only barcode scanner.
- Bluetooth-only scanner without a USB dongle.
- Very old laptop with a mechanical hard disk.
- Unbranded printer with no Windows driver or service support.
- Running the shop without a UPS and backup power protection.

## 13. Phase Mapping

| Phase | Hardware relevance |
| --- | --- |
| Phase 1 | Laptop and browser only |
| Phase 2 | A4 laser printer and A4 sticker sheets for barcode labels |
| Phase 3 | A4 bill printing, barcode scanner, checkout - complete |
| Phase 4 | Same hardware; reports and warranty lookup |
| Phase 5 | Print tuning and PWA/offline polish |

## 14. Assumptions

- One billing laptop per shop.
- Windows is the primary shop operating system.
- USB connections are preferred over Wi-Fi or Bluetooth for reliability.
- A4 bill printing is the primary invoice format.
- Thermal receipt printing is optional.
- The shop has a power connection and can use a UPS.
- Internet is not required for daily billing after the app is loaded.
