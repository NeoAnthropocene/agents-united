import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCRIPTS = HERE.parent.parent / "registry" / "skills" / "codeql-scanning" / "scripts"
FAKE = f'"{sys.executable}" "{HERE / "fake_codeql.py"}"'


def run(script, *args, env=None, cwd=None):
    return subprocess.run([sys.executable, str(SCRIPTS / script), *args], capture_output=True, text=True,
                          env=dict(os.environ, **(env or {})), cwd=cwd)


class FindDatabases(unittest.TestCase):
    def test_lists_real_databases_only_once_and_skips_failed_builds(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            for name in ("good", "broken", "nested/good2"):
                p = root / name
                p.mkdir(parents=True)
                (p / "codeql-database.yml").write_text("x", encoding="utf-8")
            r = run("find_databases.py", str(root), str(root / "good"), env={"CODEQL_BIN": FAKE})
            self.assertEqual(r.returncode, 0, r.stderr)
            found = sorted(Path(l).name for l in r.stdout.splitlines())
            self.assertEqual(found, ["good", "good2"])

    def test_dotted_ancestors_do_not_hide_databases_but_dotted_subdirs_are_pruned(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d) / ".cache" / "proj"
            (root / "db").mkdir(parents=True)
            (root / "db" / "codeql-database.yml").write_text("x", encoding="utf-8")
            (root / ".hidden").mkdir()
            (root / ".hidden" / "codeql-database.yml").write_text("x", encoding="utf-8")
            r = run("find_databases.py", str(root), env={"CODEQL_BIN": FAKE})
            self.assertEqual([Path(l).name for l in r.stdout.splitlines()], ["db"])

    def test_depth_limit_matches_upstream(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            ok = root / "a" / "b"
            too_deep = root / "a" / "b" / "c"
            for p in (ok, too_deep):
                p.mkdir(parents=True, exist_ok=True)
                (p / "codeql-database.yml").write_text("x", encoding="utf-8")
            r = run("find_databases.py", str(root), env={"CODEQL_BIN": FAKE})
            self.assertEqual([Path(l).name for l in r.stdout.splitlines()], ["b"])

    def test_missing_codeql_exits_2_instead_of_reporting_no_databases(self):
        r = run("find_databases.py", ".", env={"CODEQL_BIN": "definitely-not-installed-codeql"})
        self.assertEqual(r.returncode, 2)
        self.assertIn("codeql not found", r.stderr)


class SplitCommand(unittest.TestCase):
    """The BIN override must survive Windows paths (backslashes, quotes, spaces)."""

    def test_windows_style_quoted_paths_keep_backslashes_and_lose_quotes(self):
        sys.path.insert(0, str(SCRIPTS))
        import find_databases  # noqa: E402

        parts = find_databases.split_command(r'"C:\Program Files\Python\python.exe" "C:\a b\fake.py"', posix=False)
        self.assertEqual(parts, [r"C:\Program Files\Python\python.exe", r"C:\a b\fake.py"])
        self.assertEqual(find_databases.split_command("python fake.py --x", posix=False), ["python", "fake.py", "--x"])
        self.assertEqual(find_databases.split_command('"/usr/bin/python3" "/a b/fake.py"', posix=True),
                         ["/usr/bin/python3", "/a b/fake.py"])


class BuildLog(unittest.TestCase):
    def test_step_cmd_result_and_run_write_the_log(self):
        with tempfile.TemporaryDirectory() as d:
            env = {"OUTPUT_DIR": d}
            self.assertEqual(run("build_log.py", "step", "hello world", env=env).returncode, 0)
            self.assertEqual(run("build_log.py", "result", "done", env=env).returncode, 0)
            r = run("build_log.py", "run", "--", sys.executable, "-c", "print('from child')", env=env)
            self.assertEqual(r.returncode, 0)
            self.assertIn("from child", r.stdout)
            log = (Path(d) / "build.log").read_text(encoding="utf-8")
            self.assertIn("hello world", log)
            self.assertIn("RESULT: done", log)
            self.assertIn("COMMAND:", log)
            self.assertIn("from child", log)

    def test_run_keeps_the_child_exit_code(self):
        with tempfile.TemporaryDirectory() as d:
            r = run("build_log.py", "run", "--", sys.executable, "-c", "import sys; sys.exit(5)", env={"OUTPUT_DIR": d})
            self.assertEqual(r.returncode, 5)

    def test_unwritable_log_fails_loudly(self):
        r = run("build_log.py", "step", "x", env={"LOG_FILE": str(HERE / "no-such-dir" / "build.log")})
        self.assertEqual(r.returncode, 1)
        self.assertIn("cannot write build log", r.stderr)

    def test_a_command_that_cannot_start_returns_127(self):
        with tempfile.TemporaryDirectory() as d:
            r = run("build_log.py", "run", "--", "definitely-not-a-command", env={"OUTPUT_DIR": d})
            self.assertEqual(r.returncode, 127)


class GenerateSuite(unittest.TestCase):
    def test_suite_content_per_mode(self):
        sys.path.insert(0, str(SCRIPTS))
        import generate_suite  # noqa: E402

        run_all = generate_suite.build_suite("run-all", "python", ["trailofbits/python-queries"])
        self.assertIn("codeql-suites/python-security-and-quality.qls", run_all)
        self.assertIn("codeql-suites/python-security-experimental.qls", run_all)
        self.assertIn("from: trailofbits/python-queries", run_all)
        important = generate_suite.build_suite("important-only", "go", [])
        self.assertIn("from: codeql/go-queries", important)
        self.assertIn("- security", important)
        self.assertIn("- very-high", important)
        for text in (run_all, important):
            self.assertIn("modelgenerator", text)

    def test_missing_language_or_output_dir_is_refused_before_writing(self):
        with tempfile.TemporaryDirectory() as d:
            r = run("generate_suite.py", "run-all", "--output-dir", d, env={"CODEQL_LANG": ""})
            self.assertEqual(r.returncode, 2)
            self.assertFalse((Path(d) / "raw").exists())
            r = run("generate_suite.py", "run-all", "--lang", "python", env={"OUTPUT_DIR": ""})
            self.assertEqual(r.returncode, 2)

    @unittest.skipIf(os.name == "nt", "verify_query_suite.py takes a bare executable path")
    def test_unresolvable_suite_is_deleted(self):
        with tempfile.TemporaryDirectory() as d:
            bin_dir = Path(d) / "bin"
            bin_dir.mkdir()
            fake = bin_dir / "codeql"
            fake.write_text(f'#!{sys.executable}\nimport runpy,sys\nsys.argv[0]=r"{HERE / "fake_codeql.py"}"\nrunpy.run_path(sys.argv[0], run_name="__main__")\n', encoding="utf-8")
            fake.chmod(0o755)
            env = {"PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}"}
            good = run("generate_suite.py", "run-all", "--lang", "python", "--output-dir", str(Path(d) / "ok"), env=env)
            self.assertEqual(good.returncode, 0, good.stderr)
            self.assertTrue((Path(d) / "ok" / "raw" / "run-all.qls").exists())
            bad = run("generate_suite.py", "run-all", "--lang", "python", "--output-dir", str(Path(d) / "empty"), env=env)
            self.assertEqual(bad.returncode, 1)
            self.assertFalse((Path(d) / "empty" / "raw" / "run-all.qls").exists())


if __name__ == "__main__":
    unittest.main()
