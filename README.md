# ScrapeFlow - Web Scraper & Data Extractor (Chrome Extension)

A Manifest V3 web scraper Chrome extension designed for extracting tables, links, images, text, and custom CSS/XPath selections from any webpage and exporting them to CSV or JSON with 1 click.

---

## Features

* **Visual Element Picker:** Point and click any element on the page to automatically discover selectors and extract matching items.
* **Instant Table Scraper:** Detects all `<table>` elements and parses headers and rows into structured tables.
* **1-Click Quick Extractors:**
  * All Web Links (URLs, anchor text, target attributes)
  * All Images (src URLs, alt descriptions, dimensions)
  * Page Headings (H1 to H6 structure)
* **Custom Selector Studio:** Extract by CSS selector or XPath with live match count and attribute selection (`text`, `href`, `src`, `outerHTML`, or custom attributes).
* **Tabular Data Preview:** Live scrollable table preview with live text filter.
* **Multi-Format Export:**
  * Download as **CSV** (configurable delimiters: comma, semicolon, tab)
  * Download as **JSON**
  * One-click **Copy to Clipboard** (tab-separated format for direct pasting into Microsoft Excel or Google Sheets)
* **Privacy by Design:** 100% client-side execution; zero tracking, zero external telemetry.

---

## Directory Structure

```text
folder2/
├── manifest.json              # Manifest V3 extension configuration
├── background/
│   └── service-worker.js      # Background service worker for downloads & lifecycle
├── content/
│   ├── content.js             # Content script: scraping logic & visual inspector
│   └── content.css            # Styles for inspector overlays & modal dialog
├── popup/
│   ├── popup.html             # Popup interface
│   ├── popup.css              # Responsive Source Sans Pro styling
│   └── popup.js               # Popup controller & export handlers
├── icons/
│   ├── icon16.png             # 16x16 icon
│   ├── icon32.png             # 32x32 icon
│   ├── icon48.png             # 48x48 icon
│   ├── icon128.png            # 128x128 icon (Store listing)
│   └── promo_tile_440x280.png # Chrome Web Store small promo tile
├── dist/
│   └── scrapeflow-v1.0.0.zip  # Production ZIP ready for Chrome Store
├── build_extension.py         # Automated manifest validator & packager
├── PRIVACY_POLICY.html        # Ready-to-host privacy policy document
├── CHROME_STORE_GUIDE.md      # Complete Chrome Web Store publishing guide
└── README.md                  # Project documentation
```

---

## How to Load and Test Locally

1. Open Google Chrome.
2. Navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in upper right corner).
4. Click **Load unpacked** (top-left).
5. Select this directory: `/home/folder download path`
6. Open any website and click the ScrapeFlow icon in your extension bar to test.

---
