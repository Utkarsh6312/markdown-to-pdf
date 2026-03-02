# Markdown/PDF CLI (`md2pdf.py`)

Production-grade Python CLI that supports two directions:
- **Markdown -> PDF** (`md2pdf`)
- **PDF -> Markdown** (`pdf2md`) with **image extraction** (Marker) and optional **Pandoc cleanup**

## Features

- Single CLI for both directions
- Auto mode detection from input extension
  - `.md/.markdown` -> `md2pdf`
  - `.pdf` -> `pdf2md`
- Pandoc-based PDF generation (default) with LaTeX support
- WeasyPrint fallback backend for HTML/CSS rendering
- Marker-based PDF to Markdown conversion
- Extracted images copied with relative links in generated Markdown
- Optional custom image directory (`--images-dir`)
- Optional OCR and LLM flags for Marker (`--force-ocr`, `--use-llm`)

## Project Files

- `md2pdf.py` - CLI implementation
- `requirements.txt` - Python dependencies
- `style.css` - Optional CSS template for md2pdf (HTML/CSS-compatible engines)

## Prerequisites

### Python
- Python 3.10+
- `pip`

### External tools
- **Pandoc** (required)
- **TeX engine** for Pandoc PDF rendering (recommended: XeLaTeX via MiKTeX/TeX Live)
- **Marker CLI** (`marker_single`) from `marker-pdf` package

Windows quick install (external tools):

```powershell
winget install --id JohnMacFarlane.Pandoc -e
winget install --id MiKTeX.MiKTeX -e
```

## Setup

### Windows PowerShell

```powershell
cd "c:\Users\ASUS\Desktop\projects\p6 markdown to pdff"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### macOS/Linux

```bash
cd /path/to/project
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## Usage

### Interactive mode (recommended)

Run without arguments and the tool will ask for input path, mode, output path, and mode-specific options:

```powershell
python md2pdf.py
```

## 1) Markdown -> PDF

Basic:

```powershell
python md2pdf.py -i ".\docs\notes.md"
```

Explicit mode/backend:

```powershell
python md2pdf.py -i ".\docs\notes.md" --mode md2pdf --backend pandoc --pdf-engine xelatex
```

Reduce page borders (use more page area):

```powershell
python md2pdf.py -i ".\docs\notes.md" --mode md2pdf --page-margin 0.25in
```

Use WeasyPrint backend with custom CSS:

```powershell
python md2pdf.py -i ".\docs\notes.md" --mode md2pdf --backend weasyprint -c ".\style.css"
```

## 2) PDF -> Markdown + Images

Basic:

```powershell
python md2pdf.py -i ".\docs\paper.pdf"
```

Output defaults to `paper.md` beside the input.

Custom markdown output:

```powershell
python md2pdf.py -i ".\docs\paper.pdf" -o ".\out\paper.md"
```

Custom image directory:

```powershell
python md2pdf.py -i ".\docs\paper.pdf" -o ".\out\paper.md" --images-dir ".\out\images"
```

Force OCR for scanned PDFs:

```powershell
python md2pdf.py -i ".\docs\scan.pdf" --mode pdf2md --force-ocr
```

Skip Pandoc cleanup of Marker markdown:

```powershell
python md2pdf.py -i ".\docs\paper.pdf" --skip-pandoc-clean
```

## CLI Arguments

- `-i, --input` (required): source `.md/.markdown` or `.pdf`
- `-o, --output` (optional): output path (`.pdf` for md2pdf, `.md` for pdf2md)
- `--mode` (optional): `auto` (default), `md2pdf`, `pdf2md`
- `-c, --css` (optional): custom CSS for md2pdf
- `--backend` (optional): md2pdf backend `pandoc` (default) or `weasyprint`
- `--pdf-engine` (optional): Pandoc engine for md2pdf (default `xelatex`)
- `--page-margin` (optional): md2pdf page margin (default `0.45in`)
- `--images-dir` (optional): target folder for extracted images in pdf2md
- `--force-ocr` (optional): force OCR in Marker for pdf2md
- `--use-llm` (optional): use Marker LLM mode when configured
- `--skip-pandoc-clean` (optional): do not normalize Marker output with Pandoc
- `--log-level` (optional): `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`

## LaTeX and Images Notes

- **Markdown -> PDF**: LaTeX math is handled by Pandoc + TeX engine.
- **PDF -> Markdown**: Marker attempts to recover equations into markdown/LaTeX where possible.
- Extracted image links are kept relative to the generated markdown output.

## Common Errors

### `Pandoc executable not found`

Install Pandoc and verify:

```powershell
pandoc --version
```

### `xelatex not found`

Install MiKTeX/TeX Live or choose another `--pdf-engine`.

### `Marker executable not found`

Install Marker package:

```powershell
pip install marker-pdf
```

Then verify:

```powershell
marker_single --help
```

Note: first-time Marker setup can be large and may take a while because it pulls ML dependencies/models.

### WeasyPrint GTK error on Windows (`libgobject-2.0-0`)

Install MSYS2 runtime dependencies and set:

```powershell
$env:WEASYPRINT_DLL_DIRECTORIES = "C:\msys64\ucrt64\bin"
```

`cmd.exe` equivalent:

```cmd
set WEASYPRINT_DLL_DIRECTORIES=C:\msys64\ucrt64\bin
```

## End-to-End Example

```powershell
cd "c:\Users\ASUS\Desktop\projects\p6 markdown to pdff"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python md2pdf.py -i ".\docs\paper.pdf" -o ".\out\paper.md" --images-dir ".\out\images"
python md2pdf.py -i ".\out\paper.md" -o ".\out\paper.pdf" --mode md2pdf --backend pandoc --pdf-engine xelatex
```

## Deactivate venv

```powershell
deactivate
```
