#!/usr/bin/env bash
#
# run_all.sh - the whole automated QA pass, in the order that makes failures easiest to read:
#
#   1. node tools/build.js          regenerate js/data/manifest.js and the <script> list in index.html
#   2. validate_data.js             static check of every data file (fast, no browser)
#   3. every tools/test/story/*_path.js (chapter drives) and tools/test/*_selftest.js
#   4. smoke.js                     boot the real game, visit every map, fight every troop
#
# Usage (from anywhere):
#   tools/test/run_all.sh                 everything
#   tools/test/run_all.sh --quick         build + validate only (no browser)
#   tools/test/run_all.sh --no-build      keep the manifest as it is
#   tools/test/run_all.sh --no-battles    pass --no-battles on to smoke.js
#
# Exit code 0 only when every step passed; the summary at the end lists what failed.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

DO_BUILD=1
QUICK=0
SMOKE_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --quick) QUICK=1 ;;
    --no-build) DO_BUILD=0 ;;
    --no-battles) SMOKE_ARGS+=("--no-battles") ;;
    -h|--help)
      sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) echo "run_all: unknown option \"$arg\" (try --help)"; exit 2 ;;
  esac
done

FAILED=()
PASSED=()

hr() { printf '\n=== %s %s\n' "$1" "$(printf '=%.0s' $(seq 1 $((60 - ${#1}))))"; }

run_step() {           # run_step <label> <command...>
  local label="$1"; shift
  hr "$label"
  if "$@"; then
    PASSED+=("$label")
  else
    FAILED+=("$label")
  fi
}

if [ "$DO_BUILD" -eq 1 ]; then
  run_step "build" node tools/build.js
fi

run_step "validate_data" node tools/test/validate_data.js

for f in tools/test/story/*_path.js; do        # the chapter drives (story flags, puzzles, bosses, endings)
  if [ "$QUICK" = "1" ]; then echo "skipped (--quick): $f"; continue; fi
  run_step "story/$(basename "$f" .js)" node "$f"
done

for f in tools/test/*_selftest.js; do
  [ -e "$f" ] || continue
  if [ "$QUICK" -eq 1 ]; then
    echo "skipped (--quick): $f"
    continue
  fi
  run_step "$(basename "$f")" node "$f" --no-build
done

if [ "$QUICK" -eq 1 ]; then
  echo "skipped (--quick): tools/test/smoke.js"
else
  run_step "smoke" node tools/test/smoke.js --no-build "${SMOKE_ARGS[@]+"${SMOKE_ARGS[@]}"}"
fi

hr "summary"
for s in ${PASSED[@]+"${PASSED[@]}"}; do echo "  PASS  $s"; done
for s in ${FAILED[@]+"${FAILED[@]}"}; do echo "  FAIL  $s"; done

if [ ${#FAILED[@]} -gt 0 ]; then
  echo ""
  echo "${#FAILED[@]} step(s) failed."
  exit 1
fi
echo ""
echo "all ${#PASSED[@]} step(s) passed."
