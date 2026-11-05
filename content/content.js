/**
 * ScrapeFlow - Content Script
 * Injected into active webpage to extract structured data and support visual inspection.
 */

(() => {
  // Prevent duplicate execution
  if (window.__scrapeflow_injected) {
    return;
  }
  window.__scrapeflow_injected = true;

  let isInspectorActive = false;
  let hoveredElement = null;
  let selectedElement = null;
  let hudElement = null;
  let tooltipElement = null;
  let modalElement = null;

  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'ping':
        sendResponse({ success: true, status: 'ready' });
        break;

      case 'extractTables':
        try {
          const tables = extractTablesData();
          sendResponse({ success: true, data: tables });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
        break;

      case 'extractLinks':
        try {
          const links = extractLinksData(request.options || {});
          sendResponse({ success: true, data: links });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
        break;

      case 'extractImages':
        try {
          const images = extractImagesData();
          sendResponse({ success: true, data: images });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
        break;

      case 'extractHeadings':
        try {
          const headings = extractHeadingsData();
          sendResponse({ success: true, data: headings });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
        break;

      case 'extractCustom':
        try {
          const data = extractCustomSelector(request.selector, request.selectorType, request.attribute);
          sendResponse({ success: true, data });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
        break;

      case 'startVisualInspector':
        startInspector();
        sendResponse({ success: true });
        break;

      case 'stopVisualInspector':
        stopInspector();
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown action' });
    }
    return true; // Keep communication open
  });

  /* ==========================================================================
     EXTRACTOR MODULES
     ========================================================================== */

  /**
   * Extract all HTML <table> data from page
   */
  function extractTablesData() {
    const tableElements = Array.from(document.querySelectorAll('table'));
    if (!tableElements.length) {
      return [];
    }

    return tableElements.map((table, tableIdx) => {
      // Find headers
      let headers = [];
      const thElements = Array.from(table.querySelectorAll('th'));
      if (thElements.length > 0) {
        headers = thElements.map(th => cleanText(th.textContent) || 'Column');
      }

      // Find rows
      const rows = [];
      const trElements = Array.from(table.querySelectorAll('tr'));

      trElements.forEach((tr) => {
        const cells = Array.from(tr.querySelectorAll('td'));
        if (cells.length > 0) {
          const rowData = cells.map(td => cleanText(td.textContent));
          // If no headers existed, generate default headers based on max columns
          rows.push(rowData);
        }
      });

      // Normalize headers if missing or mismatched
      const maxColCount = Math.max(...rows.map(r => r.length), headers.length, 1);
      if (headers.length === 0) {
        headers = Array.from({ length: maxColCount }, (_, i) => `Column_${i + 1}`);
      } else while (headers.length < maxColCount) {
        headers.push(`Column_${headers.length + 1}`);
      }

      // Convert rows to key-value objects
      const structuredRows = rows.map((row) => {
        const rowObj = {};
        headers.forEach((h, i) => {
          rowObj[h] = row[i] !== undefined ? row[i] : '';
        });
        return rowObj;
      });

      return {
        tableIndex: tableIdx + 1,
        caption: table.querySelector('caption')?.textContent?.trim() || `Table #${tableIdx + 1}`,
        rowCount: structuredRows.length,
        columnCount: headers.length,
        headers,
        data: structuredRows
      };
    });
  }

  /**
   * Extract all links from page
   */
  function extractLinksData(options) {
    const anchorElements = Array.from(document.querySelectorAll('a[href]'));
    const unique = options.unique !== false;
    const seen = new Set();
    const results = [];

    anchorElements.forEach((a, idx) => {
      const href = a.href;
      // Skip empty or purely javascript links
      if (!href || href.startsWith('javascript:')) return;

      if (unique && seen.has(href)) return;
      seen.add(href);

      results.push({
        Index: results.length + 1,
        Text: cleanText(a.textContent) || '[No Anchor Text]',
        URL: href,
        Target: a.target || '_self',
        Rel: a.rel || 'none'
      });
    });

    return results;
  }

  /**
   * Extract all images from page
   */
  function extractImagesData() {
    const imgElements = Array.from(document.querySelectorAll('img'));
    const seen = new Set();
    const results = [];

    imgElements.forEach((img) => {
      const src = img.currentSrc || img.src;
      if (!src || seen.has(src)) return;
      seen.add(src);

      results.push({
        Index: results.length + 1,
        Alt: cleanText(img.alt) || '[No Alt Text]',
        Source: src,
        Width: img.naturalWidth || img.width || 0,
        Height: img.naturalHeight || img.height || 0
      });
    });

    return results;
  }

  /**
   * Extract all headings from page (H1 to H6)
   */
  function extractHeadingsData() {
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    return headings.map((h, idx) => ({
      Index: idx + 1,
      Level: h.tagName.toUpperCase(),
      Text: cleanText(h.textContent)
    })).filter(h => h.Text.length > 0);
  }

  /**
   * Extract custom CSS or XPath selector
   */
  function extractCustomSelector(selector, selectorType = 'css', attribute = 'text') {
    if (!selector || !selector.trim()) {
      throw new Error('Please provide a valid selector');
    }

    let elements = [];

    if (selectorType === 'xpath') {
      const xpathResult = document.evaluate(
        selector,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null
      );
      for (let i = 0; i < xpathResult.snapshotLength; i++) {
        elements.push(xpathResult.snapshotItem(i));
      }
    } else {
      // CSS selector
      elements = Array.from(document.querySelectorAll(selector));
    }

    return elements.map((el, idx) => {
      let extractedValue = '';

      if (attribute === 'text') {
        extractedValue = cleanText(el.textContent);
      } else if (attribute === 'html') {
        extractedValue = el.outerHTML;
      } else if (attribute === 'href') {
        extractedValue = el.href || el.getAttribute('href') || '';
      } else if (attribute === 'src') {
        extractedValue = el.src || el.getAttribute('src') || '';
      } else {
        extractedValue = el.getAttribute(attribute) || '';
      }

      return {
        Index: idx + 1,
        Tag: el.tagName ? el.tagName.toLowerCase() : '',
        ExtractedValue: extractedValue,
        TextPreview: cleanText(el.textContent).substring(0, 80)
      };
    });
  }

  /* ==========================================================================
     VISUAL INSPECTOR MODULE
     ========================================================================== */

  function startInspector() {
    if (isInspectorActive) return;
    isInspectorActive = true;

    createInspectorHUD();
    createTooltip();

    document.addEventListener('mouseover', handleInspectorMouseOver, true);
    document.addEventListener('mouseout', handleInspectorMouseOut, true);
    document.addEventListener('click', handleInspectorClick, true);
  }

  function stopInspector() {
    isInspectorActive = false;

    if (hoveredElement) {
      hoveredElement.classList.remove('scrapeflow-highlight-hover');
      hoveredElement = null;
    }
    if (selectedElement) {
      selectedElement.classList.remove('scrapeflow-highlight-selected');
      selectedElement = null;
    }

    document.removeEventListener('mouseover', handleInspectorMouseOver, true);
    document.removeEventListener('mouseout', handleInspectorMouseOut, true);
    document.removeEventListener('click', handleInspectorClick, true);

    if (hudElement && hudElement.parentNode) {
      hudElement.parentNode.removeChild(hudElement);
      hudElement = null;
    }
    if (tooltipElement && tooltipElement.parentNode) {
      tooltipElement.parentNode.removeChild(tooltipElement);
      tooltipElement = null;
    }
    if (modalElement && modalElement.parentNode) {
      modalElement.parentNode.removeChild(modalElement);
      modalElement = null;
    }
  }

  function createInspectorHUD() {
    if (document.getElementById('scrapeflow-inspector-hud')) return;
    hudElement = document.createElement('div');
    hudElement.id = 'scrapeflow-inspector-hud';
    hudElement.innerHTML = `
      <span class="sf-badge">ScrapeFlow</span>
      <span class="sf-hud-text">Click any element on the page to inspect and extract data</span>
      <button class="sf-hud-btn" id="scrapeflow-btn-close">Exit</button>
    `;
    document.body.appendChild(hudElement);

    document.getElementById('scrapeflow-btn-close').addEventListener('click', (e) => {
      e.stopPropagation();
      stopInspector();
    });
  }

  function createTooltip() {
    if (document.getElementById('scrapeflow-tooltip')) return;
    tooltipElement = document.createElement('div');
    tooltipElement.id = 'scrapeflow-tooltip';
    document.body.appendChild(tooltipElement);
  }

  function handleInspectorMouseOver(e) {
    if (!isInspectorActive) return;
    const target = e.target;

    // Ignore scraper HUD and tooltip elements
    if (target.closest('#scrapeflow-inspector-hud') || target.closest('#scrapeflow-modal-dialog') || target.id === 'scrapeflow-tooltip') {
      return;
    }

    if (hoveredElement && hoveredElement !== target) {
      hoveredElement.classList.remove('scrapeflow-highlight-hover');
    }

    hoveredElement = target;
    hoveredElement.classList.add('scrapeflow-highlight-hover');

    if (tooltipElement) {
      const tag = target.tagName.toLowerCase();
      const classes = target.className && typeof target.className === 'string'
        ? target.className.split(' ').filter(c => !c.startsWith('scrapeflow-')).slice(0, 2).map(c => `.${c}`).join('')
        : '';
      tooltipElement.textContent = `<${tag}${classes}>`;
      tooltipElement.style.display = 'block';
      tooltipElement.style.top = `${e.clientY + 12}px`;
      tooltipElement.style.left = `${e.clientX + 12}px`;
    }
  }

  function handleInspectorMouseOut(e) {
    if (!isInspectorActive) return;
    if (hoveredElement) {
      hoveredElement.classList.remove('scrapeflow-highlight-hover');
    }
    if (tooltipElement) {
      tooltipElement.style.display = 'none';
    }
  }

  function handleInspectorClick(e) {
    if (!isInspectorActive) return;

    // Ignore clicks on HUD/dialog
    if (e.target.closest('#scrapeflow-inspector-hud') || e.target.closest('#scrapeflow-modal-dialog')) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    selectedElement = e.target;
    selectedElement.classList.remove('scrapeflow-highlight-hover');
    selectedElement.classList.add('scrapeflow-highlight-selected');

    if (tooltipElement) {
      tooltipElement.style.display = 'none';
    }

    showSelectionModal(selectedElement);
  }

  function showSelectionModal(element) {
    if (modalElement && modalElement.parentNode) {
      modalElement.parentNode.removeChild(modalElement);
    }

    const selector = generateOptimalSelector(element);
    const matchingElements = document.querySelectorAll(selector);
    const matchCount = matchingElements.length;
    const textPreview = cleanText(element.textContent).substring(0, 100) || '[Empty]';

    modalElement = document.createElement('div');
    modalElement.id = 'scrapeflow-modal-dialog';
    modalElement.innerHTML = `
      <h3>ScrapeFlow Element Selected</h3>
      <div class="sf-field-group">
        <label>Generated CSS Selector (${matchCount} matching element${matchCount > 1 ? 's' : ''}):</label>
        <div class="sf-code-box" id="sf-modal-selector">${escapeHtml(selector)}</div>
      </div>
      <div class="sf-field-group">
        <label>Sample Content:</label>
        <div class="sf-code-box">${escapeHtml(textPreview)}</div>
      </div>
      <div class="sf-field-group">
        <label>Extract Field:</label>
        <select id="sf-modal-attr-select" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #cbd5e1; font-size: 13px;">
          <option value="text">Text Content</option>
          <option value="href">Link (href)</option>
          <option value="src">Image URL (src)</option>
          <option value="html">Full Outer HTML</option>
        </select>
      </div>
      <div class="sf-actions-row">
        <button class="sf-btn-cancel" id="sf-modal-cancel">Cancel</button>
        <button class="sf-btn-confirm" id="sf-modal-extract">Extract ${matchCount} Element${matchCount > 1 ? 's' : ''}</button>
      </div>
    `;

    document.body.appendChild(modalElement);

    document.getElementById('sf-modal-cancel').addEventListener('click', () => {
      stopInspector();
    });

    document.getElementById('sf-modal-extract').addEventListener('click', () => {
      const selectedAttr = document.getElementById('sf-modal-attr-select').value;
      const extractedData = extractCustomSelector(selector, 'css', selectedAttr);

      // Save to chrome storage
      chrome.storage.local.set({
        lastScrapedData: {
          timestamp: new Date().toISOString(),
          url: window.location.href,
          title: document.title,
          selector: selector,
          attribute: selectedAttr,
          data: extractedData
        }
      }, () => {
        stopInspector();
        // Notify extension runtime
        chrome.runtime.sendMessage({
          action: 'elementExtractionComplete',
          count: extractedData.length
        });
      });
    });
  }

  /* ==========================================================================
     UTILITIES
     ========================================================================== */

  function cleanText(text) {
    if (!text) return '';
    return text.replace(/\s+/g, ' ').trim();
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function generateOptimalSelector(el) {
    if (!(el instanceof Element)) return '';

    // Check for unique ID
    if (el.id && !el.id.match(/\d{4,}/)) {
      return `#${CSS.escape(el.id)}`;
    }

    // Check for data-testid or custom data-id
    const testId = el.getAttribute('data-testid') || el.getAttribute('data-id');
    if (testId) {
      return `[data-testid="${CSS.escape(testId)}"]`;
    }

    // Check classes
    const classes = Array.from(el.classList).filter(c =>
      !c.startsWith('scrapeflow-') &&
      !c.match(/^[a-z0-9]{8,}$/i) // avoid generated hash classes like tailwind/styled-components
    );

    if (classes.length > 0) {
      const classSelector = `${el.tagName.toLowerCase()}.${classes.map(c => CSS.escape(c)).join('.')}`;
      if (document.querySelectorAll(classSelector).length > 0) {
        return classSelector;
      }
    }

    // Fallback: Path selector
    const path = [];
    let current = el;
    while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();
      if (current.className && typeof current.className === 'string') {
        const firstValidClass = current.className.split(' ').find(c => c && !c.startsWith('scrapeflow-'));
        if (firstValidClass) {
          selector += `.${CSS.escape(firstValidClass)}`;
        }
      }
      path.unshift(selector);
      current = current.parentElement;
      if (path.length >= 3) break;
    }

    return path.join(' > ') || el.tagName.toLowerCase();
  }
})();
