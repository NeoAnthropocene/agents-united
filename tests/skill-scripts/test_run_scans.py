import json
import os
import subprocess
import sys
import tempfile
import time
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPT = HERE.parent.parent / "registry" / "skills" / "semgrep-scanning" / "scripts" / "run_scans.py"
FAKE = f'"{sys.executable}" "{HERE / "fake_semgrep.py"}"'


def read_calls(log):
    """Every call the fake logged: the log itself and any per-process file next to it (log.<pid>)."""
    files = sorted(log.parent.glob(log.name + "*")) if log.parent.exists() else []
    return [json.loads(l) for f in files for l in f.read_text(encoding="utf-8").splitlines()]


class SplitCommand(unittest.TestCase):
    def test_windows_style_quoted_paths_keep_backslashes_and_lose_quotes(self):
        sys.path.insert(0, str(SCRIPT.parent))
        import run_scans  # noqa: E402

        parts = run_scans.split_command(r'"C:\Program Files\Python\python.exe" "C:\a b\fake.py"', posix=False)
        self.assertEqual(parts, [r"C:\Program Files\Python\python.exe", r"C:\a b\fake.py"])


class FakeSemgrepLog(unittest.TestCase):
    """run_scans.py runs scans concurrently and the fake logs each call. On Windows two buffered appends to one file can overwrite or
    interleave each other: a full-suite run saw one call instead of two, and then invalid JSON (Plan 035 H8, 2026-10-06). Forty
    processes spin until one shared instant and then call the fake five times each, so that the contention is not left to chance."""

    DRIVER = (
        "import runpy, sys, time\n"
        "start, fake, tag = float(sys.argv[1]), sys.argv[2], sys.argv[3]\n"
        "while time.time() < start:\n"
        "    pass\n"
        "for j in range(5):\n"
        "    sys.argv = [fake, '--config', f'p/{tag}-{j}', '--metrics=off']\n"
        "    try:\n"
        "        runpy.run_path(fake, run_name='__main__')\n"
        "    except SystemExit:\n"
        "        pass\n"
    )

    def test_two_hundred_concurrent_calls_are_all_logged_intact(self):
        with tempfile.TemporaryDirectory() as tmp:
            log = Path(tmp) / "calls.log"
            env = dict(os.environ, FAKE_SEMGREP_LOG=str(log))
            start = time.time() + 4
            procs = [
                subprocess.Popen([sys.executable, "-c", self.DRIVER, str(start), str(HERE / "fake_semgrep.py"), str(i)],
                                 env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                for i in range(40)
            ]
            for p in procs:
                p.wait()
            calls = read_calls(log)
            self.assertEqual(sorted(a[1] for a in calls), sorted(f"p/{i}-{j}" for i in range(40) for j in range(5)))


class RunScans(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.target = self.root / "target"
        self.target.mkdir()
        self.out = self.root / "out"
        self.log = self.root / "calls.log"

    def tearDown(self):
        self.tmp.cleanup()

    def plan(self, obj):
        p = self.root / "rulesets.json"
        p.write_text(json.dumps(obj), encoding="utf-8")
        return str(p)

    def run_script(self, plan, *extra, mode="run-all", target=None, out=None):
        env = dict(os.environ, SEMGREP_BIN=FAKE, FAKE_SEMGREP_LOG=str(self.log))
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--target", str(target or self.target),
             "--output-dir", str(out or self.out), "--mode", mode, "--rulesets", self.plan(plan), *extra],
            capture_output=True, text=True, env=env,
        )

    def calls(self):
        return read_calls(self.log)

    def summary(self):
        return json.loads((self.out / "scans.json").read_text())

    def test_every_command_has_metrics_off_and_language_scope(self):
        r = self.run_script({"baseline": ["p/security-audit"], "python": ["p/python"]})
        self.assertEqual(r.returncode, 0, r.stderr)
        calls = self.calls()
        self.assertEqual(len(calls), 2)
        for argv in calls:
            self.assertIn("--metrics=off", argv)
        scoped = next(a for a in calls if "p/python" in a)
        self.assertIn("--include=*.py", scoped)
        unscoped = next(a for a in calls if "p/security-audit" in a)
        self.assertFalse([a for a in unscoped if a.startswith("--include")])

    def test_important_only_adds_severity_flags(self):
        self.run_script({"python": ["p/python"]}, mode="important-only")
        argv = self.calls()[0]
        self.assertEqual(argv.count("--severity"), 2)
        self.assertIn("WARNING", argv)
        self.assertIn("ERROR", argv)

    def test_language_aliases_fold_and_baseline_is_not_rerun(self):
        r = self.run_script({"baseline": ["p/secrets"], "js": ["p/javascript", "p/secrets"], "javascript": ["p/javascript"]})
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self.summary()
        rulesets = sorted((x["lang"], x["ruleset"]) for x in s["scans"])
        self.assertEqual(rulesets, [("all", "p/secrets"), ("javascript", "p/javascript")])
        self.assertEqual(s["alsoShared"], ["javascript/p/secrets"])

    def test_unknown_language_is_reported_unscoped(self):
        self.run_script({"cobol": ["p/cobol"]})
        self.assertEqual(self.summary()["unscoped"], ["cobol"])

    def test_output_inside_target_is_excluded_and_recorded(self):
        out = self.target / "scan-out"
        r = self.run_script({"python": ["p/python"]}, out=out)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("--exclude=scan-out", self.calls()[0])
        self.assertEqual(json.loads((out / "scans.json").read_text())["excludePattern"], "scan-out")

    def test_output_equal_to_target_is_refused(self):
        r = self.run_script({"python": ["p/python"]}, out=self.target)
        self.assertEqual(r.returncode, 1)
        self.assertIn("scan target", r.stderr)

    def test_failed_partial_and_covered_nothing_are_recorded(self):
        r = self.run_script({"baseline": ["p/ok"], "python": ["p/boom", "p/partial", "p/empty"]})
        self.assertEqual(r.returncode, 0, r.stderr)
        s = self.summary()
        self.assertEqual([f["ruleset"] for f in s["failed"]], ["p/boom"])
        by = {x["ruleset"]: x for x in s["scans"]}
        self.assertTrue(by["p/partial"]["partial"])
        self.assertFalse(by["p/ok"]["partial"])
        self.assertEqual(s["coveredNothing"], ["python/p/empty"])
        self.assertEqual(by["p/ok"]["findings"], 1)

    def test_unparseable_output_is_a_failure_not_a_clean_scan(self):
        r = self.run_script({"baseline": ["p/garbage"]})
        self.assertEqual(r.returncode, 1)
        self.assertEqual(len(self.summary()["failed"]), 1)

    def test_all_scans_failing_exits_nonzero(self):
        r = self.run_script({"baseline": ["p/boom"]})
        self.assertEqual(r.returncode, 1)

    def test_bad_plans_are_rejected_before_anything_runs(self):
        for bad in ({"python": ["--config"]}, {"python": ["../etc"]}, {"third_party": ["http://x.y/z"]},
                    {"python": "p/python"}, {"python": ["p/x y"]}):
            r = self.run_script(bad)
            self.assertEqual(r.returncode, 1, bad)
            self.assertEqual(self.calls(), [], bad)

    def test_relative_paths_are_rejected(self):
        env = dict(os.environ, SEMGREP_BIN=FAKE)
        r = subprocess.run([sys.executable, str(SCRIPT), "--target", "rel", "--output-dir", str(self.out),
                            "--mode", "run-all", "--rulesets", self.plan({"baseline": ["p/x"]})],
                           capture_output=True, text=True, env=env)
        self.assertEqual(r.returncode, 1)
        self.assertIn("absolute", r.stderr)

    def test_dry_run_prints_commands_and_writes_nothing(self):
        r = self.run_script({"baseline": ["p/secrets"]}, "--dry-run")
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertIn("--metrics=off", r.stdout)
        self.assertFalse(self.out.exists())
        self.assertEqual(self.calls(), [])

    def test_reused_output_dir_drops_stale_raw_files(self):
        self.run_script({"baseline": ["p/one"]})
        self.run_script({"baseline": ["p/two"]})
        names = sorted(p.name for p in (self.out / "raw").glob("*.sarif"))
        self.assertEqual(names, ["all-two.sarif"])

    def test_missing_semgrep_is_an_error(self):
        env = dict(os.environ, SEMGREP_BIN="definitely-not-installed-semgrep")
        r = subprocess.run([sys.executable, str(SCRIPT), "--target", str(self.target), "--output-dir", str(self.out),
                            "--mode", "run-all", "--rulesets", self.plan({"baseline": ["p/x"]})],
                           capture_output=True, text=True, env=env)
        self.assertEqual(r.returncode, 1)
        self.assertIn("semgrep is required", r.stderr)


