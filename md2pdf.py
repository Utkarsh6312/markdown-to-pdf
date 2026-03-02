"""CLI tool for Markdown/PDF conversion.

Supported flows:
- Markdown (.md/.markdown) -> PDF (.pdf)
- PDF (.pdf) -> Markdown (.md) with image extraction
"""

from __future__ import annotations

import argparse
import logging
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from typing import Optional

import markdown

LOGGER = logging.getLogger("md2pdf")
DEFAULT_PAGE_MARGIN = "0.45in"
DEFAULT_FONT_SIZE = "12.5pt"
DEFAULT_LATEX_FONT_SIZE = "12pt"

DEFAULT_CSS = """
@page {
  size: A4;
  margin: 0.45in;
}

:root {
  color-scheme: light;
}

body {
  font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
  font-size: 12.5pt;
  line-height: 1.6;
  color: #1f2937;
}

h1, h2, h3, h4, h5, h6 {
  font-weight: 600;
  line-height: 1.25;
  color: #111827;
  margin: 1.2em 0 0.5em;
}

h1 {
  font-size: 1.9em;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 0.2em;
}

h2 {
  font-size: 1.5em;
  border-bottom: 1px solid #f0f1f3;
  padding-bottom: 0.15em;
}

p {
  margin: 0.8em 0;
}

a {
  color: #1d4ed8;
  text-decoration: none;
}

a:hover {
  text-decoration: underline;
}

table {
  border-collapse: collapse;
  width: 100%;
  margin: 1.2em 0;
  font-size: 0.95em;
}

th, td {
  border: 1px solid #d1d5db;
  padding: 0.55em 0.7em;
  vertical-align: top;
}

th {
  background: #f3f4f6;
  font-weight: 600;
}

tr:nth-child(even) td {
  background: #fafafa;
}

img {
  max-width: 100%;
  height: auto;
}

pre {
  background: #f3f4f6;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 0.9em;
  overflow-x: auto;
}

code {
  font-family: "Cascadia Mono", "Consolas", "Liberation Mono", monospace;
  font-size: 0.92em;
  background: #f3f4f6;
  border-radius: 4px;
  padding: 0.12em 0.28em;
}

pre code {
  background: transparent;
  padding: 0;
}

blockquote {
  border-left: 4px solid #d1d5db;
  margin: 1.1em 0;
  padding: 0.3em 0.9em;
  color: #374151;
  background: #f9fafb;
}

hr {
  border: 0;
  border-top: 1px solid #e5e7eb;
  margin: 1.5em 0;
}

.footnote {
  font-size: 0.9em;
}
""".strip()

IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"}


