/**
 * ScrapeFlow - Service Worker (Manifest V3)
 * Handles installation, downloads, and lifecycle events.
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === chrome.runtime.OnInstalledReason.INSTALL) {
    console.log('[ScrapeFlow] Extension installed successfully.');
    // Initialize default settings in local storage
    chrome.storage.local.set({
      settings: {
        exportFormat: 'csv',
        delimiter: ',',
        trimWhitespace: true,
        stripHtml: true,
        maxRowsPreview: 100
      },
      savedSelectors: [
        {
          id: 'preset-products',
          name: 'E-commerce Products (Common)',
          selector: '.product, .product-item, .product-card, [data-component-type="s-search-result"]',
          type: 'css',
          attribute: 'text'
        },
        {
          id: 'preset-headings',
          name: 'Article Headings',
          selector: 'h1, h2, h3',
          type: 'css',
          attribute: 'text'
        }
      ],
      history: []
    });
  }
});

// Handle messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadData') {
    handleDataDownload(request, sendResponse);
    return true; // Keep channel open for async response
  }
});

/**
 * Trigger browser download via chrome.downloads API
 */
function handleDataDownload(request, sendResponse) {
  const { dataUrl, filename } = request;

  if (!dataUrl || !filename) {
    sendResponse({ success: false, error: 'Missing dataUrl or filename' });
    return;
  }

  chrome.downloads.download(
    {
      url: dataUrl,
      filename: filename,
      saveAs: true
    },
    (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('[ScrapeFlow] Download error:', chrome.runtime.lastError.message);
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ success: true, downloadId });
      }
    }
  );
}
