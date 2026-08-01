/* =====================================================================
   md2pdf Studio – app.js
   All 5 world-class features:
     1. Syntax Highlighting (highlight.js) + Math (KaTeX)
     2. Branding: Logo, Cover Page, Watermark
     3. Auto Table of Contents
     4. Auto-Save + Drag & Drop
     5. Layout Templates
   ===================================================================== */

const sampleMarkdown = `# Product Brief

Turn raw Markdown into a polished PDF directly in the browser.

## Why this exists

- No uploads
- No backend
- No database
- Fast local rendering

> The preview is the document you export.

## Checklist

1. Paste or open a \`.md\` file
2. Pick a theme and layout
3. Download the PDF

\`\`\`js
function convert(markdown) {
  return "client-side only";
}
\`\`\`

## Math Support

Inline math: $E = mc^2$

Display math:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

| Feature | Status |
| --- | --- |
| Markdown preview | Ready |
| PDF export | Ready |
| Browser-only flow | Ready |
| Syntax highlighting | Ready |
| Math rendering | Ready |
`;

// ── DOM References ──────────────────────────────────────────────────
const els = {
  fileInput: document.querySelector("#fileInput"),
  openFileButton: document.querySelector("#openFileButton"),
  sampleButton: document.querySelector("#sampleButton"),
  markdownInput: document.querySelector("#markdownInput"),
  filenameInput: document.querySelector("#filenameInput"),
  downloadButton: document.querySelector("#downloadButton"),
  previewFrame: document.querySelector("#previewFrame"),
  previewDocument: document.querySelector("#previewDocument"),
  statusPill: document.querySelector("#statusPill"),
  metaText: document.querySelector("#metaText"),
  copyButtonsContainer: document.querySelector("#copyButtonsContainer"),
  marginSelect: document.querySelector("#marginSelect"),
  customMarginInput: document.querySelector("#customMarginInput"),
  paddingSelect: document.querySelector("#paddingSelect"),
  customPaddingInput: document.querySelector("#customPaddingInput"),
  fontStyleSelect: document.querySelector("#fontStyleSelect"),
  fontSizeSelect: document.querySelector("#fontSizeSelect"),
  customFontSizeInput: document.querySelector("#customFontSizeInput"),
  lineHeightSelect: document.querySelector("#lineHeightSelect"),
  customLineHeightInput: document.querySelector("#customLineHeightInput"),
  themeSelect: document.querySelector("#themeSelect"),
  showBordersCheckbox: document.querySelector("#showBordersCheckbox"),
  // New feature elements
  layoutSelect: document.querySelector("#layoutSelect"),
  codeThemeSelect: document.querySelector("#codeThemeSelect"),
  tocCheckbox: document.querySelector("#tocCheckbox"),
  coverPageCheckbox: document.querySelector("#coverPageCheckbox"),
  uploadLogoBtn: document.querySelector("#uploadLogoBtn"),
  clearLogoBtn: document.querySelector("#clearLogoBtn"),
  logoInput: document.querySelector("#logoInput"),
  logoPreview: document.querySelector("#logoPreview"),
  watermarkInput: document.querySelector("#watermarkInput"),
  dropZone: document.querySelector("#dropZone"),
};

const defaultDocumentTitle = document.title;
let currentLogoDataUrl = null;

// ── Utility Helpers ─────────────────────────────────────────────────
function safeFilename(value) {
  const trimmed = value.trim() || "document.pdf";
  return trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
}

function formatCSSValue(val, defaultUnit) {
  val = val.trim();
  if (!val) return "";
  if (/^[\d.]+$/.test(val)) return val + defaultUnit;
  return val;
}

// ── Auto-Save / Restore (Feature #4) ────────────────────────────────
const STORAGE_KEY = "md2pdf_autosave";

