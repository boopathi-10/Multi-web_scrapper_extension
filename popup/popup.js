/**
 * ScrapeFlow - Popup Controller
 * Coordinates user actions, communicates with content script & background worker,
 * renders tabular previews, and handles exports (CSV, JSON, Clipboard).
 */

document.addEventListener('DOMContentLoaded', async () => {
  // State variables
  let currentTab = null;
  let activeDataset = [];
  let availableTables = [];
  let currentSettings = {
    delimiter: ',',
    trimWhitespace: true
  };

  // DOM Elements - Navigation
  const tabButtons = document.querySelectorAll('.sf-tab-btn');
  const tabContents = document.querySelectorAll('.sf-tab-content');
  const previewBadge = document.getElementById('preview-badge');
  const activeDomainEl = document.getElementById('active-domain');
  const statusBar = document.getElementById('status-bar');
  const statusMessage = document.getElementById('status-message');

  // DOM Elements - Quick Scrape
  const btnScrapeTables = document.getElementById('btn-scrape-tables');
  const btnScrapeLinks = document.getElementById('btn-scrape-links');
  const btnScrapeImages = document.getElementById('btn-scrape-images');
  const btnScrapeHeadings = document.getElementById('btn-scrape-headings');
  const tableSelectorContainer = document.getElementById('table-selector-container');
  const tableDropdown = document.getElementById('table-dropdown');
  const btnLoadSelectedTable = document.getElementById('btn-load-selected-table');

  // DOM Elements - Custom Selector
  const customSelectorInput = document.getElementById('custom-selector-input');
  const customAttrSelect = document.getElementById('custom-attribute-select');
  const customAttrNameWrapper = document.getElementById('custom-attr-name-wrapper');
  const customAttrNameInput = document.getElementById('custom-attr-name-input');
  const btnTestSelector = document.getElementById('btn-test-selector');
  const btnRunCustomScrape = document.getElementById('btn-run-custom-scrape');
  const selectorPresetSelect = document.getElementById('selector-preset-select');

  // DOM Elements - Visual Inspector
  const btnVisualInspector = document.getElementById('btn-visual-inspector');

  // DOM Elements - Data Preview & Export
  const previewRowCount = document.getElementById('preview-row-count');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnCopyClipboard = document.getElementById('btn-copy-clipboard');
  const btnClearPreview = document.getElementById('btn-clear-preview');
  const previewFilterInput = document.getElementById('preview-filter-input');
  const previewTable = document.getElementById('preview-table');
  const previewThead = document.getElementById('preview-thead');
  const previewTbody = document.getElementById('preview-tbody');
  const previewEmptyState = document.getElementById('preview-empty-state');

  // DOM Elements - Settings
  const settingDelimiter = document.getElementById('setting-delimiter');
  const settingTrim = document.getElementById('setting-trim');

  /* ==========================================================================
     INITIALIZATION
     ========================================================================== */

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0) {
      currentTab = tabs[0];
      if (currentTab.url) {
        try {
          const urlObj = new URL(currentTab.url);
          activeDomainEl.textContent = urlObj.hostname || 'Local Page';
        } catch (e) {
          activeDomainEl.textContent = currentTab.url.substring(0, 30);
        }
      }
    }
  } catch (err) {
    showStatus('Error querying active tab: ' + err.message, true);
  }

  // Load saved settings & previous scraped data
  chrome.storage.local.get(['settings', 'lastScrapedData'], (res) => {
    if (res.settings) {
      currentSettings = { ...currentSettings, ...res.settings };
      if (settingDelimiter) settingDelimiter.value = currentSettings.delimiter || ',';
      if (settingTrim) settingTrim.checked = currentSettings.trimWhitespace !== false;
    }

    if (res.lastScrapedData && Array.isArray(res.lastScrapedData.data) && res.lastScrapedData.data.length > 0) {
      setDataset(res.lastScrapedData.data);
      showStatus(`Loaded ${res.lastScrapedData.data.length} items from previous session`);
    }
  });

  /* ==========================================================================
     EVENT LISTENERS - TABS
     ========================================================================== */

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');
      tabButtons.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetSection = document.getElementById(targetId);
      if (targetSection) targetSection.classList.add('active');
    });
  });

  /* ==========================================================================
     SCRIPT INJECTION HELPER
     ========================================================================== */

  async function ensureContentScriptInjected() {
    if (!currentTab || !currentTab.id) {
      throw new Error('No active tab found.');
    }

    // Check if URL is inspectable (cannot scrape chrome://, about:, chrome-extension://)
    if (currentTab.url && (currentTab.url.startsWith('chrome://') || currentTab.url.startsWith('chrome-extension://') || currentTab.url.startsWith('edge://') || currentTab.url.startsWith('about:'))) {
      throw new Error('Chrome security prevents extensions from running on internal system pages.');
    }

    try {
      // Ping content script to test responsiveness
      await chrome.tabs.sendMessage(currentTab.id, { action: 'ping' });
    } catch (e) {
      // Content script is not injected yet, inject script and styles dynamically
      await chrome.scripting.insertCSS({
        target: { tabId: currentTab.id },
        files: ['content/content.css']
      });
      await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        files: ['content/content.js']
      });
      // Small pause to allow initialization
      await new Promise(r => setTimeout(r, 100));
    }
  }

  /* ==========================================================================
     EVENT LISTENERS - QUICK SCRAPE
     ========================================================================== */

  btnScrapeTables.addEventListener('click', async () => {
    try {
      showStatus('Extracting HTML tables...');
      await ensureContentScriptInjected();
      const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'extractTables' });

      if (response && response.success) {
        availableTables = response.data;
        if (!availableTables || availableTables.length === 0) {
          showStatus('No standard HTML <table> tags found on this page.', true);
          return;
        }

        if (availableTables.length === 1) {
          // Exactly one table, load directly
          setDataset(availableTables[0].data);
          switchToPreviewTab();
          showStatus(`Extracted 1 table with ${availableTables[0].rowCount} rows!`);
        } else {
          // Multiple tables found: display table selection dropdown
          tableDropdown.innerHTML = '';
          availableTables.forEach((tbl, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            opt.textContent = `${tbl.caption} (${tbl.rowCount} rows, ${tbl.columnCount} cols)`;
            tableDropdown.appendChild(opt);
          });
          tableSelectorContainer.classList.remove('sf-hidden');
          showStatus(`Found ${availableTables.length} tables. Choose a table to load.`);
        }
      } else {
        showStatus(response?.error || 'Failed to extract tables', true);
      }
    } catch (err) {
      showStatus(err.message, true);
    }
  });

  btnLoadSelectedTable.addEventListener('click', () => {
    const selectedIdx = parseInt(tableDropdown.value, 10);
    if (availableTables[selectedIdx]) {
      setDataset(availableTables[selectedIdx].data);
      switchToPreviewTab();
      showStatus(`Loaded ${availableTables[selectedIdx].caption}!`);
    }
  });

  btnScrapeLinks.addEventListener('click', async () => {
    try {
      showStatus('Extracting web links...');
      await ensureContentScriptInjected();
      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'extractLinks',
        options: { unique: true }
      });

      if (response && response.success) {
        setDataset(response.data);
        switchToPreviewTab();
        showStatus(`Extracted ${response.data.length} unique links.`);
      } else {
        showStatus(response?.error || 'Failed to extract links', true);
      }
    } catch (err) {
      showStatus(err.message, true);
    }
  });

  btnScrapeImages.addEventListener('click', async () => {
    try {
      showStatus('Extracting page images...');
      await ensureContentScriptInjected();
      const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'extractImages' });

      if (response && response.success) {
        setDataset(response.data);
        switchToPreviewTab();
        showStatus(`Extracted ${response.data.length} images.`);
      } else {
        showStatus(response?.error || 'Failed to extract images', true);
      }
    } catch (err) {
      showStatus(err.message, true);
    }
  });

  btnScrapeHeadings.addEventListener('click', async () => {
    try {
      showStatus('Extracting page headings...');
      await ensureContentScriptInjected();
      const response = await chrome.tabs.sendMessage(currentTab.id, { action: 'extractHeadings' });

      if (response && response.success) {
        setDataset(response.data);
        switchToPreviewTab();
        showStatus(`Extracted ${response.data.length} headings.`);
      } else {
        showStatus(response?.error || 'Failed to extract headings', true);
      }
    } catch (err) {
      showStatus(err.message, true);
    }
  });

  /* ==========================================================================
     EVENT LISTENERS - CUSTOM SELECTOR
     ========================================================================== */

  customAttrSelect.addEventListener('change', () => {
    if (customAttrSelect.value === 'custom') {
      customAttrNameWrapper.classList.remove('sf-hidden');
    } else {
      customAttrNameWrapper.classList.add('sf-hidden');
    }
  });

  selectorPresetSelect.addEventListener('change', () => {
    if (selectorPresetSelect.value) {
      customSelectorInput.value = selectorPresetSelect.value;
      document.querySelector('input[name="selector-type"][value="css"]').checked = true;
    }
  });

  btnTestSelector.addEventListener('click', async () => {
    const selector = customSelectorInput.value.trim();
    if (!selector) {
      showStatus('Please enter a CSS or XPath selector to test.', true);
      return;
    }

    try {
      showStatus('Testing selector...');
      await ensureContentScriptInjected();
      const selectorType = document.querySelector('input[name="selector-type"]:checked').value;
      const attr = customAttrSelect.value === 'custom' ? customAttrNameInput.value.trim() : customAttrSelect.value;

      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'extractCustom',
        selector,
        selectorType,
        attribute: attr
      });

      if (response && response.success) {
        showStatus(`Found ${response.data.length} matching element${response.data.length !== 1 ? 's' : ''}!`);
      } else {
        showStatus(response?.error || 'Selector test failed', true);
      }
    } catch (err) {
      showStatus(err.message, true);
    }
  });

  btnRunCustomScrape.addEventListener('click', async () => {
    const selector = customSelectorInput.value.trim();
    if (!selector) {
      showStatus('Please enter a CSS or XPath selector.', true);
      return;
    }

    try {
      showStatus('Extracting matching elements...');
      await ensureContentScriptInjected();
      const selectorType = document.querySelector('input[name="selector-type"]:checked').value;
      const attr = customAttrSelect.value === 'custom' ? customAttrNameInput.value.trim() : customAttrSelect.value;

      const response = await chrome.tabs.sendMessage(currentTab.id, {
        action: 'extractCustom',
        selector,
        selectorType,
        attribute: attr
      });

      if (response && response.success) {
        setDataset(response.data);
        switchToPreviewTab();
        showStatus(`Extracted ${response.data.length} items successfully!`);
      } else {
        showStatus(response?.error || 'Custom extraction failed', true);
      }
    } catch (err) {
      showStatus(err.message, true);
    }
  });

  /* ==========================================================================
     EVENT LISTENERS - VISUAL INSPECTOR
     ========================================================================== */

  btnVisualInspector.addEventListener('click', async () => {
    try {
      await ensureContentScriptInjected();
      await chrome.tabs.sendMessage(currentTab.id, { action: 'startVisualInspector' });
      // Close popup to allow user to inspect the full web page
      window.close();
    } catch (err) {
      showStatus('Could not start inspector: ' + err.message, true);
    }
  });

  /* ==========================================================================
     EVENT LISTENERS - PREVIEW & EXPORT
     ========================================================================== */

  previewFilterInput.addEventListener('input', () => {
    const query = previewFilterInput.value.trim().toLowerCase();
    if (!query) {
      renderTableRows(activeDataset);
      return;
    }

    const filtered = activeDataset.filter(row => {
      return Object.values(row).some(val =>
        String(val).toLowerCase().includes(query)
      );
    });
    renderTableRows(filtered);
  });

  btnClearPreview.addEventListener('click', () => {
    setDataset([]);
    showStatus('Preview cleared.');
  });

  btnExportCsv.addEventListener('click', () => {
    if (!activeDataset.length) return;
    const csvContent = convertDatasetToCSV(activeDataset, currentSettings.delimiter);
    downloadFile(csvContent, 'scrapeflow_export.csv', 'text/csv;charset=utf-8;');
  });

  btnExportJson.addEventListener('click', () => {
    if (!activeDataset.length) return;
    const jsonContent = JSON.stringify(activeDataset, null, 2);
    downloadFile(jsonContent, 'scrapeflow_export.json', 'application/json;charset=utf-8;');
  });

  btnCopyClipboard.addEventListener('click', async () => {
    if (!activeDataset.length) return;
    try {
      const tsvContent = convertDatasetToCSV(activeDataset, '\t');
      await navigator.clipboard.writeText(tsvContent);
      showStatus('Copied to clipboard (Tab-separated for Excel / Google Sheets)!');
    } catch (err) {
      showStatus('Failed to copy to clipboard: ' + err.message, true);
    }
  });

  /* ==========================================================================
     SETTINGS CHANGE HANDLERS
     ========================================================================== */

  settingDelimiter.addEventListener('change', () => {
    currentSettings.delimiter = settingDelimiter.value;
    chrome.storage.local.set({ settings: currentSettings });
  });

  settingTrim.addEventListener('change', () => {
    currentSettings.trimWhitespace = settingTrim.checked;
    chrome.storage.local.set({ settings: currentSettings });
  });

  /* ==========================================================================
     HELPER FUNCTIONS
     ========================================================================== */

  function setDataset(data) {
    activeDataset = Array.isArray(data) ? data : [];
    previewBadge.textContent = activeDataset.length;
    previewRowCount.textContent = activeDataset.length;

    const hasData = activeDataset.length > 0;
    btnExportCsv.disabled = !hasData;
    btnExportJson.disabled = !hasData;
    btnCopyClipboard.disabled = !hasData;

    if (hasData) {
      previewEmptyState.classList.add('sf-hidden');
      previewTable.classList.remove('sf-hidden');
      renderTableHeaders(activeDataset[0]);
      renderTableRows(activeDataset);

      // Persist in storage for easy resumption
      chrome.storage.local.set({
        lastScrapedData: {
          timestamp: new Date().toISOString(),
          data: activeDataset
        }
      });
    } else {
      previewEmptyState.classList.remove('sf-hidden');
      previewTable.classList.add('sf-hidden');
      previewThead.innerHTML = '';
      previewTbody.innerHTML = '';
    }
  }

  function renderTableHeaders(sampleRow) {
    previewThead.innerHTML = '';
    const tr = document.createElement('tr');
    Object.keys(sampleRow).forEach(key => {
      const th = document.createElement('th');
      th.textContent = key;
      tr.appendChild(th);
    });
    previewThead.appendChild(tr);
  }

  function renderTableRows(rows) {
    previewTbody.innerHTML = '';
    const maxPreview = 100;
    const displayRows = rows.slice(0, maxPreview);

    displayRows.forEach(row => {
      const tr = document.createElement('tr');
      Object.values(row).forEach(val => {
        const td = document.createElement('td');
        td.textContent = String(val !== undefined && val !== null ? val : '');
        td.title = td.textContent; // Tooltip for overflow
        tr.appendChild(td);
      });
      previewTbody.appendChild(tr);
    });
  }

  function convertDatasetToCSV(dataset, delimiter = ',') {
    if (!dataset.length) return '';
    const headers = Object.keys(dataset[0]);
    const lines = [];

    // Header line
    lines.push(headers.map(escapeCsvValue).join(delimiter));

    // Rows
    dataset.forEach(row => {
      const values = headers.map(header => {
        let val = row[header] !== undefined && row[header] !== null ? String(row[header]) : '';
        if (currentSettings.trimWhitespace) {
          val = val.trim();
        }
        return escapeCsvValue(val);
      });
      lines.push(values.join(delimiter));
    });

    return lines.join('\r\n');
  }

  function escapeCsvValue(value) {
    if (typeof value !== 'string') {
      value = String(value);
    }
    // Escape double quotes and enclose with quotes if contains commas, line breaks, or quotes
    if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  function downloadFile(content, defaultFilename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    // Call service worker to execute download cleanly
    chrome.runtime.sendMessage(
      {
        action: 'downloadData',
        dataUrl: url,
        filename: defaultFilename
      },
      (res) => {
        if (res && res.success) {
          showStatus(`Downloaded ${defaultFilename}`);
        } else {
          // Fallback via anchor tag in popup
          const a = document.createElement('a');
          a.href = url;
          a.download = defaultFilename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          showStatus(`Downloaded ${defaultFilename}`);
        }
        setTimeout(() => URL.revokeObjectURL(url), 10000);
      }
    );
  }

  function switchToPreviewTab() {
    tabButtons.forEach(b => {
      if (b.getAttribute('data-tab') === 'tab-preview') {
        b.click();
      }
    });
  }

  function showStatus(msg, isError = false) {
    statusMessage.textContent = msg;
    if (isError) {
      statusMessage.style.color = '#ef4444';
      statusBar.style.borderColor = '#fca5a5';
    } else {
      statusMessage.style.color = '#475569';
      statusBar.style.borderColor = 'var(--border-color)';
    }
  }
});
