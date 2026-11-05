# Chrome Web Store Publishing Guide: ScrapeFlow

This guide provides a step-by-step walkthrough to test locally and publish your **ScrapeFlow** web scraper extension to the **Google Chrome Web Store**.

---

## 1. Local Testing in Google Chrome (Developer Mode)

Before uploading to the Chrome Web Store, verify the extension locally in your browser:

1. Open Google Chrome and enter `chrome://extensions/` in the address bar.
2. In the top-right corner, toggle **Developer mode** to **ON**.
3. In the top-left corner, click **Load unpacked**.
4. Select your extension directory:
   ```text
   /home/aximsoft/Documents/folder2
   ```
5. Click the puzzle icon in the Chrome toolbar and pin **ScrapeFlow**.
6. Visit any website (e.g., Wikipedia, an e-commerce catalog, or news site) and click the ScrapeFlow icon to test:
   * **Visual Picker:** Hover and click any element to select and scrape.
   * **Quick Scrape:** Extract tables, links, images, or headings in 1 click.
   * **Custom Selector:** Test CSS selectors (e.g., `h2`, `table`, `.title`) or XPath.
   * **Export:** Download CSV, JSON, or copy to clipboard.

---

## 2. Package the Extension for Submission

Google requires a clean `.zip` archive containing your extension files (without temporary files, docs, or git folders).

Run the automated packaging script:
```bash
python3 build_extension.py
```
This validates your `manifest.json`, verifies required icons, and outputs:
```text
dist/scrapeflow-v1.0.0.zip
```
This is the file you will upload to the Chrome Web Store Developer Dashboard.

---

## 3. Chrome Developer Account Setup

1. Visit the [Chrome Web Store Developer Console](https://chrome.google.com/webstore/devconsole).
2. Sign in with your Google account.
   > **Note:** Google requires **2-Step Verification** to be enabled on your Google Account.
3. Pay the **one-time developer registration fee of $5 USD** (billed by Google).
4. Complete your developer profile (Publisher display name, contact email).

---

## 4. Submitting Your Extension Step-by-Step

### Step 1: Upload the ZIP Package
1. On your Developer Dashboard, click **+ New Item**.
2. Drag and drop `dist/scrapeflow-v1.0.0.zip` or click **Browse files**.
3. Once uploaded, the dashboard will parse your `manifest.json` and open the item edit page.

---

### Step 2: Store Listing Information
Fill in the following recommended metadata:

* **Title:** `ScrapeFlow - Web Scraper & Data Extractor`
* **Short description:**
  ```text
  Extract tables, links, images, text, and custom elements from any webpage. Export to CSV or JSON with one click.
  ```
* **Detailed description:**
  ```text
  ScrapeFlow is a lightweight, visual web scraper and data extraction tool built for professionals, researchers, analysts, and developers.

  KEY FEATURES:
  * Visual Element Inspector: Click any element on a page to select and scrape all matching elements.
  * Instant Table Scraper: Automatically detects HTML tables and converts them into structured datasets.
  * 1-Click Extractors: Instant extraction of all web links, page images, and document headings (H1-H6).
  * Custom Selector Studio: Powerful CSS and XPath query engine with live element count preview.
  * Multiple Export Formats: Export to CSV (custom delimiters supported), JSON, or copy tab-separated data directly to Excel / Google Sheets.
  * 100% Private & Client-Side: Operates entirely in your browser. No data is ever sent to external servers or third parties.

  HOW TO USE:
  1. Open any webpage you want to scrape.
  2. Click the ScrapeFlow extension icon in your toolbar.
  3. Choose Quick Scrape (Tables, Links, Images, Headings) or click "Visual Picker" to select page elements.
  4. Preview your extracted data in real time.
  5. Click "CSV" or "JSON" to download your structured data.
  ```
* **Category:** Select **Productivity** or **Developer Tools**.
* **Language:** English.

---

### Step 3: Graphic Assets
Google requires the following store assets:

1. **Store Icon:**
   * Path: `icons/icon128.png` (128x128 PNG).
2. **Small Promo Tile:**
   * Path: `icons/promo_tile_440x280.png` (440x280 PNG, pre-generated).
3. **Screenshots:**
   * Prepare at least 1 screenshot (1280x800 or 640x400 PNG/JPEG) displaying the extension popup and data table preview in action.

---

### Step 4: Privacy & Permissions Declaration (Crucial)
This is where extensions are most frequently rejected if improperly answered. Use these exact answers:

1. **Single Purpose Policy:**
   * Google asks: *Describe the single purpose of your extension.*
   * **Answer:**
     > "ScrapeFlow has a single, focused purpose: to allow users to visually inspect and extract structured data (tables, links, images, and text) from the active webpage and export it to CSV or JSON files."

2. **Permission Justification:**
   * **`activeTab`:**
     > "Allows the user to inspect and extract structured data from the currently active browser tab on demand when clicking the extension icon."
   * **`scripting`:**
     > "Required to inject the visual element picker and client-side table parsing script into the active tab upon user request."
   * **`storage`:**
     > "Used exclusively to store user preferences (e.g. CSV delimiter settings) and temporary extracted datasets locally on the user's machine."
   * **`downloads`:**
     > "Enables the user to save the extracted dataset as CSV or JSON files to their device."

3. **Data Usage Certification:**
   * Under "Data collection": Select **"I do not collect or use any user data"**.
   * Check the boxes confirming you do not sell user data, transfer it for unrelated purposes, or use it for creditworthiness.

4. **Privacy Policy URL:**
   * Google requires a live URL for your Privacy Policy.
   * Host the included `PRIVACY_POLICY.html` on **GitHub Pages**, **Netlify**, or your personal site.
   * Example: `https://yourusername.github.io/scrapeflow-privacy/`

---

### Step 5: Submit for Review
1. Click **Save draft**.
2. Click **Submit for Review**.
3. In the confirmation dialog, you can choose whether to publish automatically once approved or publish manually.

---

## 5. Review Timeline & Best Practices

* **Review Duration:** Because ScrapeFlow uses `activeTab` instead of broad `<all_urls>` host permissions, reviews are typically completed in **24 to 48 hours**.
* **Zero Remote Code:** ScrapeFlow contains **no `eval()`**, no inline script tags, and no externally hosted scripts, ensuring full compliance with Manifest V3 security requirements.
* **Updates:** Whenever you release an update, increment the `"version"` field in `manifest.json` (e.g., `1.0.1`), run `python3 build_extension.py`, and upload the new ZIP under **Package** in the Developer Dashboard.