def parse_arguments() -> argparse.Namespace:
    """Parse and validate command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Convert Markdown to PDF or PDF to Markdown with image extraction."
    )
    parser.add_argument(
        "-i",
        "--input",
        help="Path to source file (.md/.markdown or .pdf).",
    )
    parser.add_argument(
        "-o",
        "--output",
        help=(
            "Destination output file path. Defaults by mode: input.pdf for md2pdf, "
            "input.md for pdf2md."
        ),
    )
    parser.add_argument(
        "--mode",
        default="auto",
        choices=["auto", "md2pdf", "pdf2md"],
        help="Conversion mode. Default: auto (inferred from input extension).",
    )
    parser.add_argument(
        "-c",
        "--css",
        help="Optional CSS path for md2pdf HTML/CSS-capable engines.",
    )
    parser.add_argument(
        "--backend",
        default="pandoc",
        choices=["pandoc", "weasyprint"],
        help=(
            "md2pdf backend. 'pandoc' is recommended for LaTeX math and robust "
            "image handling. Default: pandoc."
        ),
    )
    parser.add_argument(
        "--pdf-engine",
        default="xelatex",
        help=(
            "Pandoc PDF engine (for example: xelatex, lualatex, pdflatex, "
            "weasyprint). Used only for md2pdf with --backend pandoc. "
            "Default: xelatex."
        ),
    )
    parser.add_argument(
        "--page-margin",
        default=DEFAULT_PAGE_MARGIN,
        help=(
            "md2pdf only. Page margin for PDF output (for example: 0.4in, 12mm). "
            f"Default: {DEFAULT_PAGE_MARGIN}."
        ),
    )
    parser.add_argument(
        "--font-size",
        default=DEFAULT_FONT_SIZE,
        help=(
            "md2pdf only. Base text font size for CSS-capable output "
            "(for example: 12pt, 13px). "
            f"Default: {DEFAULT_FONT_SIZE}."
        ),
    )
    parser.add_argument(
        "--latex-font-size",
        default=DEFAULT_LATEX_FONT_SIZE,
        help=(
            "md2pdf only. Pandoc LaTeX base font size "
            "(for example: 12pt). "
            f"Default: {DEFAULT_LATEX_FONT_SIZE}."
        ),
    )
    parser.add_argument(
        "--images-dir",
        help=(
            "pdf2md only. Directory where extracted images are written. "
            "If omitted, images are written relative to the output Markdown file."
        ),
    )
    parser.add_argument(
        "--device",
        default="auto",
        choices=["auto", "cpu", "cuda", "mps"],
        help=(
            "pdf2md only. Marker compute device. "
            "'auto' chooses CUDA/MPS if available, else CPU. Default: auto."
        ),
    )
    parser.add_argument(
        "--gpu-index",
        type=int,
        default=0,
        help="pdf2md only. CUDA GPU index when --device=cuda. Default: 0.",
    )
    parser.add_argument(
        "--force-ocr",
        action="store_true",
        help="pdf2md only. Ask Marker to force OCR for difficult PDFs.",
    )
    parser.add_argument(
        "--use-llm",
        action="store_true",
        help="pdf2md only. Enable Marker LLM mode if configured.",
    )
    parser.add_argument(
        "--skip-pandoc-clean",
        action="store_true",
        help="pdf2md only. Skip Pandoc cleanup/normalization of Marker Markdown output.",
    )
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Logging verbosity. Default: INFO.",
    )
    return parser.parse_args()


def configure_logging(level: str) -> None:
    """Configure root logging for CLI execution."""
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(levelname)s: %(message)s",
    )


def prompt_required_text(prompt: str) -> str:
    """Prompt until a non-empty value is received."""
    while True:
        try:
            value = input(prompt).strip()
        except EOFError as exc:
            raise RuntimeError("Interactive input was interrupted.") from exc
        if value:
            return value
        print("Value is required.")


def prompt_text(prompt: str, default: Optional[str] = None) -> Optional[str]:
    """Prompt for an optional text value."""
    try:
        raw = input(prompt).strip()
    except EOFError as exc:
        raise RuntimeError("Interactive input was interrupted.") from exc
    if raw:
        return raw
    return default


def prompt_choice(prompt: str, choices: list[str], default: str) -> str:
    """Prompt for a value from a fixed set of choices."""
    normalized_choices = {choice.lower(): choice for choice in choices}
    while True:
        try:
            raw = input(prompt).strip().lower()
        except EOFError as exc:
            raise RuntimeError("Interactive input was interrupted.") from exc
        if not raw:
            return default
        if raw in normalized_choices:
            return normalized_choices[raw]
        print(f"Invalid choice. Pick one of: {', '.join(choices)}")


def prompt_bool(prompt: str, default: bool = False) -> bool:
    """Prompt for a yes/no value."""
    default_hint = "Y/n" if default else "y/N"
    while True:
        try:
            raw = input(f"{prompt} [{default_hint}]: ").strip().lower()
        except EOFError as exc:
            raise RuntimeError("Interactive input was interrupted.") from exc
        if not raw:
            return default
        if raw in {"y", "yes"}:
            return True
        if raw in {"n", "no"}:
            return False
        print("Please answer with 'y' or 'n'.")


def collect_interactive_arguments() -> argparse.Namespace:
    """Collect conversion settings interactively."""
    if not sys.stdin.isatty():
        raise RuntimeError(
            "No CLI arguments provided and interactive input is unavailable. "
            "Run with -i/--input or start from an interactive terminal."
        )

    print("Interactive mode: Markdown/PDF converter")
    input_value = prompt_required_text("Input file path: ")
    default_mode = "pdf2md" if Path(input_value).suffix.lower() == ".pdf" else "md2pdf"
    mode = prompt_choice(
        f"Mode (auto/md2pdf/pdf2md) [default: {default_mode}]: ",
        ["auto", "md2pdf", "pdf2md"],
        default_mode,
    )
    effective_mode = resolve_mode(Path(input_value), mode)
    output_value = prompt_text("Output path (leave blank for default): ")
    log_level = prompt_choice(
        "Log level (DEBUG/INFO/WARNING/ERROR/CRITICAL) [default: INFO]: ",
        ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        "INFO",
    )

    css = None
    backend = "pandoc"
    pdf_engine = "xelatex"
    page_margin = DEFAULT_PAGE_MARGIN
    font_size = DEFAULT_FONT_SIZE
    latex_font_size = DEFAULT_LATEX_FONT_SIZE
    images_dir = None
    device = "auto"
    gpu_index = 0
    force_ocr = False
    use_llm = False
    skip_pandoc_clean = False

    if effective_mode == "md2pdf":
        backend = prompt_choice(
            "Backend (pandoc/weasyprint) [default: pandoc]: ",
            ["pandoc", "weasyprint"],
            "pandoc",
        )
        css = prompt_text("CSS path (optional): ")
        if backend == "pandoc":
            pdf_engine = (
                prompt_text(
                    "Pandoc PDF engine [default: xelatex]: ",
                    "xelatex",
                )
                or "xelatex"
            )
            latex_font_size = (
                prompt_text(
                    f"LaTeX font size [default: {DEFAULT_LATEX_FONT_SIZE}]: ",
                    DEFAULT_LATEX_FONT_SIZE,
                )
                or DEFAULT_LATEX_FONT_SIZE
            )
        font_size = (
            prompt_text(
                f"Base font size [default: {DEFAULT_FONT_SIZE}]: ",
                DEFAULT_FONT_SIZE,
            )
            or DEFAULT_FONT_SIZE
        )
        page_margin = (
            prompt_text(
                f"Page margin (example: 0.4in, 12mm) [default: {DEFAULT_PAGE_MARGIN}]: ",
                DEFAULT_PAGE_MARGIN,
            )
            or DEFAULT_PAGE_MARGIN
        )
    else:
        images_dir = prompt_text("Images output directory (optional): ")
        device = prompt_choice(
            "Device (auto/cuda/cpu/mps) [default: auto]: ",
            ["auto", "cuda", "cpu", "mps"],
            "auto",
        )
        if device == "cuda":
            gpu_index_raw = prompt_text("CUDA GPU index [default: 0]: ", "0")
            try:
                gpu_index = int(gpu_index_raw or "0")
            except ValueError:
                print("Invalid GPU index. Using 0.")
                gpu_index = 0
        force_ocr = prompt_bool("Force OCR for scanned PDFs?", default=False)
        use_llm = prompt_bool("Enable Marker LLM mode?", default=False)
        skip_pandoc_clean = prompt_bool("Skip Pandoc cleanup?", default=False)

    return argparse.Namespace(
        input=input_value,
        output=output_value,
        mode=mode,
        css=css,
        backend=backend,
        pdf_engine=pdf_engine,
        page_margin=page_margin,
        font_size=font_size,
        latex_font_size=latex_font_size,
        images_dir=images_dir,
        device=device,
        gpu_index=gpu_index,
        force_ocr=force_ocr,
        use_llm=use_llm,
        skip_pandoc_clean=skip_pandoc_clean,
        log_level=log_level,
    )


def validate_input_file(input_path: Path) -> None:
    """Validate input path existence and type."""
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")
    if input_path.is_dir():
        raise IsADirectoryError(f"Input path is a directory: {input_path}")


def resolve_mode(input_path: Path, mode_arg: str) -> str:
    """Determine conversion mode based on CLI mode and file extension."""
    if mode_arg != "auto":
        return mode_arg

    if input_path.suffix.lower() == ".pdf":
        return "pdf2md"
    return "md2pdf"


def warn_unexpected_extension(input_path: Path, mode: str) -> None:
    """Warn when file extension doesn't match selected mode conventions."""
    suffix = input_path.suffix.lower()
    if mode == "md2pdf" and suffix not in {".md", ".markdown"}:
        LOGGER.warning(
            "Input extension '%s' is unusual for Markdown-to-PDF mode.",
            input_path.suffix,
        )
    if mode == "pdf2md" and suffix != ".pdf":
        LOGGER.warning(
            "Input extension '%s' is unusual for PDF-to-Markdown mode.",
            input_path.suffix,
        )


