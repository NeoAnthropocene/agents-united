"""Stand-in for `codeql` used by test_codeql_scripts.py (set CODEQL_BIN="python fake_codeql.py").

`resolve database -- DIR` succeeds unless DIR's name contains "broken"; `resolve queries` prints a
one-query JSON list unless the suite path contains "empty".
"""
import json
import sys

args = sys.argv[1:]
if args[:2] == ["resolve", "database"]:
    sys.exit(1 if "broken" in args[-1] else 0)
if args[:2] == ["resolve", "queries"]:
    print(json.dumps([] if "empty" in args[-1] else ["q.ql"]))
    sys.exit(0)
sys.exit(3)
