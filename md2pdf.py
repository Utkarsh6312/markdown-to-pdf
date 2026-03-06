"""Convert Markdown files to PDF."""

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

import markdown

LOGGER = logging.getLogger("md2pdf")
DEFAULT_PAGE_MARGIN = "0.45in"
DEFAULT_FONT_SIZE = "12.5pt"
DEFAULT_LATEX_FONT_SIZE = "12pt"
FALLBACK_CSS = """
@page { size: A4; margin: 0.45in; }
body { font-family: "Segoe UI", Arial, sans-serif; line-height: 1.6; color: #1f2937; }
img { max-width: 100%; height: auto; }
pre, code { font-family: Consolas, monospace; }
""".strip()


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=getattr(logging, level.upper(), logging.INFO),
        format="%(levelname)s: %(message)s",
    )


def prompt(prompt_text: str, default: str | None = None, choices: list[str] | None = None) -> str | None:
    while True:
        try:
            raw = input(prompt_text).strip()
        except EOFError as exc:
            raise RuntimeError("Interactive input was interrupted.") from exc
        if not raw:
            return default
        if choices is None:
            return raw
        lowered = raw.lower()
        mapping = {choice.lower(): choice for choice in choices}
        if lowered in mapping:
            return mapping[lowered]
        print(f"Invalid choice. Pick one of: {', '.join(choices)}")


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Convert Markdown to PDF.")
    parser.add_argument("-i", "--input", help="Path to source Markdown file (.md or .markdown).")
    parser.add_argument("-o", "--output", help="Destination PDF output file path. Defaults to input.pdf.")
    parser.add_argument("-c", "--css", help="Optional CSS path for HTML/CSS-capable PDF engines.")
    parser.add_argument("--backend", default="pandoc", choices=["pandoc", "weasyprint"])
    parser.add_argument("--pdf-engine", default="xelatex")
    parser.add_argument("--page-margin", default=DEFAULT_PAGE_MARGIN)
    parser.add_argument("--font-size", default=DEFAULT_FONT_SIZE)
    parser.add_argument("--latex-font-size", default=DEFAULT_LATEX_FONT_SIZE)
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
    )
    args = parser.parse_args()
    if args.input:
        return args
    if not sys.stdin.isatty():
        raise RuntimeError("Missing --input and interactive input is unavailable.")

    print("Interactive mode: Markdown to PDF converter")
    args.input = prompt("Input file path: ")
    while not args.input:
        print("Value is required.")
        args.input = prompt("Input file path: ")
    args.output = prompt("Output path (leave blank for default): ")
    args.log_level = prompt(
        "Log level (DEBUG/INFO/WARNING/ERROR/CRITICAL) [default: INFO]: ",
        "INFO",
        ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
    )
    args.backend = prompt(
        "Backend (pandoc/weasyprint) [default: pandoc]: ",
        "pandoc",
        ["pandoc", "weasyprint"],
    )
    args.css = prompt("CSS path (optional): ")
    args.pdf_engine = "xelatex"
    if args.backend == "pandoc":
        args.pdf_engine = prompt("Pandoc PDF engine [default: xelatex]: ", "xelatex") or "xelatex"
        args.latex_font_size = (
            prompt(
                f"LaTeX font size [default: {DEFAULT_LATEX_FONT_SIZE}]: ",
                DEFAULT_LATEX_FONT_SIZE,
            )
            or DEFAULT_LATEX_FONT_SIZE
        )
    args.font_size = prompt(f"Base font size [default: {DEFAULT_FONT_SIZE}]: ", DEFAULT_FONT_SIZE) or DEFAULT_FONT_SIZE
    args.page_margin = (
        prompt(
            f"Page margin (example: 0.4in, 12mm) [default: {DEFAULT_PAGE_MARGIN}]: ",
            DEFAULT_PAGE_MARGIN,
        )
        or DEFAULT_PAGE_MARGIN
    )
    return args


def resolve_paths(args: argparse.Namespace) -> tuple[Path, Path, Path | None]:
    input_path = Path(args.input).expanduser().resolve()
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")
    if input_path.is_dir():
        raise IsADirectoryError(f"Input path is a directory: {input_path}")
    if input_path.suffix.lower() not in {".md", ".markdown"}:
        raise RuntimeError(
            f"Unsupported input extension '{input_path.suffix}'. Use .md or .markdown."
        )
    output_path = Path(args.output).expanduser() if args.output else input_path.with_suffix(".pdf")
    css_path = Path(args.css).expanduser().resolve() if args.css else None
    if css_path and not css_path.exists():
        raise FileNotFoundError(f"CSS file not found: {css_path}")
    return input_path, output_path.resolve(), css_path


def tool_env() -> dict[str, str]:
    env = os.environ.copy()
    if not sys.platform.startswith("win"):
        return env
    path_entries = [entry for entry in env.get("PATH", "").split(os.pathsep) if entry]
    candidates = [
        Path(os.environ.get("LOCALAPPDATA", "")) / "Pandoc",
        Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Pandoc",
        Path(os.environ.get("LOCALAPPDATA", "")) / "Programs" / "MiKTeX" / "miktex" / "bin" / "x64",
        Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "MiKTeX" / "miktex" / "bin" / "x64",
        Path(sys.executable).resolve().parent,
    ]
    for candidate in candidates:
        candidate_str = str(candidate)
        if candidate.exists() and candidate_str not in path_entries:
            path_entries.insert(0, candidate_str)
    env["PATH"] = os.pathsep.join(path_entries)
    return env