def resolve_output_path(input_path: Path, output_arg: Optional[str], expected_suffix: str) -> Path:
    """Resolve output path and enforce a suffix for selected conversion mode."""
    if output_arg:
        output_path = Path(output_arg)
        if output_path.suffix.lower() == expected_suffix.lower():
            return output_path
        return output_path.with_suffix(expected_suffix)

    return input_path.with_suffix(expected_suffix)


def load_css(css_path: Optional[Path]) -> str:
    """Load custom CSS from disk or return default CSS."""
    if css_path is None:
        LOGGER.info("No custom CSS provided. Using built-in default styling.")
        return DEFAULT_CSS

    css_text = css_path.read_text(encoding="utf-8")
    LOGGER.info("Loaded custom CSS from %s", css_path)
    return css_text


def convert_md_to_html(markdown_text: str) -> str:
    """Convert Markdown text to HTML using GFM-compatible extensions."""
    return markdown.markdown(
        markdown_text,
        extensions=[
            "extra",
            "fenced_code",
            "tables",
            "footnotes",
            "codehilite",
        ],
        extension_configs={
            "codehilite": {
                "guess_lang": False,
                "noclasses": True,
                "pygments_style": "friendly",
            }
        },
        output_format="html5",
    )


def build_html_document(body_html: str, css_text: str, title: str) -> str:
    """Wrap rendered body HTML in a complete HTML document."""
    return f"""<!DOCTYPE html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\" />
  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />
  <title>{title}</title>
  <style>
{css_text}
  </style>
</head>
<body>
{body_html}
</body>
</html>
"""


