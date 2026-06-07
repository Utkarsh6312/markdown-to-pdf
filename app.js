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

| Feature | Status |
| --- | --- |
| Markdown preview | Ready |
| PDF export | Ready |
| Browser-only flow | Ready |
`;

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
  fontSizeSelect: document.querySelector("#fontSizeSelect"),
  customFontSizeInput: document.querySelector("#customFontSizeInput"),
  lineHeightSelect: document.querySelector("#lineHeightSelect"),
  customLineHeightInput: document.querySelector("#customLineHeightInput"),
  paddingSelect: document.querySelector("#paddingSelect"),
  customPaddingInput: document.querySelector("#customPaddingInput"),
  themeSelect: document.querySelector("#themeSelect"),
  showBordersCheckbox: document.querySelector("#showBordersCheckbox"),
};
const defaultDocumentTitle = document.title;

function safeFilename(value) {
  const trimmed = value.trim() || "document.pdf";
  return trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
}

function formatCSSValue(val, defaultUnit) {
  val = val.trim();
  if (!val) return "";
  if (/^[\d.]+$/.test(val)) {
    return val + defaultUnit;
  }
  return val;
}

function applyHtml2CanvasWorkaround(clonedDoc, originalDoc) {
  const clonedPreview = clonedDoc.getElementById("previewDocument");
  if (!clonedPreview) return;
  clonedPreview.style.lineHeight = window.getComputedStyle(originalDoc).lineHeight;
  const originalElements = originalDoc.querySelectorAll('*');
  const clonedElements = clonedPreview.querySelectorAll('*');
  for (let i = 0; i < originalElements.length; i++) {
    if (clonedElements[i]) {
      clonedElements[i].style.lineHeight = window.getComputedStyle(originalElements[i]).lineHeight;
    }
  }
}

function updateCopyButtons() {
  const container = els.copyButtonsContainer;
  if (!container) return;
  container.innerHTML = "";

  const doc = els.previewDocument;
  const rect = doc.getBoundingClientRect();
  if (rect.width === 0) return;

  // A4 aspect ratio 1 : 1.4142. Standard page height based on preview width.
  const pageHeight = rect.width * 1.4142;
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
  downloadAllBtn.className = "primary-button"; // Make it stand out as a download action
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

async function copyEntireDocumentAsImage() {
  const statusPill = els.statusPill;
  const originalText = statusPill.textContent;
  statusPill.textContent = `Rendering entire document...`;
  
  try {
    const doc = els.previewDocument;
    
    const wasShowingBorders = doc.classList.contains("show-page-borders");
    if (wasShowingBorders) doc.classList.remove("show-page-borders");

    const canvas = await html2canvas(doc, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: window.getComputedStyle(doc).backgroundColor || "#ffffff"
    });

    if (wasShowingBorders) doc.classList.add("show-page-borders");

    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
        statusPill.textContent = `Entire Document Copied!`;
        setTimeout(() => {
          statusPill.textContent = "Ready";
        }, 2000);
      } catch (err) {
        console.error(err);
        statusPill.textContent = "Clipboard write blocked";
      }
    }, "image/png");

  } catch (error) {
    console.error(error);
    statusPill.textContent = "Render failed";
    setTimeout(() => {
      statusPill.textContent = originalText;
    }, 2000);
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
      scale: 2,
      useCORS: true,
      logging: false,
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
    setTimeout(() => {
      statusPill.textContent = "Ready";
    }, 2000);

  } catch (error) {
    console.error(error);
    statusPill.textContent = "Render failed";
    setTimeout(() => {
      statusPill.textContent = originalText;
    }, 2000);
  }
}

async function copyPageAsImage(pageIndex, pageHeight) {
  const statusPill = els.statusPill;
  const originalText = statusPill.textContent;
  statusPill.textContent = `Rendering page ${pageIndex}...`;
  
  try {
    const doc = els.previewDocument;
    
    // Temporarily disable page borders so they don't show up in the image export
    const wasShowingBorders = doc.classList.contains("show-page-borders");
    if (wasShowingBorders) doc.classList.remove("show-page-borders");

    const canvas = await html2canvas(doc, {
      scale: 2, // High DPI render
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      onclone: (clonedDoc) => applyHtml2CanvasWorkaround(clonedDoc, doc)
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
    tempCtx.drawImage(
      canvas,
      0, startY, sliceWidth, tempCanvas.height,
      0, 0, tempCanvas.width, tempCanvas.height
    );

    tempCanvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ [blob.type]: blob })
        ]);
        statusPill.textContent = `Page ${pageIndex} Copied!`;
        setTimeout(() => {
          statusPill.textContent = "Ready";
        }, 2000);
      } catch (err) {
        console.error(err);
        statusPill.textContent = "Clipboard write blocked";
      }
    }, "image/png");

  } catch (error) {
    console.error(error);
    statusPill.textContent = "Render failed";
    setTimeout(() => {
      statusPill.textContent = originalText;
    }, 2000);
  }
}

function renderMarkdown() {
  const raw = els.markdownInput.value || "# Empty document";
  const html = marked.parse(raw, { breaks: true, gfm: true });
  const cleanHtml = DOMPurify.sanitize(html);
  els.previewDocument.innerHTML = cleanHtml;
  els.metaText.textContent = `${raw.length.toLocaleString()} characters`;
  
  // Wait a frame for correct layout measurements
  requestAnimationFrame(() => {
    updateCopyButtons();
  });
}

function waitForPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(resolve);
    });
  });
}

async function loadFile(file) {
  const text = await file.text();
  els.markdownInput.value = text;
  els.filenameInput.value = file.name.replace(/\.(md|markdown)$/i, ".pdf");
  renderMarkdown();
}

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
    window.setTimeout(() => {
      document.title = defaultDocumentTitle;
    }, 500);
  }
}

function boot() {
  els.markdownInput.value = sampleMarkdown;

  const applySettings = () => {
    const doc = els.previewDocument;

    // Toggle custom inputs visibility
    if (els.marginSelect) els.customMarginInput.style.display = els.marginSelect.value === "custom" ? "block" : "none";
    if (els.paddingSelect) els.customPaddingInput.style.display = els.paddingSelect.value === "custom" ? "block" : "none";
    if (els.fontSizeSelect) els.customFontSizeInput.style.display = els.fontSizeSelect.value === "custom" ? "block" : "none";
    if (els.lineHeightSelect) els.customLineHeightInput.style.display = els.lineHeightSelect.value === "custom" ? "block" : "none";

    // CSS variables for typography and margin
    if (els.marginSelect) {
      const rawMargin = els.marginSelect.value === "custom" ? els.customMarginInput.value :
                       (els.marginSelect.value === "narrow" ? "10mm" :
                        els.marginSelect.value === "wide" ? "30mm" : "20mm");
      doc.style.setProperty("--custom-print-margin", formatCSSValue(rawMargin, "mm") || "20mm");
    }

    if (els.paddingSelect) {
      if (els.paddingSelect.value === "normal") {
      doc.style.removeProperty("--custom-padding");
    } else {
      const rawPadding = els.paddingSelect.value === "custom" ? els.customPaddingInput.value :
                        (els.paddingSelect.value === "compact" ? "24px 32px" : "80px 96px");
      doc.style.setProperty("--custom-padding", formatCSSValue(rawPadding, "px") || "52px 56px");
    }
    }

    if (els.fontSizeSelect) {
      const rawFontSize = els.fontSizeSelect.value === "custom" ? els.customFontSizeInput.value :
                         (els.fontSizeSelect.value === "small" ? "13px" :
                          els.fontSizeSelect.value === "large" ? "18px" : "15px");
      doc.style.setProperty("--custom-font-size", formatCSSValue(rawFontSize, "px") || "15px");
    }

    if (els.lineHeightSelect) {
      const rawLineHeight = els.lineHeightSelect.value === "custom" ? els.customLineHeightInput.value :
                         (els.lineHeightSelect.value === "compact" ? "1.4" :
                          els.lineHeightSelect.value === "relaxed" ? "2.0" : "1.7");
      doc.style.setProperty("--custom-line-height", formatCSSValue(rawLineHeight, "em") || "1.7em");
    }

    doc.setAttribute("data-theme", els.themeSelect.value);
    
    if (els.showBordersCheckbox.checked) {
      doc.classList.add("show-page-borders");
    } else {
      doc.classList.remove("show-page-borders");
    }
    
    updateCopyButtons();
  };

  if (els.marginSelect) els.marginSelect.addEventListener("change", applySettings);
  if (els.customMarginInput) els.customMarginInput.addEventListener("input", applySettings);
  if (els.paddingSelect) els.paddingSelect.addEventListener("change", applySettings);
  if (els.customPaddingInput) els.customPaddingInput.addEventListener("input", applySettings);
  if (els.fontSizeSelect) els.fontSizeSelect.addEventListener("change", applySettings);
  if (els.customFontSizeInput) els.customFontSizeInput.addEventListener("input", applySettings);
  if (els.lineHeightSelect) els.lineHeightSelect.addEventListener("change", applySettings);
  if (els.customLineHeightInput) els.customLineHeightInput.addEventListener("input", applySettings);
  if (els.themeSelect) els.themeSelect.addEventListener("change", applySettings);
  if (els.showBordersCheckbox) els.showBordersCheckbox.addEventListener("change", applySettings);

  renderMarkdown();

  els.markdownInput.addEventListener("input", renderMarkdown);
  els.filenameInput.addEventListener("input", () => {
    els.filenameInput.value = safeFilename(els.filenameInput.value);
  });
  els.openFileButton.addEventListener("click", () => els.fileInput.click());
  els.fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) {
      loadFile(file);
    }
  });
  els.sampleButton.addEventListener("click", () => {
    els.markdownInput.value = sampleMarkdown;
    els.filenameInput.value = "document.pdf";
    renderMarkdown();
  });
  els.downloadButton.addEventListener("click", exportPdf);
  window.addEventListener("resize", updateCopyButtons);

  // Set default state
  applySettings();
}

boot();
