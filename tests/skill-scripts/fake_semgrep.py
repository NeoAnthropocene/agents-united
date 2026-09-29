"""Stand-in for `semgrep` used by test_run_scans.py (set SEMGREP_BIN="python fake_semgrep.py").

Behaviour is chosen by the --config value: contains "boom" -> exit 7 with nothing written;
"partial" -> exit 2 with full output; "empty" -> exit 0 covering no files; "garbage" -> exit 0 with
invalid JSON; anything else -> exit 0 with one finding and one scanned file. Every invocation is
appended to $FAKE_SEMGREP_LOG so tests can assert on the exact command line.
"""
import json
import os
import sys

args = sys.argv[1:]
log = os.environ.get("FAKE_SEMGREP_LOG")
if log:
    with open(log, "a", encoding="utf-8") as fh:
        fh.write(json.dumps(args) + "\n")

config = args[args.index("--config") + 1] if "--config" in args else ""
json_out = args[args.index("-o") + 1] if "-o" in args else None
sarif_out = next((a.split("=", 1)[1] for a in args if a.startswith("--sarif-output=")), None)

if "boom" in config:
    print("config would not load", file=sys.stderr)
    sys.exit(7)

body = {"results": [{"check_id": "x"}], "paths": {"scanned": ["a.py"]}}
rc = 0
if "empty" in config:
    body = {"results": [], "paths": {"scanned": []}}
if "partial" in config:
    rc = 2
if json_out:
    with open(json_out, "w", encoding="utf-8") as fh:
        fh.write("not json" if "garbage" in config else json.dumps(body))
if sarif_out:
    with open(sarif_out, "w", encoding="utf-8") as fh:
        fh.write(json.dumps({"version": "2.1.0", "runs": []}))
sys.exit(rc)