def apply_css_overrides(css_text: str, page_margin: str, font_size: str) -> str:
    """Append page and font-size overrides for consistent output size."""
    return (
        f"{css_text}\n\n"
        f"@page {{ margin: {page_margin}; }}\n"
        f"body {{ font-size: {font_size}; }}\n"
    )


def normalize_latex_font_size(font_size: str) -> str:
    """Normalize LaTeX font size to a value accepted by Pandoc templates."""
    trimmed = font_size.strip()
    if re.fullmatch(r"\d+(\.\d+)?", trimmed):
        return f"{trimmed}pt"
    return trimmed


def render_html_to_pdf(html_text: str, output_path: Path, base_url: str) -> None:
    """Render HTML content into a PDF file using WeasyPrint."""
    try:
        from weasyprint import HTML
    except OSError as exc:
        if sys.platform.startswith("win"):
            raise RuntimeError(
                "WeasyPrint native GTK/Pango libraries are missing. "
                "Install MSYS2 libraries (pango, glib2, cairo, gdk-pixbuf2, libffi), "
                "then set WEASYPRINT_DLL_DIRECTORIES "
                "(for example: C:\\msys64\\mingw64\\bin)."
            ) from exc
        raise RuntimeError(
            "WeasyPrint native libraries are missing on this system. "
            "Install OS-level dependencies required by WeasyPrint."
        ) from exc

    output_path.parent.mkdir(parents=True, exist_ok=True)
    HTML(string=html_text, base_url=base_url).write_pdf(str(output_path))


