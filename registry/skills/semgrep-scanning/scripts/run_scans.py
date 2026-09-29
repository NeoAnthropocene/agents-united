#!/usr/bin/env python3
# /// script
# requires-python = ">=3.9"
# dependencies = []
# ///
"""Run the approved Semgrep rulesets and record what each scan produced.

Cross-platform Python port of upstream's `scripts/run-scans.sh` (Trail of Bits, CC-BY-SA-4.0;
see ../NOTICE.md). Behaviour is the same, and it runs unchanged on Windows and POSIX with only
the standard library, `git` and `semgrep` on PATH.

Generating every command here is what keeps `--metrics=off`, `--include` and `--exclude` out of
a model's hands: commands are built as argument lists from the approved plan, never typed. Exit
codes and counts come from the processes and the JSON they wrote.

Usage:
    python run_scans.py --target ABS_DIR --output-dir ABS_DIR --mode run-all|important-only
                        --rulesets FILE [--pro] [--jobs N] [--dry-run]

`--rulesets` is JSON: {"baseline": [...], "<language>": [...], "third_party": ["https://..."]}.
Writes OUTPUT_DIR/scans.json:
    {scans:[{lang, ruleset, json, sarif, findings, filesScanned, partial, exitCode}],
     failed:[...], skipped:[...], unscoped:[lang], alsoShared:["lang/ruleset"],
     coveredNothing:[...], excludePattern, pro, mode, outputDir, rawDir, reposPath}
`partial` is a scan that wrote complete output while some of its rules failed to compile.

Set SEMGREP_BIN to override the semgrep executable (split shell-style, so
`SEMGREP_BIN="python fake_semgrep.py"` works); this exists so the tests can run without Semgrep.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shlex
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

METRICS_OFF = "--metrics=off"
# semgrep --severity accepts INFO, WARNING and ERROR only; the LOW/MEDIUM/HIGH metadata
# thresholds are applied by the post-filter in references/scan-modes.md, not here.
SEVERITY_FLAGS = ["--severity", "WARNING", "--severity", "ERROR"]
DEFAULT_JOBS = 4

# A semgrep join rule carries `mode: join` and the `join:` block that mode needs. Requiring both
# keeps the prune off a rule that merely mentions the words; each is anchored as a YAML key.
JOIN_MODE_RE = re.compile(r"^\s*(-\s+)?mode:\s*(join|\"join\"|'join')\s*(#.*)?$", re.M)
JOIN_BLOCK_RE = re.compile(r"^\s*join:\s*(#.*)?$", re.M)
RULES_KEY_RE = re.compile(r"^rules:", re.M)

RULESET_ID_RE = re.compile(r"^[A-Za-z0-9._][A-Za-z0-9._-]*(/[A-Za-z0-9._-]+)*$")
THIRD_PARTY_RE = re.compile(r"^https://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._-]+)+(\.git)?/?$")

# --include globs per language. A type omitted here is excluded with no signal and the ruleset
# reads clean rather than incomplete, so re-check against semgrep when editing. javascript carries
# the TypeScript globs because one detection category covers both.
INCLUDES: dict[str, list[str]] = {
    "python": ["*.py", "*.pyi"],
    "javascript": ["*.js", "*.jsx", "*.mjs", "*.cjs", "*.ts", "*.tsx"],
    "typescript": ["*.ts", "*.tsx"],
    "go": ["*.go"],
    "ruby": ["*.rb"],
    "java": ["*.java", "*.jsp"],
    "kotlin": ["*.kt", "*.kts"],
    "php": ["*.php", "*.phtml"],
    "c": ["*.c", "*.h"],
    "cpp": ["*.c", "*.cc", "*.cpp", "*.cxx", "*.h", "*.hh", "*.hpp", "*.hxx"],
    "csharp": ["*.cs"],
    "rust": ["*.rs"],
    "scala": ["*.scala"],
    "swift": ["*.swift"],
    "elixir": ["*.ex", "*.exs"],
    "solidity": ["*.sol"],
    "docker": ["Dockerfile", "*.dockerfile"],
    "terraform": ["*.tf", "*.tfvars", "*.hcl"],
    "json": ["*.json"],
    "apex": ["*.cls", "*.trigger"],
    "cloudformation": ["*.yaml", "*.yml", "*.json"],
    "github-actions": ["*.yml", "*.yaml"],
    "kubernetes": ["*.yaml", "*.yml"],
    "yaml": ["*.yaml", "*.yml"],
}

# Folds plan spellings onto the keys INCLUDES knows, so `js` and `javascript` do not become two
# units and scan the same ruleset twice.
LANG_ALIASES = {
    "js": "javascript", "jsx": "javascript", "node": "javascript", "nodejs": "javascript",
    "js/ts": "javascript", "javascript/typescript": "javascript",
    "ts": "typescript", "tsx": "typescript",
    "golang": "go",
    "c/c++": "cpp", "c++": "cpp", "cxx": "cpp",
    "dockerfile": "docker",
    "k8s": "kubernetes",
    "c#": "csharp", "dotnet": "csharp",
    "sol": "solidity",
    "tf": "terraform", "hcl": "terraform",
    "cfn": "cloudformation",
    "github actions": "github-actions", "githubactions": "github-actions", "gha": "github-actions",
    "salesforce": "apex",
}
UNSAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


class Die(Exception):
    """A configuration error: fail the run rather than degrade it."""


def canonical_lang(key: str) -> str:
    k = key.strip().lower()
    return LANG_ALIASES.get(k, k)


def slug(value: str) -> str:
    if "://" in value:
        return repo_dir_name(value)
    return UNSAFE_NAME_RE.sub("-", value.rsplit("/", 1)[-1]).strip("-")


def repo_dir_name(url: str) -> str:
    """Clone directory carries the owner: several orgs publish a repo named semgrep-rules."""
    u = url.rstrip("/")
    if u.endswith(".git"):
        u = u[:-4]
    u = u.rstrip("/")
    repo = u.rsplit("/", 1)[-1]
    owner = u.rsplit("/", 2)[-2] if u.count("/") >= 2 else ""
    return UNSAFE_NAME_RE.sub("-", f"{owner or 'unknown'}-{repo or 'rules'}")


def split_command(value: str, posix: bool | None = None) -> list[str]:
    # Windows needs non-POSIX splitting so backslashes in paths survive; that mode keeps the
    # quotes around a token, so strip them.
    parts = shlex.split(value, posix=(os.name != "nt") if posix is None else posix)
    return [p[1:-1] if len(p) >= 2 and p[0] == p[-1] and p[0] in "\"'" else p for p in parts]


def semgrep_bin() -> list[str]:
    return split_command(os.environ.get("SEMGREP_BIN", "semgrep"))


def render_argv(argv: list[str]) -> str:
    return subprocess.list2cmdline(argv) if os.name == "nt" else shlex.join(argv)


def validate_plan(plan: object) -> dict[str, list[str]]:
    if not isinstance(plan, dict) or not all(isinstance(v, list) for v in plan.values()):
        raise Die("every value in --rulesets must be an array")
    for key, values in plan.items():
        if key == "third_party":
            for v in values:
                if not (isinstance(v, str) and THIRD_PARTY_RE.match(v)):
                    raise Die("third_party entries must be https git URLs")
        else:
            for v in values:
                if not (
                    isinstance(v, str) and RULESET_ID_RE.match(v) and ".." not in v.split("/")
                ):
                    raise Die(
                        "ruleset entries must be registry identifiers like p/python; "
                        "repository URLs go under third_party"
                    )
    return plan  # type: ignore[return-value]


def prune_yaml(directory: Path, should_delete) -> list[Path]:
    """Delete every .yaml/.yml under `directory` that `should_delete(text)` selects."""
    removed: list[Path] = []
    for path in sorted(directory.rglob("*")):
        if path.suffix not in (".yaml", ".yml") or not path.is_file():
            continue
        if ".git" in path.relative_to(directory).parts:
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            raise Die(f"could not read {path}: {exc}") from exc
        if should_delete(text):
            path.unlink()
            removed.append(path)
    return removed


def clone_third_party(urls: list[str], repos_dir: Path, dry_run: bool, skipped: list[tuple[str, str]]):
    """Clone each repo once (deduplicated by destination name) and prune unscannable YAML."""
    unique: list[tuple[str, str]] = []
    seen: set[str] = set()
    for url in urls:
        name = repo_dir_name(url)
        if name not in seen:
            seen.add(name)
            unique.append((url, name))

    cloned: list[tuple[str, Path]] = []
    for url, name in unique:
        dest = repos_dir / name
        if dry_run:
            cloned.append((url, dest))
            continue
        # Cleared first: git clone refuses a non-empty directory, so a reused output directory
        # would drop an approved ruleset while usable rules sat on disk.
        shutil.rmtree(dest, ignore_errors=True)
        proc = subprocess.run(
            ["git", "clone", "--depth", "1", url, str(dest)],
            capture_output=True, text=True,
        )
        if proc.returncode != 0:
            tail = " ".join((proc.stderr or "").strip().splitlines()[-3:])
            skipped.append((url, tail or "clone failed"))
            continue
        # semgrep parses EVERY .yaml/.yml under a --config directory as a rule file, and one
        # unparseable file (a CI workflow shipped with the rules) aborts the whole scan. A rule
        # file always has a top-level `rules:` key; nothing else in a rule repo does. `mode: join`
        # rules crash some semgrep versions outright and are pruned as well.
        try:
            non_rules = prune_yaml(dest, lambda t: not RULES_KEY_RE.search(t))
            join_rules = prune_yaml(
                dest, lambda t: bool(JOIN_MODE_RE.search(t) and JOIN_BLOCK_RE.search(t))
            )
        except Die:
            skipped.append((url, "could not prune unscannable YAML from the clone"))
            shutil.rmtree(dest, ignore_errors=True)
            continue
        print(
            f"{name}: pruned {len(non_rules)} non-rule YAML file(s) and "
            f"{len(join_rules)} join-mode rule file(s)",
            file=sys.stderr,
        )
        if not any(p.suffix in (".yaml", ".yml") and p.is_file() for p in dest.rglob("*")):
            skipped.append((url, "cloned but contains no rule files"))
            continue
        cloned.append((url, dest))
    return cloned


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--target", required=True, help="absolute path to the tree to scan")
    ap.add_argument("--output-dir", required=True, help="absolute path for results")
    ap.add_argument("--mode", required=True, choices=["run-all", "important-only"])
    ap.add_argument("--rulesets", required=True, help="JSON plan file")
    ap.add_argument("--pro", action="store_true", help="add --pro to every command")
    ap.add_argument("--jobs", type=int, default=DEFAULT_JOBS, help="concurrent semgrep processes")
    ap.add_argument("--dry-run", action="store_true", help="print the commands, clone nothing")
    args = ap.parse_args(argv)

    try:
        return run(args)
    except Die as exc:
        print(f"run_scans.py: {exc}", file=sys.stderr)
        return 1


def run(args: argparse.Namespace) -> int:
    if args.jobs < 1:
        raise Die("--jobs must be at least 1")
    if not os.path.isabs(args.target):
        raise Die(f"--target must be an absolute path, got '{args.target}'")
    if not os.path.isabs(args.output_dir):
        raise Die(f"--output-dir must be an absolute path, got '{args.output_dir}'")
    if not os.path.isdir(args.target):
        raise Die(f"--target is not a directory: {args.target}")
    rulesets_file = Path(args.rulesets)
    if not rulesets_file.is_file():
        raise Die(f"--rulesets file is missing or unreadable: {args.rulesets}")
    try:
        plan = validate_plan(json.loads(rulesets_file.read_text(encoding="utf-8")))
    except json.JSONDecodeError as exc:
        raise Die(f"--rulesets is not valid JSON: {args.rulesets}") from exc

    sg = semgrep_bin()
    if not args.dry_run and shutil.which(sg[0]) is None:
        raise Die("semgrep is required (or set SEMGREP_BIN)")
    if not args.dry_run and shutil.which("git") is None and plan.get("third_party"):
        raise Die("git is required to clone third_party rulesets")

    # Both paths resolve the same way before being compared, so a symlinked path cannot hide
    # the output dir inside the target and let the run scan its own cloned rules.
    target = Path(os.path.realpath(args.target))
    output_root = Path(os.path.realpath(args.output_dir))
    if output_root == target:
        raise Die("--output-dir is the scan target; the run would scan its own output and its cloned rules")

    raw_dir = output_root / "raw"
    repos_dir = output_root / "repos"

    # The default output dir lands inside the target; without --exclude every scan would also
    # read the cloned rule repos (full of literal example secrets). --exclude takes a pattern,
    # not a rooted path (`out` also excludes `vendor/out`), so it is announced and recorded.
    exclude_arg = ""
    exclude_pattern = ""
    try:
        rel = output_root.relative_to(target)
        exclude_pattern = rel.as_posix()
        exclude_arg = f"--exclude={exclude_pattern}"
        print(f"note: output directory is inside the target; excluding '{exclude_pattern}' from every scan.", file=sys.stderr)
        print("      semgrep matches that pattern anywhere in the tree.", file=sys.stderr)
    except ValueError:
        pass

    baseline = sorted(set(plan.get("baseline", [])))
    third_party = plan.get("third_party", [])
    lang_keys = [
        k for k, v in plan.items() if k not in ("baseline", "third_party") and len(v) > 0
    ]

    if not args.dry_run:
        # Cleared: merge_sarif.py globs every *.sarif here, so a reused directory would merge
        # the previous run's output for a ruleset this run dropped.
        shutil.rmtree(raw_dir, ignore_errors=True)
        raw_dir.mkdir(parents=True, exist_ok=True)
        if third_party:
            repos_dir.mkdir(parents=True, exist_ok=True)

    skipped: list[tuple[str, str]] = []
    cloned = clone_third_party(third_party, repos_dir, args.dry_run, skipped)

    # ------------------------------------------------------------ build the scan list
    scans: list[dict] = []  # stem, lang, ruleset, config, includes
    used_stems: set[str] = set()

    def add_scan(lang: str, ruleset: str, config: str, includes: list[str]) -> None:
        base = f"{UNSAFE_NAME_RE.sub('-', lang)}-{slug(ruleset)}"
        stem, n = base, 2
        while stem in used_stems:
            stem, n = f"{base}-{n}", n + 1
        used_stems.add(stem)
        scans.append({"stem": stem, "lang": lang, "ruleset": ruleset, "config": config, "includes": includes})

    # Cross-language rulesets scan the whole target unscoped and run once, never with --include.
    for ruleset in baseline:
        add_scan("all", ruleset, ruleset, [])
    for url, dest in cloned:
        add_scan("all", url, str(dest), [])

    langs: dict[str, list[str]] = {}
    for key in lang_keys:
        lang = canonical_lang(key)
        if lang == "all":
            raise Die(f"ruleset key '{key}' names the reserved language 'all' used by the cross-language unit")
        langs.setdefault(lang, [])
        for rs in plan[key]:
            if rs not in langs[lang]:
                langs[lang].append(rs)

    also_shared: set[str] = set()
    unscoped: set[str] = set()
    for lang in sorted(langs):
        globs = INCLUDES.get(lang, [])
        had_own = False
        for ruleset in sorted(langs[lang]):
            # A ruleset already running unscoped over the whole target needs no narrower rerun.
            if ruleset in baseline:
                also_shared.add(f"{lang}/{ruleset}")
                continue
            add_scan(lang, ruleset, ruleset, globs)
            had_own = True
        # An unrecognized language costs the --include optimisation, not coverage.
        if had_own and not globs:
            unscoped.add(lang)

    if not scans:
        raise Die("the ruleset plan produced no scans; there is nothing to run")

    # --------------------------------------------------------------------- commands
    def build_argv(scan: dict, json_path: Path, sarif_path: Path) -> list[str]:
        argv = list(sg)
        if args.pro:
            argv.append("--pro")
        argv.append(METRICS_OFF)
        if args.mode == "important-only":
            argv += SEVERITY_FLAGS
        argv += [f"--include={g}" for g in scan["includes"]]
        # On every command, including the unscoped ones: those are precisely the rulesets that
        # would otherwise read the cloned rule repositories.
        if exclude_arg:
            argv.append(exclude_arg)
        argv += ["--config", scan["config"], "--json", "-o", str(json_path),
                 f"--sarif-output={sarif_path}", str(target)]
        return argv

    if args.dry_run:
        for scan in scans:
            print(render_argv(build_argv(scan, raw_dir / f"{scan['stem']}.json", raw_dir / f"{scan['stem']}.sarif")))
        return 0

    # ---------------------------------------------------------------- run the scans
    # Batched rather than unbounded: semgrep holds the rules and scanned ASTs in memory, so an
    # unbounded fan-out gets processes OOM-killed and those look like ordinary scan failures.
    print(f"running {len(scans)} scan(s), {args.jobs} at a time", file=sys.stderr)
    work = Path(tempfile.mkdtemp(prefix="run-scans."))
    try:
        results: dict[str, tuple[int, str]] = {}
        for i in range(0, len(scans), args.jobs):
            batch = scans[i:i + args.jobs]
            procs = []
            for scan in batch:
                stem = scan["stem"]
                argv = build_argv(scan, raw_dir / f"{stem}.json", raw_dir / f"{stem}.sarif")
                out = open(work / f"out.{stem}", "wb")
                err = open(work / f"err.{stem}", "wb")
                try:
                    procs.append((scan, subprocess.Popen(argv, stdout=out, stderr=err), out, err))
                except OSError as exc:
                    out.close(); err.close()
                    results[stem] = (127, str(exc))
            for scan, proc, out, err in procs:
                rc = proc.wait()
                out.close(); err.close()
                tail = (work / f"err.{scan['stem']}").read_bytes()[-800:].decode("utf-8", "replace").strip()
                results[scan["stem"]] = (rc, tail)

        # ------------------------------------------------------------------ assemble
        ok_scans: list[dict] = []
        failed: list[dict] = []
        covered_nothing: set[str] = set()
        for scan in scans:
            stem = scan["stem"]
            json_path = raw_dir / f"{stem}.json"
            sarif_path = raw_dir / f"{stem}.sarif"
            rc, err_tail = results.get(stem, (127, ""))
            # Exit 0/1 are successful scans. Exit 2 also covers "some rules failed to compile
            # while the rest completed and wrote full output", so it is allowed through and
            # flagged partial; the artifact checks below reject the "nothing written" case.
            # Anything else is fatal however plausible the artifacts look.
            partial = rc == 2
            fatal = rc not in (0, 1, 2)
            findings = scanned = -1
            ok = False
            if (
                not fatal
                and json_path.is_file() and json_path.stat().st_size > 0
                and sarif_path.is_file() and sarif_path.stat().st_size > 0
            ):
                try:
                    data = json.loads(json_path.read_text(encoding="utf-8"))
                    findings = len(data["results"])
                    paths = (data.get("paths") or {}).get("scanned")
                    # null and empty differ: an absent .paths is "not known" (-1), a present
                    # empty list is a scan that genuinely opened no file.
                    scanned = -1 if paths is None else len(paths)
                    ok = True
                except (json.JSONDecodeError, KeyError, TypeError):
                    findings = -1
            if ok:
                if scanned == 0:
                    covered_nothing.add(f"{scan['lang']}/{scan['ruleset']}")
                ok_scans.append({
                    "lang": scan["lang"], "ruleset": scan["ruleset"], "json": str(json_path),
                    "sarif": str(sarif_path), "findings": findings, "filesScanned": scanned,
                    "partial": partial, "exitCode": rc,
                })
            else:
                failed.append({
                    "lang": scan["lang"], "ruleset": scan["ruleset"], "json": str(json_path),
                    "sarif": str(sarif_path), "error": err_tail or f"semgrep exited {rc}",
                })
    finally:
        shutil.rmtree(work, ignore_errors=True)

    summary = {
        "outputDir": str(output_root), "rawDir": str(raw_dir), "reposPath": str(repos_dir),
        "mode": args.mode, "pro": bool(args.pro), "excludePattern": exclude_pattern,
        "scans": ok_scans, "failed": failed,
        "skipped": [{"ruleset": u, "reason": r} for u, r in skipped],
        "alsoShared": sorted(also_shared), "unscoped": sorted(unscoped),
        "coveredNothing": sorted(covered_nothing),
    }
    (output_root / "scans.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(f"{len(ok_scans)} scan(s) succeeded, {len(failed)} failed, {len(skipped)} skipped", file=sys.stderr)
    print(output_root / "scans.json")

    # A run where nothing succeeded is a failed run, not a clean one.
    return 0 if ok_scans else 1


if __name__ == "__main__":
    sys.exit(main())
