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
};
const defaultDocumentTitle = document.title;

function safeFilename(value) {
  const trimmed = value.trim() || "document.pdf";
  return trimmed.toLowerCase().endsWith(".pdf") ? trimmed : `${trimmed}.pdf`;
}

function renderMarkdown() {
  const raw = els.markdownInput.value || "# Empty document";
  const html = marked.parse(raw, { breaks: true, gfm: true });
  const cleanHtml = DOMPurify.sanitize(html);
  els.previewDocument.innerHTML = cleanHtml;
  els.metaText.textContent = `${raw.length.toLocaleString()} characters`;
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
}

boot();
