# md2pdf

This repo now contains two delivery modes:

- A Python CLI in [md2pdf.py](/c:/Users/ASUS/Desktop/projects/p6 markdown to pdff/md2pdf.py)
- A static browser app in [index.html](/c:/Users/ASUS/Desktop/projects/p6 markdown to pdff/index.html)

The browser app is the simplest deployment target if you want a public site similar to an online converter with no server, no backend, and no database.

## Static Site

Files:

- [index.html](/c:/Users/ASUS/Desktop/projects/p6 markdown to pdff/index.html)
- [app.js](/c:/Users/ASUS/Desktop/projects/p6 markdown to pdff/app.js)
- [site.css](/c:/Users/ASUS/Desktop/projects/p6 markdown to pdff/site.css)
- [\.nojekyll](/c:/Users/ASUS/Desktop/projects/p6 markdown to pdff/.nojekyll)

What it does:

- Runs fully in the browser
- Accepts pasted Markdown or local `.md` files
- Shows a live preview
- Exports directly to PDF client-side
- Can be hosted on GitHub Pages as static files

GitHub Pages deployment:

1. Push the repo to GitHub.
2. In the repo settings, enable Pages from the main branch root.
3. Open the generated Pages URL.

The page depends on CDN versions of `marked`, `DOMPurify`, and `html2pdf.js`.

## Python CLI

## Features

- Markdown (`.md`, `.markdown`) to PDF conversion
- Pandoc-based PDF generation with LaTeX math support
- WeasyPrint backend for HTML/CSS rendering
- Optional custom CSS for HTML/CSS-capable PDF engines
- Interactive mode for local usage

## Project Files

- `md2pdf.py` - CLI implementation
- `requirements.txt` - Python dependencies
- `style.css` - Optional CSS template for HTML/CSS-capable PDF engines

## Prerequisites

### Python

- Python 3.10+
- `pip`

### External tools

- **Pandoc** (required)
- **TeX engine** for Pandoc PDF rendering (recommended: XeLaTeX via MiKTeX/TeX Live)

Windows quick install:

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

### Interactive mode

Run without arguments and the tool will ask for input path, output path, and rendering options:

```powershell
python md2pdf.py
```

### Basic conversion

```powershell
python md2pdf.py -i ".\docs\notes.md"
```

### Pandoc backend with explicit engine

```powershell
python md2pdf.py -i ".\docs\notes.md" --backend pandoc --pdf-engine xelatex
```

### Smaller margins

```powershell
python md2pdf.py -i ".\docs\notes.md" --page-margin 0.25in
```

### WeasyPrint backend with custom CSS

```powershell
python md2pdf.py -i ".\docs\notes.md" --backend weasyprint -c ".\style.css"
```

## CLI Arguments

- `-i, --input` (required): source `.md` or `.markdown`
- `-o, --output` (optional): PDF output path; defaults to the input name with `.pdf`
- `-c, --css` (optional): custom CSS for HTML/CSS-capable PDF engines
- `--backend` (optional): `pandoc` (default) or `weasyprint`
- `--pdf-engine` (optional): Pandoc engine for `--backend pandoc` (default `xelatex`)
- `--page-margin` (optional): page margin override (default `0.45in`)
- `--font-size` (optional): CSS-capable base font size (default `12.5pt`)
- `--latex-font-size` (optional): Pandoc LaTeX font size (default `12pt`)
- `--log-level` (optional): `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`

## Notes

- LaTeX math is handled by Pandoc plus your selected PDF engine.
- If you use WeasyPrint, local image paths are resolved relative to the input file directory.
- The CLI rejects non-Markdown input files.

## Common Errors

### `Pandoc executable not found`

Install Pandoc and verify:

```powershell
pandoc --version
```

### `xelatex not found`

Install MiKTeX/TeX Live or choose another `--pdf-engine`.

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
python md2pdf.py -i ".\sample.md" -o ".\out\sample.pdf" --backend pandoc --pdf-engine xelatex
```

## Deactivate venv

```powershell
deactivate
```
