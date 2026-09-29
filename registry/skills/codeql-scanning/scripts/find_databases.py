#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Print every real CodeQL database under the given roots, one path per line.

Cross-platform Python port of upstream's `scripts/find_databases.sh` (Trail of Bits,
CC-BY-SA-4.0; see ../NOTICE.md).

    python find_databases.py [root ...]     # defaults to $OUTPUT_DIR then "."

`codeql resolve database` is the filter that matters: the codeql-database.yml marker is written
before the build finishes, so a failed build leaves one a bare search would take.

Exit 2 when codeql is not on PATH. Without it the filter rejects everything and the script would
exit 0 having printed nothing, which reads as "no databases" and sends the caller off to rebuild
three good databases. Set CODEQL_BIN to override the executable (split shell-style).
"""

from __future__ import annotations

import os
import shlex
import shutil
import subprocess
import sys
from pathlib import Path

MARKER = "codeql-database.yml"
MAX_DEPTH = 3


def split_command(value: str, posix: bool | None = None) -> list[str]:
    # Windows needs non-POSIX splitting so backslashes in paths survive; that mode keeps the
    # quotes around a token, so strip them.
    parts = shlex.split(value, posix=(os.name != "nt") if posix is None else posix)
    return [p[1:-1] if len(p) >= 2 and p[0] == p[-1] and p[0] in "\"'" else p for p in parts]


def codeql_bin() -> list[str]:
    return split_command(os.environ.get("CODEQL_BIN", "codeql"))


def find_markers(root: Path) -> list[Path]:
    """Marker files at depth <= MAX_DEPTH below root, pruning dotted directories by name.

    Pruned by directory name rather than by matching the whole path, so a project anywhere under
    ~/.cache or a dotted checkout is still searched. The root itself may legitimately be dotted.
    """
    found: list[Path] = []
    root_depth = len(root.parts)
    for dirpath, dirnames, filenames in os.walk(root):
        depth = len(Path(dirpath).parts) - root_depth
        dirnames[:] = [d for d in dirnames if not d.startswith(".")] if depth < MAX_DEPTH - 1 else []
        if MARKER in filenames and depth + 1 <= MAX_DEPTH:
            found.append(Path(dirpath) / MARKER)
    return sorted(found)


def main(argv: list[str]) -> int:
    cq = codeql_bin()
    if shutil.which(cq[0]) is None:
        print(
            "ERROR: codeql not found on PATH — cannot tell a database from the marker a failed build leaves.",
            file=sys.stderr,
        )
        return 2

    roots = argv or [os.environ.get("OUTPUT_DIR", "."), "."]
    seen: set[str] = set()
    for root in roots:
        if not os.path.isdir(root):
            continue
        # Absolute physical path first: $OUTPUT_DIR is usually inside ".", so searched as written
        # one database would surface twice under two spellings and defeat the dedup.
        resolved = Path(os.path.realpath(root))
        for marker in find_markers(resolved):
            db = str(marker.parent)
            if db in seen:
                continue
            probe = subprocess.run(cq + ["resolve", "database", "--", db], capture_output=True)
            if probe.returncode == 0:
                seen.add(db)
                print(db)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