function autoSave() {
  try {
    const data = {
      markdown: els.markdownInput.value,
      filename: els.filenameInput.value,
      layout: els.layoutSelect?.value,
      margin: els.marginSelect?.value,
      customMargin: els.customMarginInput?.value,
      fontSize: els.fontSizeSelect?.value,
      customFontSize: els.customFontSizeInput?.value,
      lineHeight: els.lineHeightSelect?.value,
      customLineHeight: els.customLineHeightInput?.value,
      padding: els.paddingSelect?.value,
      customPadding: els.customPaddingInput?.value,
      fontStyle: els.fontStyleSelect?.value,
      theme: els.themeSelect?.value,
      codeTheme: els.codeThemeSelect?.value,
      showBorders: els.showBordersCheckbox?.checked,
      toc: els.tocCheckbox?.checked,
      coverPage: els.coverPageCheckbox?.checked,
      watermark: els.watermarkInput?.value,
      logo: currentLogoDataUrl,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) { /* quota exceeded – ignore */ }
}

function restoreSave() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    // Only restore if saved within last 7 days
    if (Date.now() - d.savedAt > 7 * 24 * 60 * 60 * 1000) return false;

    if (d.markdown) els.markdownInput.value = d.markdown;
    if (d.filename) els.filenameInput.value = d.filename;
    if (d.layout && els.layoutSelect) els.layoutSelect.value = d.layout;
    if (d.margin && els.marginSelect) els.marginSelect.value = d.margin;
    if (d.customMargin && els.customMarginInput) els.customMarginInput.value = d.customMargin;
    if (d.fontSize && els.fontSizeSelect) els.fontSizeSelect.value = d.fontSize;
    if (d.customFontSize && els.customFontSizeInput) els.customFontSizeInput.value = d.customFontSize;
    if (d.lineHeight && els.lineHeightSelect) els.lineHeightSelect.value = d.lineHeight;
    if (d.customLineHeight && els.customLineHeightInput) els.customLineHeightInput.value = d.customLineHeight;
    if (d.padding && els.paddingSelect) els.paddingSelect.value = d.padding;
    if (d.customPadding && els.customPaddingInput) els.customPaddingInput.value = d.customPadding;
    if (d.fontStyle && els.fontStyleSelect) els.fontStyleSelect.value = d.fontStyle;
    if (d.theme && els.themeSelect) els.themeSelect.value = d.theme;
    if (d.codeTheme && els.codeThemeSelect) els.codeThemeSelect.value = d.codeTheme;
    if (typeof d.showBorders === "boolean" && els.showBordersCheckbox) els.showBordersCheckbox.checked = d.showBorders;
    if (typeof d.toc === "boolean" && els.tocCheckbox) els.tocCheckbox.checked = d.toc;
    if (typeof d.coverPage === "boolean" && els.coverPageCheckbox) els.coverPageCheckbox.checked = d.coverPage;
    if (d.watermark && els.watermarkInput) els.watermarkInput.value = d.watermark;
    if (d.logo) {
      currentLogoDataUrl = d.logo;
      els.logoPreview.src = d.logo;
      els.logoPreview.style.display = "inline";
      els.clearLogoBtn.style.display = "inline";
    }
    return true;
  } catch (e) { return false; }
}

// Debounced auto-save
let saveTimer = null;
function scheduleAutoSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(autoSave, 800);
}

// ── Drag & Drop (Feature #4) ───────────────────────────────────────
function setupDragDrop() {
  const zone = els.dropZone;
  if (!zone) return;

  // Allow dropping anywhere on the page
  document.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-active");
  });
  document.addEventListener("dragleave", (e) => {
    if (!e.relatedTarget || e.relatedTarget === document.documentElement) {
      zone.classList.remove("drag-active");
    }
  });
  document.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-active");
    const file = e.dataTransfer?.files?.[0];
    if (file && (file.name.endsWith(".md") || file.name.endsWith(".markdown") || file.type === "text/markdown")) {
      loadFile(file);
      els.statusPill.textContent = "File loaded!";
      setTimeout(() => { els.statusPill.textContent = "Ready"; }, 2000);
    }
  });
}

// ── Logo Upload (Feature #2) ───────────────────────────────────────
function setupLogo() {
  els.uploadLogoBtn?.addEventListener("click", () => els.logoInput.click());
  els.logoInput?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      currentLogoDataUrl = ev.target.result;
      els.logoPreview.src = currentLogoDataUrl;
      els.logoPreview.style.display = "inline";
      els.clearLogoBtn.style.display = "inline";
      renderMarkdown();
      scheduleAutoSave();
    };
    reader.readAsDataURL(file);
  });
  els.clearLogoBtn?.addEventListener("click", () => {
    currentLogoDataUrl = null;
    els.logoPreview.style.display = "none";
    els.clearLogoBtn.style.display = "none";
    els.logoInput.value = "";
    renderMarkdown();
    scheduleAutoSave();
  });
}

