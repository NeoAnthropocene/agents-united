#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Write the CodeQL query suite for one scan mode and prove it resolves to at least one query.

Cross-platform Python port of upstream's `scripts/generate_suite.sh` (Trail of Bits,
CC-BY-SA-4.0; see ../NOTICE.md).

    python generate_suite.py run-all|important-only [--lang LANG] [--output-dir DIR] [--packs "a/b c/d"]

Falls back to the CODEQL_LANG, OUTPUT_DIR and INSTALLED_THIRD_PARTY_PACKS environment variables
that the upstream script read. Writes <output-dir>/raw/<mode>.qls, then runs verify_query_suite.py
on it; an unverified suite is deleted, because left on disk it is indistinguishable from a good
one and the analysis step derives the same path.
"""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path


def build_suite(mode: str, lang: str, packs: list[str]) -> str:
    if mode == "run-all":
        parts = [
            "- description: Run-all — the security-and-quality and security-experimental suites "
            "from all installed packs, not every query in them; see run-all-suite.md\n"
            f"- import: codeql-suites/{lang}-security-and-quality.qls\n"
            f"  from: codeql/{lang}-queries\n"
            f"- import: codeql-suites/{lang}-security-experimental.qls\n"
            f"  from: codeql/{lang}-queries\n"
        ]
    else:
        parts = [
            "- description: Important-only — security vulnerabilities, medium-high confidence\n"
            "- queries: .\n"
            f"  from: codeql/{lang}-queries\n"
        ]
    for pack in packs:
        parts.append(f"- queries: .\n  from: {pack}\n")

    if mode == "run-all":
        # Minimal filtering: alert queries and nothing else.
        parts.append("- include:\n    kind:\n      - problem\n      - path-problem\n")
    else:
        # Security tag required. High and very-high run at any severity; medium is narrowed
        # after the run by the security-severity filter in run-analysis.
        parts.append(
            "- include:\n    kind:\n      - problem\n      - path-problem\n"
            "    precision:\n      - high\n      - very-high\n"
            "    tags contain:\n      - security\n"
            "- include:\n    kind:\n      - problem\n      - path-problem\n"
            "    precision:\n      - medium\n"
            "    tags contain:\n      - security\n"
        )
    parts.append(
        "- exclude:\n    deprecated: //\n"
        "- exclude:\n    tags contain:\n      - modeleditor\n      - modelgenerator\n"
    )
    return "".join(parts)


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("mode", choices=["run-all", "important-only"])
    ap.add_argument("--lang", default=os.environ.get("CODEQL_LANG", ""))
    ap.add_argument("--output-dir", default=os.environ.get("OUTPUT_DIR", ""))
    ap.add_argument("--packs", default=os.environ.get("INSTALLED_THIRD_PARTY_PACKS", ""))
    args = ap.parse_args(argv)

    # Checked before anything is written: an unset language would name the pack `codeql/-queries`
    # and leave a broken suite on disk for a later step to pick up.
    if not args.lang:
        print("ERROR: --lang (or CODEQL_LANG) must be set before generating the suite", file=sys.stderr)
        return 2
    if not args.output_dir:
        print("ERROR: --output-dir (or OUTPUT_DIR) must be set", file=sys.stderr)
        return 2

    raw_dir = Path(args.output_dir) / "raw"
    raw_dir.mkdir(parents=True, exist_ok=True)
    suite = raw_dir / f"{args.mode}.qls"
    suite.write_text(build_suite(args.mode, args.lang, args.packs.split()), encoding="utf-8")

    verifier = Path(__file__).resolve().parent / "verify_query_suite.py"
    if subprocess.run([sys.executable, str(verifier), str(suite)]).returncode != 0:
        suite.unlink(missing_ok=True)
        print(f"Removed {suite}: it did not resolve to any queries.", file=sys.stderr)
        return 1

    print(f"Suite generated: {suite}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
