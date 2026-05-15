from __future__ import annotations

import argparse
import sys
from pathlib import Path

from rich.console import Console

from .pipeline import parse_dir, parse_file
from .settings import load_settings

console = Console()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Resume parsing and intelligence extraction")
    subparsers = parser.add_subparsers(dest="command", required=True)

    parse_file_parser = subparsers.add_parser("parse-file")
    parse_file_parser.add_argument("path", type=Path)
    parse_file_parser.add_argument("--output", type=Path, default=Path("data/output"))
    parse_file_parser.add_argument("--work", type=Path, default=Path("data/work"))

    parse_dir_parser = subparsers.add_parser("parse-dir")
    parse_dir_parser.add_argument("input", type=Path)
    parse_dir_parser.add_argument("--output", type=Path, default=Path("data/output"))
    parse_dir_parser.add_argument("--work", type=Path, default=Path("data/work"))

    args = parser.parse_args(argv)
    settings = load_settings()

    try:
        if args.command == "parse-file":
            record = parse_file(args.path, args.output, args.work, settings)
            console.print_json(data=record)
            return 0
        if args.command == "parse-dir":
            records = parse_dir(args.input, args.output, args.work, settings)
            console.print(f"Parsed {len(records)} resumes into {args.output}")
            return 0
    except Exception as exc:
        console.print(f"[red]error:[/red] {exc}")
        return 1

    return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