// ── Code Theme Switching (Feature #1) ──────────────────────────────
function applyCodeTheme(themeName) {
  const link = document.getElementById("hljsTheme");
  if (link) {
    link.href = `https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/${themeName}.min.css`;
  }
}

// ── Auto Table of Contents (Feature #3) ────────────────────────────
function generateTOC(html) {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;
  const headings = tempDiv.querySelectorAll("h1, h2, h3, h4");
  if (headings.length < 2) return ""; // Don't generate TOC for trivial docs

  let toc = `<nav class="auto-toc"><h2 class="toc-title">Table of Contents</h2><ul>`;
  headings.forEach((h, i) => {
    const level = parseInt(h.tagName[1]);
    const id = `heading-${i}`;
    h.id = id;
    const indent = level - 1;
    toc += `<li class="toc-level-${level}" style="margin-left: ${indent * 16}px;">
      <a href="#${id}">${h.textContent}</a>
    </li>`;
  });
  toc += `</ul></nav>`;

  // Put back the IDs into the original html
  const updatedHtml = tempDiv.innerHTML;
  return { toc, html: updatedHtml };
}

// ── Cover Page (Feature #2) ────────────────────────────────────────
function generateCoverPage(markdownText) {
  // Extract title from first H1
  const titleMatch = markdownText.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : "Untitled Document";

  // Extract subtitle from first line after H1 that isn't a heading
  const lines = markdownText.split("\n");
  let subtitle = "";
  let foundTitle = false;
  for (const line of lines) {
    if (!foundTitle && line.match(/^#\s+/)) { foundTitle = true; continue; }
    if (foundTitle && line.trim() && !line.match(/^#{1,6}\s+/)) {
      subtitle = line.trim();
      break;
    }
  }

  const logoHtml = currentLogoDataUrl
    ? `<img src="${currentLogoDataUrl}" class="cover-logo" alt="Logo">`
    : "";

  const date = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric"
  });

  return `
    <div class="cover-page">
      ${logoHtml}
      <h1 class="cover-title">${title}</h1>
      ${subtitle ? `<p class="cover-subtitle">${subtitle}</p>` : ""}
      <div class="cover-meta">
        <span class="cover-date">${date}</span>
      </div>
      <div class="cover-decoration"></div>
    </div>
  `;
}

// ── Watermark (Feature #2) ─────────────────────────────────────────
function applyWatermark(doc) {
  const existing = doc.querySelector(".watermark-overlay");
  if (existing) existing.remove();

  const text = els.watermarkInput?.value?.trim();
  if (!text) return;

  const overlay = document.createElement("div");
  overlay.className = "watermark-overlay";
  overlay.setAttribute("aria-hidden", "true");

  // Generate a repeating SVG background
  const escapedText = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">
    <text x="50%" y="50%" transform="rotate(-35 200 200)" text-anchor="middle" font-family="sans-serif" font-size="52" font-weight="900" fill="gray" opacity="0.15" letter-spacing="0.15em" text-transform="uppercase">${escapedText}</text>
  </svg>`;
  const encoded = btoa(unescape(encodeURIComponent(svg)));
  
  overlay.style.backgroundImage = `url("data:image/svg+xml;base64,${encoded}")`;
  overlay.style.backgroundRepeat = "repeat";
  overlay.style.backgroundPosition = "center top";

  doc.appendChild(overlay);
}

// ── Layout Templates (Feature #5) ──────────────────────────────────
function applyLayout(doc) {
  // Remove all existing layout classes
  const layouts = [
    "layout-default", "layout-split-page", "layout-article", "layout-letter",
    "layout-resume", "layout-resume-modern", "layout-resume-minimal", "layout-resume-tech", "layout-resume-dev", "layout-academic", "layout-report",
    "layout-memo", "layout-api-doc", "layout-readme",
    "layout-slides", "layout-newsletter", "layout-magazine"
  ];
  layouts.forEach(cls => doc.classList.remove(cls));

  const layout = els.layoutSelect?.value || "default";
  doc.classList.add(`layout-${layout}`);
}

// ── Copy Buttons ────────────────────────────────────────────────────
function updateCopyButtons() {
  const container = els.copyButtonsContainer;
  if (!container) return;
  container.innerHTML = "";

  const doc = els.previewDocument;
  const rect = doc.getBoundingClientRect();
  if (rect.width === 0) return;

  const isLandscape = doc.classList.contains("layout-slides");
  const ratio = isLandscape ? 0.7071 : 1.4142;
  const pageHeight = rect.width * ratio;
  doc.style.setProperty("--page-height", pageHeight + "px");

  const totalHeight = doc.scrollHeight;
  const totalPages = Math.max(1, Math.ceil(totalHeight / pageHeight));

  const copyAllBtn = document.createElement("button");
  copyAllBtn.type = "button";
  copyAllBtn.className = "ghost-button";
  copyAllBtn.style.padding = "6px 12px";
  copyAllBtn.style.fontSize = "0.85rem";
  copyAllBtn.style.fontWeight = "bold";
  copyAllBtn.textContent = `Copy Entire Document`;
  copyAllBtn.addEventListener("click", () => copyEntireDocumentAsImage());
  container.appendChild(copyAllBtn);

  const downloadAllBtn = document.createElement("button");
  downloadAllBtn.type = "button";
  downloadAllBtn.className = "primary-button";
  downloadAllBtn.style.padding = "6px 12px";
  downloadAllBtn.style.fontSize = "0.85rem";
  downloadAllBtn.style.fontWeight = "bold";
  downloadAllBtn.textContent = `Download Entire Document`;
  downloadAllBtn.addEventListener("click", () => downloadEntireDocumentAsImage());
  container.appendChild(downloadAllBtn);

  for (let i = 1; i <= totalPages; i++) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ghost-button";
    btn.style.padding = "6px 12px";
    btn.style.fontSize = "0.85rem";
    btn.textContent = `Copy Page ${i}`;
    btn.addEventListener("click", () => copyPageAsImage(i, pageHeight));
    container.appendChild(btn);
  }
}

// ── Image Export Functions ──────────────────────────────────────────
async function copyEntireDocumentAsImage() {
  const statusPill = els.statusPill;
  const originalText = statusPill.textContent;
  statusPill.textContent = `Rendering entire document...`;
  try {
    const makeImagePromise = async () => {
      const doc = els.previewDocument;
      const wasShowingBorders = doc.classList.contains("show-page-borders");
      if (wasShowingBorders) doc.classList.remove("show-page-borders");
      const canvas = await html2canvas(doc, {
        scale: 2, useCORS: true, logging: false,
        backgroundColor: window.getComputedStyle(doc).backgroundColor || "#ffffff"
      });
      if (wasShowingBorders) doc.classList.add("show-page-borders");
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create image blob"));
        }, "image/png");
      });
    };

    const item = new ClipboardItem({ "image/png": makeImagePromise() });
    await navigator.clipboard.write([item]);
    
    statusPill.textContent = `Entire Document Copied!`;
    setTimeout(() => { statusPill.textContent = "Ready"; }, 2000);
  } catch (error) {
    console.error(error);
    statusPill.textContent = "Clipboard blocked or failed";
    setTimeout(() => { statusPill.textContent = originalText; }, 2000);
  }
}

async function downloadEntireDocumentAsImage() {
  const statusPill = els.statusPill;
  const originalText = statusPill.textContent;
  statusPill.textContent = `Rendering entire document...`;
  try {
    const doc = els.previewDocument;
    const wasShowingBorders = doc.classList.contains("show-page-borders");
    if (wasShowingBorders) doc.classList.remove("show-page-borders");
    const canvas = await html2canvas(doc, {
      scale: 2, useCORS: true, logging: false,
      backgroundColor: window.getComputedStyle(doc).backgroundColor || "#ffffff"
    });
    if (wasShowingBorders) doc.classList.add("show-page-borders");
    const link = document.createElement("a");
    let filename = els.filenameInput.value || "document.pdf";
    filename = filename.replace(/\.pdf$/i, ".png");
    if (!filename.endsWith(".png")) filename += ".png";
    link.download = filename;
    link.href = canvas.toDataURL("image/png");
    link.click();
    statusPill.textContent = `Image Downloaded!`;
    setTimeout(() => { statusPill.textContent = "Ready"; }, 2000);
  } catch (error) {
    console.error(error);
    statusPill.textContent = "Render failed";
    setTimeout(() => { statusPill.textContent = originalText; }, 2000);
  }
}

async function copyPageAsImage(pageIndex, pageHeight) {
  const statusPill = els.statusPill;
  const originalText = statusPill.textContent;
  statusPill.textContent = `Rendering page ${pageIndex}...`;
  try {
    const makePagePromise = async () => {
      const doc = els.previewDocument;
      const wasShowingBorders = doc.classList.contains("show-page-borders");
      if (wasShowingBorders) doc.classList.remove("show-page-borders");
      const canvas = await html2canvas(doc, {
        scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff"
      });
      if (wasShowingBorders) doc.classList.add("show-page-borders");
      
      const scale = 2;
      const sliceWidth = canvas.width;
      const sliceHeight = pageHeight * scale;
      const startY = (pageIndex - 1) * sliceHeight;
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = sliceWidth;
      tempCanvas.height = Math.min(sliceHeight, canvas.height - startY);
      const tempCtx = tempCanvas.getContext("2d");
      tempCtx.drawImage(canvas, 0, startY, sliceWidth, tempCanvas.height, 0, 0, tempCanvas.width, tempCanvas.height);
      
      return new Promise((resolve, reject) => {
        tempCanvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Failed to create page blob"));
        }, "image/png");
      });
    };

    const item = new ClipboardItem({ "image/png": makePagePromise() });
    await navigator.clipboard.write([item]);
    
    statusPill.textContent = `Page ${pageIndex} Copied!`;
    setTimeout(() => { statusPill.textContent = "Ready"; }, 2000);
  } catch (error) {
    console.error(error);
    statusPill.textContent = "Clipboard blocked or failed";
    setTimeout(() => { statusPill.textContent = originalText; }, 2000);
  }
}

// ── Render Markdown ─────────────────────────────────────────────────
function renderMarkdown() {
  const raw = els.markdownInput?.value || "# Empty document";
  let finalHtml = "";
  
  try {
    // 1. Parse Markdown
    if (typeof marked === 'undefined') throw new Error("marked.js is not loaded");
    let html = marked.parse(raw, { breaks: false, gfm: true });

    // 2. Sanitize HTML
    if (typeof DOMPurify === 'undefined') throw new Error("DOMPurify is not loaded");
    let cleanHtml = DOMPurify.sanitize(html, {
      ADD_TAGS: ['math', 'semantics', 'mrow', 'mi', 'mo', 'mn', 'msup', 'msub', 'mfrac', 'mtext', 'annotation'],
      ADD_ATTR: ['encoding']
    });

    // 3. Cover page
    if (els.coverPageCheckbox?.checked) {
      finalHtml += generateCoverPage(raw);
    }

    // Logo header (if no cover page but logo is set)
    if (!els.coverPageCheckbox?.checked && currentLogoDataUrl) {
      finalHtml += `<div class="doc-logo-header"><img src="${currentLogoDataUrl}" alt="Logo"></div>`;
    }

    // 4. Table of Contents
    if (els.tocCheckbox?.checked) {
      const tocResult = generateTOC(cleanHtml);
      if (tocResult) {
        finalHtml += tocResult.toc;
        cleanHtml = tocResult.html;
      }
    }

    // 4.5 Enhance Resume Skills (Auto-column layout for skills)
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = cleanHtml;
    const headings = tempDiv.querySelectorAll("h1, h2, h3, h4");
    headings.forEach(h => {
      if (h.textContent.toLowerCase().includes("skill")) {
        let sibling = h.nextElementSibling;
        while (sibling && !["H1", "H2", "H3", "H4"].includes(sibling.tagName)) {
          if (sibling.tagName === "UL") sibling.classList.add("skills-list");
          sibling.querySelectorAll("ul").forEach(ul => ul.classList.add("skills-list"));
          sibling = sibling.nextElementSibling;
        }
      }
    });
    cleanHtml = tempDiv.innerHTML;

    finalHtml += cleanHtml;
    els.previewDocument.innerHTML = finalHtml;

    // 5. Apply syntax highlighting
    if (typeof hljs !== 'undefined') {
      els.previewDocument.querySelectorAll("pre code").forEach((block) => {
        try { hljs.highlightElement(block); } catch(e) { console.warn(e); }
      });
    }

    // 6. Render KaTeX math
    if (typeof renderMathInElement !== 'undefined') {
      try {
        renderMathInElement(els.previewDocument, {
          delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
          ],
          throwOnError: false,
        });
      } catch (e) { console.warn("KaTeX error:", e); }
    }

    // 7. Apply watermark
    applyWatermark(els.previewDocument);

  } catch (error) {
    console.error("Render error:", error);
    els.previewDocument.innerHTML = `<div style="color: red; padding: 20px; font-weight: bold; text-align: left;">
      <h3>Error Rendering Document</h3>
      <p>${error.message}</p>
      <p style="font-weight: normal; font-size: 0.9em; opacity: 0.8;">Make sure your internet connection is active so CDN scripts can load.</p>
    </div>`;
  }

  // Update metadata
  if (els.metaText) {
    els.metaText.textContent = `${raw.length.toLocaleString()} characters`;
  }

  requestAnimationFrame(() => { updateCopyButtons(); });
  scheduleAutoSave();
}

// ── Wait for paint ──────────────────────────────────────────────────
function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => { requestAnimationFrame(resolve); });
  });
}

// ── File Loading ────────────────────────────────────────────────────
async function loadFile(file) {
  const text = await file.text();
  els.markdownInput.value = text;
  els.filenameInput.value = file.name.replace(/\.(md|markdown)$/i, ".pdf");
  renderMarkdown();
}

// ── Export PDF ───────────────────────────────────────────────────────
async function exportPdf() {
  const filename = safeFilename(els.filenameInput.value);
  document.title = filename;
  els.statusPill.textContent = "Use Save as PDF";
  els.downloadButton.disabled = true;
  try {
    await waitForPaint();
    window.print();
    els.statusPill.textContent = "Print dialog opened";
  } catch (error) {
    console.error(error);
    els.statusPill.textContent = "Export failed";
  } finally {
    els.downloadButton.disabled = false;
    window.setTimeout(() => { document.title = defaultDocumentTitle; }, 500);
  }
}

// ── Apply Settings ──────────────────────────────────────────────────
function applySettings() {
  const doc = els.previewDocument;

  // Toggle custom inputs visibility
  if (els.marginSelect) els.customMarginInput.style.display = els.marginSelect.value === "custom" ? "block" : "none";
  if (els.paddingSelect) els.customPaddingInput.style.display = els.paddingSelect.value === "custom" ? "block" : "none";
  if (els.fontSizeSelect) els.customFontSizeInput.style.display = els.fontSizeSelect.value === "custom" ? "block" : "none";
  if (els.lineHeightSelect) els.customLineHeightInput.style.display = els.lineHeightSelect.value === "custom" ? "block" : "none";

  // Layout template
  applyLayout(doc);

  // Margin
  if (els.marginSelect) {
    const rawMargin = els.marginSelect.value === "custom" ? els.customMarginInput.value :
      (els.marginSelect.value === "narrow" ? "10mm" :
       els.marginSelect.value === "wide" ? "30mm" : "20mm");
    const formattedMargin = formatCSSValue(rawMargin, "mm") || "20mm";
    doc.style.setProperty("--custom-print-margin", formattedMargin);

    let pageStyle = document.getElementById("dynamic-page-style");
    if (!pageStyle) {
      pageStyle = document.createElement("style");
      pageStyle.id = "dynamic-page-style";
      document.head.appendChild(pageStyle);
    }
    pageStyle.textContent = `@media print { @page { margin: ${formattedMargin} !important; } }`;
  }

  // Padding
  if (els.paddingSelect) {
    if (els.paddingSelect.value === "normal") {
      doc.style.removeProperty("--custom-padding");
    } else {
      const rawPadding = els.paddingSelect.value === "custom" ? els.customPaddingInput.value :
        (els.paddingSelect.value === "compact" ? "24px 32px" : "80px 96px");
      doc.style.setProperty("--custom-padding", formatCSSValue(rawPadding, "px") || "52px 56px");
    }
  }

  // Font style
  if (els.fontStyleSelect) {
    const style = els.fontStyleSelect.value;
    const fontMap = {
      serif: 'Georgia, "Times New Roman", serif',
      sans: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace',
      system: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      helvetica: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      verdana: 'Verdana, Geneva, sans-serif',
      trebuchet: '"Trebuchet MS", "Lucida Grande", "Lucida Sans Unicode", sans-serif',
      tahoma: 'Tahoma, Geneva, sans-serif',
      palatino: '"Palatino Linotype", "Book Antiqua", Palatino, serif',
      garamond: 'Garamond, Baskerville, "Baskerville Old Face", "Times New Roman", serif',
      bookman: '"Bookman Old Style", Bookman, "URW Bookman L", serif',
      comic: '"Comic Sans MS", "Comic Sans", cursive',
      impact: 'Impact, Charcoal, "Arial Black", sans-serif',
      pacifico: '"Pacifico", cursive',
      caveat: '"Caveat", cursive',
      fredoka: '"Fredoka", sans-serif',
      bangers: '"Bangers", cursive',
      chewy: '"Chewy", cursive',
      amatic: '"Amatic SC", cursive',
      kalam: '"Kalam", cursive',
      patrick: '"Patrick Hand", cursive',
      gloria: '"Gloria Hallelujah", cursive',
      permanent: '"Permanent Marker", cursive',
    };
    doc.style.setProperty("--custom-font-family", fontMap[style] || fontMap.serif);
  }

  // Font size
  if (els.fontSizeSelect) {
    const isResume = doc.className.includes("layout-resume");
    const rawFontSize = els.fontSizeSelect.value === "custom" ? els.customFontSizeInput.value :
      (els.fontSizeSelect.value === "small" ? (isResume ? "9.5pt" : "13px") :
       els.fontSizeSelect.value === "large" ? (isResume ? "12.5pt" : "18px") :
       (isResume ? "11pt" : "15px"));
    const defaultUnit = isResume ? "pt" : "px";
    doc.style.setProperty("--custom-font-size", formatCSSValue(rawFontSize, defaultUnit) || (isResume ? "11pt" : "15px"));
  }

  // Line height
  if (els.lineHeightSelect) {
    const rawLineHeight = els.lineHeightSelect.value === "custom" ? els.customLineHeightInput.value :
      (els.lineHeightSelect.value === "compact" ? "1.4" :
       els.lineHeightSelect.value === "relaxed" ? "2.0" : "1.7");
    let finalLineHeight = rawLineHeight.trim();
    if (/^[\d.]+$/.test(finalLineHeight)) {
      let multiplier = parseFloat(finalLineHeight);
      if (isNaN(multiplier) || multiplier < 1.1) multiplier = 1.1;
      const fontSize = parseFloat(window.getComputedStyle(doc).fontSize) || 15;
      finalLineHeight = (multiplier * fontSize) + "px";
    }
    doc.style.setProperty("--custom-line-height", finalLineHeight || "25.5px");
  }

  // Code theme
  if (els.codeThemeSelect) {
    applyCodeTheme(els.codeThemeSelect.value);
  }

  // Preview theme
  doc.setAttribute("data-theme", els.themeSelect.value);

  // Page borders
  if (els.showBordersCheckbox.checked) {
    doc.classList.add("show-page-borders");
  } else {
    doc.classList.remove("show-page-borders");
  }

  // Re-render to apply TOC / cover page / watermark changes
  renderMarkdown();
  scheduleAutoSave();
}

// ── Boot ────────────────────────────────────────────────────────────
function boot() {
  // Try to restore auto-saved session
  const restored = restoreSave();
  if (!restored) {
    els.markdownInput.value = sampleMarkdown;
  }

  // Setup drag & drop
  setupDragDrop();

  // Setup logo upload
  setupLogo();

  // Bind all settings controls
  const settingsControls = [
    [els.layoutSelect, "change"],
    [els.marginSelect, "change"],
    [els.customMarginInput, "input"],
    [els.paddingSelect, "change"],
    [els.customPaddingInput, "input"],
    [els.fontSizeSelect, "change"],
    [els.customFontSizeInput, "input"],
    [els.lineHeightSelect, "change"],
    [els.customLineHeightInput, "input"],
    [els.fontStyleSelect, "change"],
    [els.themeSelect, "change"],
    [els.codeThemeSelect, "change"],
    [els.showBordersCheckbox, "change"],
    [els.tocCheckbox, "change"],
    [els.coverPageCheckbox, "change"],
    [els.watermarkInput, "input"],
  ];
  settingsControls.forEach(([el, evt]) => {
    if (el) el.addEventListener(evt, applySettings);
  });

  // Initial render
  renderMarkdown();

  // Bind source panel
  els.markdownInput.addEventListener("input", () => {
    renderMarkdown();
  });
  els.filenameInput.addEventListener("input", () => {
    els.filenameInput.value = safeFilename(els.filenameInput.value);
    scheduleAutoSave();
  });
  els.openFileButton.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) loadFile(file);
  });
  els.sampleButton.addEventListener("click", () => {
    els.markdownInput.value = sampleMarkdown;
    els.filenameInput.value = "document.pdf";
    renderMarkdown();
  });
  els.downloadButton.addEventListener("click", exportPdf);
  window.addEventListener("resize", updateCopyButtons);

  // Apply settings on boot
  applySettings();
}

boot();