def render_markdown_to_pdf_with_pandoc(
    input_path: Path,
    output_path: Path,
    css_path: Optional[Path],
    pdf_engine: str,
    page_margin: str,
    font_size: str,
    latex_font_size: str,
) -> None:
    """Render Markdown directly to PDF using Pandoc."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    pandoc_executable = resolve_pandoc_executable()

    command: list[str] = [
        pandoc_executable,
        str(input_path),
        "-o",
        str(output_path),
        "--standalone",
        "--from",
        "markdown+tex_math_dollars+tex_math_single_backslash+fenced_code_blocks+pipe_tables+footnotes",
        "--resource-path",
        f"{input_path.parent}{os.pathsep}.",
        "--syntax-highlighting",
        "pygments",
        "--pdf-engine",
        pdf_engine,
    ]

    css_compatible_engines = {"weasyprint", "wkhtmltopdf", "prince", "pagedjs-cli"}
    latex_engines = {"xelatex", "lualatex", "pdflatex", "latexmk", "tectonic"}

    if pdf_engine in latex_engines:
        command.extend(["-V", f"geometry:margin={page_margin}"])
        command.extend(["-V", f"fontsize={normalize_latex_font_size(latex_font_size)}"])
        if css_path is not None:
            LOGGER.warning(
                "Custom CSS is ignored for Pandoc PDF engine '%s'. "
                "Use --pdf-engine weasyprint to apply CSS directly.",
                pdf_engine,
            )
        run_subprocess(command, cwd=input_path.parent)
        return

    if pdf_engine in css_compatible_engines:
        with tempfile.TemporaryDirectory() as temp_dir_str:
            temp_dir = Path(temp_dir_str)
            margin_css_file = temp_dir / "page_margin.css"
            margin_css_file.write_text(
                f"@page {{ margin: {page_margin}; }}\nbody {{ font-size: {font_size}; }}\n",
                encoding="utf-8",
            )

            if css_path is not None:
                command.extend(["--css", str(css_path)])
            command.extend(["--css", str(margin_css_file)])
            run_subprocess(command, cwd=input_path.parent)
        return

    LOGGER.warning(
        "Page margin override may not be supported for Pandoc engine '%s'.",
        pdf_engine,
    )
    if css_path is not None:
        LOGGER.warning(
            "Custom CSS is ignored for Pandoc PDF engine '%s'. "
            "Use --pdf-engine weasyprint to apply CSS directly.",
            pdf_engine,
        )
    run_subprocess(command, cwd=input_path.parent)


def find_generated_markdown(marker_output_dir: Path, input_stem: str) -> Path:
    """Find markdown output produced by Marker."""
    preferred = marker_output_dir / f"{input_stem}.md"
    if preferred.exists():
        return preferred

    candidates = sorted(marker_output_dir.rglob("*.md"))
    if not candidates:
        raise RuntimeError("Marker did not produce any Markdown file.")

    for candidate in candidates:
        if candidate.stem == input_stem:
            return candidate

    LOGGER.warning(
        "Marker output file name did not match input stem. Using '%s'.",
        candidates[0].name,
    )
    return candidates[0]


def rewrite_markdown_links(markdown_text: str, replacements: dict[str, str]) -> str:
    """Rewrite Markdown link targets based on replacement map."""
    pattern = re.compile(r"(!?\[[^\]]*\]\()([^\)]+)(\))")

    def _replace(match: re.Match[str]) -> str:
        prefix = match.group(1)
        destination = match.group(2)
        suffix = match.group(3)

        path_part, separator, trailing = destination.partition(" ")
        normalized = path_part.strip()

        replacement = replacements.get(normalized)
        if replacement is None and normalized.startswith("./"):
            replacement = replacements.get(normalized[2:])

        if replacement is None:
            return match.group(0)

        updated_target = replacement if not separator else f"{replacement}{separator}{trailing}"
        return f"{prefix}{updated_target}{suffix}"

    return pattern.sub(_replace, markdown_text)


def normalize_markdown_with_pandoc(markdown_text: str, working_dir: Path) -> str:
    """Normalize markdown using Pandoc while preserving LaTeX math syntax."""
    pandoc_executable = resolve_pandoc_executable()

    with tempfile.TemporaryDirectory() as temp_dir_str:
        temp_dir = Path(temp_dir_str)
        source_file = temp_dir / "input.md"
        output_file = temp_dir / "output.md"
        source_file.write_text(markdown_text, encoding="utf-8")

        command = [
            pandoc_executable,
            str(source_file),
            "--from",
            "markdown+tex_math_dollars+tex_math_single_backslash+pipe_tables+footnotes",
            "--to",
            "gfm+tex_math_dollars+pipe_tables+footnotes",
            "--wrap",
            "none",
            "--output",
            str(output_file),
        ]

        run_subprocess(command, cwd=working_dir)
        return output_file.read_text(encoding="utf-8")


def render_pdf_to_markdown_with_marker(
    input_path: Path,
    output_path: Path,
    images_dir: Optional[Path],
    device: str,
    gpu_index: int,
    force_ocr: bool,
    use_llm: bool,
    normalize_with_pandoc: bool,
) -> None:
    """Render PDF to Markdown using Marker and extract images."""
    marker_executable = resolve_marker_executable()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as temp_dir_str:
        temp_dir = Path(temp_dir_str)

        command = [
            marker_executable,
            str(input_path),
            "--output_format",
            "markdown",
            "--output_dir",
            str(temp_dir),
        ]
        if force_ocr:
            command.append("--force_ocr")
        if use_llm:
            command.append("--use_llm")

        run_subprocess(
            command,
            cwd=input_path.parent,
            extra_env=build_marker_runtime_env(device=device, gpu_index=gpu_index),
        )

        generated_md = find_generated_markdown(temp_dir, input_path.stem)
        markdown_text = generated_md.read_text(encoding="utf-8")

        target_image_root = images_dir.resolve() if images_dir else output_path.parent
        replacements: dict[str, str] = {}

        for asset in temp_dir.rglob("*"):
            if not asset.is_file() or asset.suffix.lower() not in IMAGE_EXTENSIONS:
                continue

            source_rel = asset.relative_to(generated_md.parent).as_posix()
            destination = (target_image_root / source_rel).resolve()
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(asset, destination)

            new_rel = Path(os.path.relpath(destination, output_path.parent)).as_posix()
            if new_rel != source_rel:
                replacements[source_rel] = new_rel
                replacements[f"./{source_rel}"] = new_rel

        if replacements:
            markdown_text = rewrite_markdown_links(markdown_text, replacements)

        if normalize_with_pandoc:
            markdown_text = normalize_markdown_with_pandoc(markdown_text, output_path.parent)

        output_path.write_text(markdown_text, encoding="utf-8")


def resolve_pandoc_executable() -> str:
    """Locate Pandoc executable across common installation locations."""
    from_path = shutil.which("pandoc")
    if from_path:
        return from_path

    if sys.platform.startswith("win"):
        windows_candidates = [
            Path(os.environ.get("LOCALAPPDATA", "")) / "Pandoc" / "pandoc.exe",
            Path(r"C:\Program Files\Pandoc\pandoc.exe"),
            Path(r"C:\Program Files (x86)\Pandoc\pandoc.exe"),
        ]
        for candidate in windows_candidates:
            if candidate.exists():
                return str(candidate)

    raise RuntimeError(
        "Pandoc executable not found. Install Pandoc and ensure 'pandoc' is in PATH."
    )


def resolve_marker_executable() -> str:
    """Locate Marker CLI executable (`marker_single`)."""
    from_path = shutil.which("marker_single")
    if from_path:
        return from_path

    script_dir = Path(sys.executable).resolve().parent
    script_candidate = script_dir / "marker_single.exe"
    if script_candidate.exists():
        return str(script_candidate)

    if sys.platform.startswith("win"):
        local_app_data = Path(os.environ.get("LOCALAPPDATA", ""))
        roaming_app_data = Path(os.environ.get("APPDATA", ""))
        windows_candidates = [
            local_app_data / "Programs" / "Python",
            roaming_app_data / "Python",
        ]

        for base in windows_candidates:
            if not base.exists():
                continue
            for candidate in base.rglob("marker_single.exe"):
                return str(candidate)

    raise RuntimeError(
        "Marker executable not found. Install Marker (`pip install marker-pdf`) "
        "and ensure `marker_single` is available in PATH."
    )


def build_tool_environment() -> dict[str, str]:
    """Build subprocess environment with common Windows tool paths."""
    env = os.environ.copy()
    path_entries = [entry for entry in env.get("PATH", "").split(os.pathsep) if entry]

    candidate_dirs: list[Path] = []
    local_app_data = os.environ.get("LOCALAPPDATA", "")
    program_files = os.environ.get("ProgramFiles", r"C:\Program Files")

    if sys.platform.startswith("win"):
        candidate_dirs.extend(
            [
                Path(local_app_data) / "Pandoc",
                Path(program_files) / "Pandoc",
                Path(local_app_data)
                / "Programs"
                / "MiKTeX"
                / "miktex"
                / "bin"
                / "x64",
                Path(program_files) / "MiKTeX" / "miktex" / "bin" / "x64",
                Path(sys.executable).resolve().parent,
            ]
        )

    for candidate in candidate_dirs:
        if candidate.exists():
            candidate_str = str(candidate)
            if candidate_str not in path_entries:
                path_entries.insert(0, candidate_str)

    env["PATH"] = os.pathsep.join(path_entries)
    return env


def build_marker_runtime_env(device: str, gpu_index: int) -> dict[str, str]:
    """Build Marker-specific runtime env variables for device selection."""
    env: dict[str, str] = {}
    if device == "auto":
        return env
    if device == "cuda":
        env["TORCH_DEVICE"] = "cuda"
        env["CUDA_VISIBLE_DEVICES"] = str(gpu_index)
        return env
    env["TORCH_DEVICE"] = device
    return env


def validate_pdf2md_device(device: str, gpu_index: int) -> None:
    """Validate requested Marker device and log practical runtime info."""
    if gpu_index < 0:
        raise RuntimeError("--gpu-index must be >= 0.")

    try:
        import torch
    except Exception:  # noqa: BLE001
        LOGGER.warning("PyTorch not importable for device validation. Marker will decide device.")
        return

    cuda_available = torch.cuda.is_available()
    cuda_count = torch.cuda.device_count() if cuda_available else 0

    if device == "cuda":
        if not cuda_available:
            raise RuntimeError(
                "CUDA requested but not available in current PyTorch build/runtime. "
                "Install a CUDA-enabled PyTorch build and NVIDIA drivers."
            )
        if gpu_index >= cuda_count:
            raise RuntimeError(
                f"--gpu-index {gpu_index} is out of range. Available CUDA devices: {cuda_count}."
            )
        LOGGER.info("Using CUDA device %s for Marker.", gpu_index)
        return

    if device == "auto":
        if cuda_available:
            LOGGER.info("CUDA is available. Marker should use GPU automatically.")
        else:
            LOGGER.warning(
                "CUDA not available; Marker will run on CPU. "
                "For GPU, install CUDA-enabled PyTorch."
            )
        return

    LOGGER.info("Using '%s' device for Marker.", device)


def run_subprocess(command: list[str], cwd: Path, extra_env: Optional[dict[str, str]] = None) -> None:
    """Run a subprocess command and raise user-friendly errors on failure."""
    env = build_tool_environment()
    if extra_env:
        env.update(extra_env)

    try:
        completed = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            cwd=str(cwd),
            env=env,
        )
        if completed.stderr.strip():
            LOGGER.debug("Command stderr: %s", completed.stderr.strip())
    except FileNotFoundError as exc:
        raise RuntimeError(f"Required executable not found: {command[0]}") from exc
    except subprocess.CalledProcessError as exc:
        details = (exc.stderr or exc.stdout or "").strip()
        message = f"Command failed: {' '.join(command)}"
        if details:
            message = f"{message}. Details: {details}"
        raise RuntimeError(message) from exc


def main() -> int:
    """CLI entry point."""
    try:
        args = parse_arguments()
        if not args.input:
            args = collect_interactive_arguments()
        configure_logging(args.log_level)

        input_path = Path(args.input).expanduser().resolve()
        css_path = Path(args.css).expanduser().resolve() if args.css else None
        images_dir = Path(args.images_dir).expanduser().resolve() if args.images_dir else None

        validate_input_file(input_path)
        mode = resolve_mode(input_path, args.mode)
        warn_unexpected_extension(input_path, mode)

        if mode == "md2pdf":
            output_path = resolve_output_path(input_path, args.output, ".pdf").expanduser().resolve()

            if css_path is not None and not css_path.exists():
                raise FileNotFoundError(f"CSS file not found: {css_path}")

            if args.backend == "pandoc":
                render_markdown_to_pdf_with_pandoc(
                    input_path=input_path,
                    output_path=output_path,
                    css_path=css_path,
                    pdf_engine=args.pdf_engine,
                    page_margin=args.page_margin,
                    font_size=args.font_size,
                    latex_font_size=args.latex_font_size,
                )
            else:
                markdown_text = input_path.read_text(encoding="utf-8")
                css_text = apply_css_overrides(
                    load_css(css_path), args.page_margin, args.font_size
                )
                body_html = convert_md_to_html(markdown_text)
                html_document = build_html_document(body_html, css_text, input_path.stem)

                render_html_to_pdf(
                    html_text=html_document,
                    output_path=output_path,
                    base_url=str(input_path.parent),
                )

            LOGGER.info("PDF generated successfully: %s", output_path)
            return 0

        output_path = resolve_output_path(input_path, args.output, ".md").expanduser().resolve()

        if css_path is not None:
            LOGGER.warning("--css is ignored in pdf2md mode.")
        if args.backend != "pandoc":
            LOGGER.warning("--backend is ignored in pdf2md mode.")
        if args.pdf_engine != "xelatex":
            LOGGER.warning("--pdf-engine is ignored in pdf2md mode.")
        if args.page_margin != DEFAULT_PAGE_MARGIN:
            LOGGER.warning("--page-margin is ignored in pdf2md mode.")
        if args.font_size != DEFAULT_FONT_SIZE:
            LOGGER.warning("--font-size is ignored in pdf2md mode.")
        if args.latex_font_size != DEFAULT_LATEX_FONT_SIZE:
            LOGGER.warning("--latex-font-size is ignored in pdf2md mode.")
        validate_pdf2md_device(args.device, args.gpu_index)

        render_pdf_to_markdown_with_marker(
            input_path=input_path,
            output_path=output_path,
            images_dir=images_dir,
            device=args.device,
            gpu_index=args.gpu_index,
            force_ocr=args.force_ocr,
            use_llm=args.use_llm,
            normalize_with_pandoc=not args.skip_pandoc_clean,
        )
        LOGGER.info("Markdown generated successfully: %s", output_path)
        return 0

    except FileNotFoundError as exc:
        LOGGER.error("%s", exc)
        return 1
    except PermissionError as exc:
        LOGGER.error("Permission error: %s", exc)
        return 1
    except IsADirectoryError as exc:
        LOGGER.error("Invalid input path: %s", exc)
        return 1
    except OSError as exc:
        LOGGER.error("Filesystem error: %s", exc)
        return 1
    except RuntimeError as exc:
        LOGGER.error("%s", exc)
        return 1
    except Exception as exc:  # noqa: BLE001
        LOGGER.exception("Unexpected error during conversion: %s", exc)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