class Pruning(unittest.TestCase):
    def test_prune_keeps_rule_files_and_drops_workflows_and_join_rules(self):
        sys.path.insert(0, str(SCRIPT.parent))
        import run_scans  # noqa: E402

        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "good.yaml").write_text("rules:\n  - id: a\n", encoding="utf-8")
            (root / "ci.yml").write_text("on:\n  pull_request:\n", encoding="utf-8")
            (root / "join.yaml").write_text("rules:\n  - id: j\n    mode: join\n    join:\n      rules: []\n", encoding="utf-8")
            (root / "mentions.yaml").write_text("rules:\n  - id: m\n    message: 'mode: join is a thing'\n", encoding="utf-8")
            run_scans.prune_yaml(root, lambda t: not run_scans.RULES_KEY_RE.search(t))
            run_scans.prune_yaml(root, lambda t: bool(run_scans.JOIN_MODE_RE.search(t) and run_scans.JOIN_BLOCK_RE.search(t)))
            self.assertEqual(sorted(p.name for p in root.iterdir()), ["good.yaml", "mentions.yaml"])

    def test_clone_dir_name_carries_the_owner(self):
        sys.path.insert(0, str(SCRIPT.parent))
        import run_scans  # noqa: E402

        self.assertEqual(run_scans.repo_dir_name("https://github.com/trailofbits/semgrep-rules.git"), "trailofbits-semgrep-rules")
        self.assertEqual(run_scans.repo_dir_name("https://github.com/elttam/semgrep-rules/"), "elttam-semgrep-rules")


if __name__ == "__main__":
    unittest.main()
