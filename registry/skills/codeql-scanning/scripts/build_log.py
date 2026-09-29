#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Build-log helper for the CodeQL build-database workflow.

Cross-platform Python replacement for upstream's sourced `scripts/build_log.sh` helpers
(`log_step`, `log_cmd`, `log_result`, `run_logged`; Trail of Bits, CC-BY-SA-4.0; see ../NOTICE.md).
A sourced shell library does not exist on Windows PowerShell, so each helper is a subcommand:

    python build_log.py step   "Applying fix: clean build cache"
    python build_log.py cmd    "codeql database create ..."
    python build_log.py result "Build succeeded"
    python build_log.py run    -- pip install -r requirements.txt     # logs, tees, keeps exit code

The log path is $LOG_FILE, else $OUTPUT_DIR/build.log, else ./build.log. An unwritable log fails
loudly with exit 1 while the cause is legible: otherwise every build method reports failure and
the ladder walks down to --build-mode=none after a build that succeeded.
"""

from __future__ import annotations

import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path


def log_path() -> Path:
    return Path(os.environ.get("LOG_FILE") or Path(os.environ.get("OUTPUT_DIR", ".")) / "build.log")


def stamp() -> str:
    return datetime.now().astimezone().isoformat(timespec="seconds")


def append(path: Path, text: str) -> None:
    with open(path, "a", encoding="utf-8") as fh:
        fh.write(text)


def main(argv: list[str]) -> int:
    if not argv or argv[0] not in ("step", "cmd", "result", "run"):
        print(__doc__, file=sys.stderr)
        return 2
    path = log_path()
    try:
        append(path, "")
    except OSError:
        print(f"ERROR: cannot write build log {path}.", file=sys.stderr)
        print('  Usually $OUTPUT_DIR was never created: create the directory first.', file=sys.stderr)
        print("  Otherwise set LOG_FILE or OUTPUT_DIR to a writable path.", file=sys.stderr)
        return 1

    sub, rest = argv[0], argv[1:]
    if sub == "step":
        append(path, f"[{stamp()}] {' '.join(rest)}\n")
        return 0
    if sub == "cmd":
        append(path, f"[{stamp()}] COMMAND: {' '.join(rest)}\n")
        return 0
    if sub == "result":
        append(path, f"[{stamp()}] RESULT: {' '.join(rest)}\n\n")
        return 0

    # run: arguments as a list, so a path containing a space is not word-split.
    command = rest[1:] if rest[:1] == ["--"] else rest
    if not command:
        print("build_log.py run: no command given", file=sys.stderr)
        return 2
    append(path, f"[{stamp()}] COMMAND: {subprocess.list2cmdline(command)}\n")
    try:
        proc = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    except OSError as exc:
        message = f"{command[0]}: {exc}\n"
        sys.stdout.write(message)
        append(path, message)
        return 127
    with open(path, "ab") as fh:
        assert proc.stdout is not None
        for chunk in iter(lambda: proc.stdout.readline(), b""):
            sys.stdout.buffer.write(chunk)
            sys.stdout.buffer.flush()
            fh.write(chunk)
    return proc.wait()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
