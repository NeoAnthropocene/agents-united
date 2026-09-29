<!-- Adapted for agents-united from https://github.com/trailofbits/skills/blob/0cc1c73a5e96749ab32d7ea5e14892fafa6972ae/plugins/static-analysis/skills/codeql/references/build-fixes.md
     Licence: see ../LICENSE; changes: see ../NOTICE.md.
     Upstream's bash helpers were ported to Python (scripts/run_scans.py, build_log.py,
     find_databases.py, generate_suite.py) so they run on Windows and POSIX; commands below use
     the ports. Other shell snippets (arrays, $(...)) are POSIX-shell examples: run them in Git
     Bash or WSL on Windows, or translate them. `{baseDir}` means this skill's folder. -->

# Build Fixes

Fixes to apply when a CodeQL database build method fails. Try these in order, then retry the current build method. **Log each fix attempt.**

Log each fix with `python {baseDir}/scripts/build_log.py step "..."`. Set `OUTPUT_DIR` in every
block; without it the log lands in the working directory.

## 1. Clean existing state

```bash

python {baseDir}/scripts/build_log.py step "Applying fix: clean existing state"
rm -rf "$DB_NAME"
python {baseDir}/scripts/build_log.py result "Removed $DB_NAME"
```

## 2. Clean build cache

```bash

python {baseDir}/scripts/build_log.py step "Applying fix: clean build cache"
CLEANED=""
make clean 2>/dev/null && CLEANED="$CLEANED make"
rm -rf build CMakeCache.txt CMakeFiles 2>/dev/null && CLEANED="$CLEANED cmake-artifacts"
./gradlew clean 2>/dev/null && CLEANED="$CLEANED gradle"
mvn clean 2>/dev/null && CLEANED="$CLEANED maven"
cargo clean 2>/dev/null && CLEANED="$CLEANED cargo"
python {baseDir}/scripts/build_log.py result "Cleaned: $CLEANED"
```

## 3. Install missing dependencies

> **Note:** The commands below install the *target project's* dependencies so CodeQL can trace the build. Use whatever package manager the target project expects (`pip`, `npm`, `go mod`, etc.) — these are not the skill's own tooling preferences.

```bash

python {baseDir}/scripts/build_log.py step "Applying fix: install dependencies"
FAILED_INSTALLS=()

# Python — use target project's package manager (pip/uv/poetry)
# allow-legacy-python: installs the analysed project's own deps; forcing uv could change its build.
if [ -f requirements.txt ]; then
  python {baseDir}/scripts/build_log.py run -- pip install -r requirements.txt || FAILED_INSTALLS+=("pip install -r requirements.txt")
fi
if [ -f setup.py ] || [ -f pyproject.toml ]; then
  python {baseDir}/scripts/build_log.py run -- pip install -e . || FAILED_INSTALLS+=("pip install -e .")
fi

# Node
if [ -f package.json ]; then
  python {baseDir}/scripts/build_log.py run -- npm install || FAILED_INSTALLS+=("npm install")
fi

# Go
if [ -f go.mod ]; then
  python {baseDir}/scripts/build_log.py run -- go mod download || FAILED_INSTALLS+=("go mod download")
fi

# Java
if [ -f build.gradle ] || [ -f build.gradle.kts ]; then
  python {baseDir}/scripts/build_log.py run -- ./gradlew dependencies --refresh-dependencies || FAILED_INSTALLS+=("gradlew dependencies")
fi
if [ -f pom.xml ]; then
  python {baseDir}/scripts/build_log.py run -- mvn dependency:resolve || FAILED_INSTALLS+=("mvn dependency:resolve")
fi

# Rust
if [ -f Cargo.toml ]; then
  python {baseDir}/scripts/build_log.py run -- cargo fetch || FAILED_INSTALLS+=("cargo fetch")
fi

if [ ${#FAILED_INSTALLS[@]} -gt 0 ]; then
  python {baseDir}/scripts/build_log.py result "Dependency installation FAILED: ${FAILED_INSTALLS[*]}"
  echo "WARNING: ${#FAILED_INSTALLS[@]} dependency step(s) failed — a retry will likely" \
       "fail the same way. Report which, rather than retrying blind." >&2
else
  python {baseDir}/scripts/build_log.py result "Dependencies installed"
fi
```

## 4. Handle private registries

If dependencies require authentication, ask user:
```
AskUserQuestion: "Build requires private registry access. Options:"
  1. "I'll configure auth and retry"
  2. "Skip these dependencies"
  3. "Show me what's needed"
```

```bash

# Log authentication setup if performed
python {baseDir}/scripts/build_log.py step "Private registry authentication configured"
python {baseDir}/scripts/build_log.py result "Registry: <REGISTRY_URL>, Method: <AUTH_METHOD>"
```

**After fixes:** Retry current build method. If still fails, move to next method.