def run(command: list[str], cwd: Path) -> None:
    try:
        completed = subprocess.run(
            command,
            check=True,
            capture_output=True,
            text=True,
            cwd=str(cwd),
            env=tool_env(),
        )
    except FileNotFoundError as exc:
        raise RuntimeError(f"Required executable not found: {command[0]}") from exc
    except subprocess.CalledProcessError as exc:
        details = (exc.stderr or exc.stdout or "").strip()
        raise RuntimeError(
            f"Command failed: {' '.join(command)}" + (f". Details: {details}" if details else "")
        ) from exc
    if completed.stderr.strip():
        LOGGER.debug("Command stderr: %s", completed.stderr.strip())


def resolve_pandoc() -> str:
    pandoc = shutil.which("pandoc")
    if pandoc:
        return pandoc
    for candidate in (
        Path(os.environ.get("LOCALAPPDATA", "")) / "Pandoc" / "pandoc.exe",
        Path(r"C:\Program Files\Pandoc\pandoc.exe"),
        Path(r"C:\Program Files (x86)\Pandoc\pandoc.exe"),
    ):
        if candidate.exists():
            return str(candidate)
    raise RuntimeError("Pandoc executable not found. Install Pandoc and ensure it is in PATH.")


def load_css(css_path: Path | None) -> str:
    if css_path:
        return css_path.read_text(encoding="utf-8")
    default_css_path = Path(__file__).with_name("style.css")
    if default_css_path.exists():
        return default_css_path.read_text(encoding="utf-8")
    LOGGER.info("style.css not found. Using built-in fallback styling.")
    return FALLBACK_CSS


def css_with_overrides(css_text: str, page_margin: str, font_size: str) -> str:
    return f"{css_text}\n\n@page {{ margin: {page_margin}; }}\nbody {{ font-size: {font_size}; }}\n"


def render_with_weasyprint(input_path: Path, output_path: Path, css_path: Path | None, args: argparse.Namespace) -> None:
    try:
        from weasyprint import HTML
    except ModuleNotFoundError as exc:
        raise RuntimeError("WeasyPrint is not installed. Run `pip install WeasyPrint`.") from exc
    except OSError as exc:
        if sys.platform.startswith("win"):
            raise RuntimeError(
                "WeasyPrint native GTK/Pango libraries are missing. "
                "Set WEASYPRINT_DLL_DIRECTORIES after installing the required runtime libraries."
            ) from exc
        raise RuntimeError("WeasyPrint native libraries are missing on this system.") from exc

    html_body = markdown.markdown(
        input_path.read_text(encoding="utf-8"),
        extensions=["extra", "fenced_code", "tables", "footnotes", "codehilite"],
        extension_configs={"codehilite": {"guess_lang": False, "noclasses": True, "pygments_style": "friendly"}},
        output_format="html5",
    )
    html = (
        "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">"
        f"<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"><title>{input_path.stem}</title>"
        f"<style>{css_with_overrides(load_css(css_path), args.page_margin, args.font_size)}</style>"
        f"</head><body>{html_body}</body></html>"
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    HTML(string=html, base_url=str(input_path.parent)).write_pdf(str(output_path))


def normalize_latex_font_size(value: str) -> str:
    return f"{value.strip()}pt" if re.fullmatch(r"\d+(\.\d+)?", value.strip()) else value.strip()


def render_with_pandoc(input_path: Path, output_path: Path, css_path: Path | None, args: argparse.Namespace) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    command = [
        resolve_pandoc(),
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
        args.pdf_engine,
    ]
    latex_engines = {"xelatex", "lualatex", "pdflatex", "latexmk", "tectonic"}
    css_engines = {"weasyprint", "wkhtmltopdf", "prince", "pagedjs-cli"}

    if args.pdf_engine in latex_engines:
        command += ["-V", f"geometry:margin={args.page_margin}", "-V", f"fontsize={normalize_latex_font_size(args.latex_font_size)}"]
        if css_path:
            LOGGER.warning("Custom CSS is ignored for Pandoc engine '%s'.", args.pdf_engine)
        run(command, input_path.parent)
        return

    if args.pdf_engine in css_engines:
        with tempfile.TemporaryDirectory() as temp_dir:
            margin_css = Path(temp_dir) / "page_margin.css"
            margin_css.write_text(
                f"@page {{ margin: {args.page_margin}; }}\nbody {{ font-size: {args.font_size}; }}\n",
                encoding="utf-8",
            )
            if css_path:
                command += ["--css", str(css_path)]
            command += ["--css", str(margin_css)]
            run(command, input_path.parent)
        return

    if css_path:
        LOGGER.warning("Custom CSS is ignored for Pandoc engine '%s'.", args.pdf_engine)
    run(command, input_path.parent)


def main() -> int:
    try:
        args = parse_arguments()
        configure_logging(args.log_level)
        input_path, output_path, css_path = resolve_paths(args)
        if args.backend == "pandoc":
            render_with_pandoc(input_path, output_path, css_path, args)
        else:
            render_with_weasyprint(input_path, output_path, css_path, args)
        LOGGER.info("PDF generated successfully: %s", output_path)
        return 0
    except Exception as exc:  # noqa: BLE001
        LOGGER.error("%s", exc)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
