#!/bin/sh
# Read-only generator-count checks. Run from the repo root:
#   sh .agents/skills/new-game/scripts/check-new-game.sh [repo-root]
# Re-derive the expected numbers from the generator code if they change;
# never edit this script to match stale documentation.
set -eu
ROOT="${1:-$(cd "$(dirname "$0")/../../.." && pwd)}"
python3 - "$ROOT" <<'PY'
import re, sys, pathlib
root = pathlib.Path(sys.argv[1])
gen = (root / "scripts/lib/new-game/generate.mjs").read_text()
block = gen[gen.index("const SHARED_EDITS = ["):gen.index("];", gen.index("const SHARED_EDITS = ["))]
edits = block.count("file:")
templates = list((root / "scripts/lib/new-game/templates").rglob("*.tmpl"))
report = (root / "scripts/lib/new-game/report.mjs").read_text()
steps = sorted({int(m) for m in re.findall(r"^(\d+)\.\s+\*\*", report, re.M)})
migrations = list((root / "packages/api-worker/migrations").glob("*.sql"))
print(f"SHARED_EDITS entries: {edits} (expected 15)")
print(f"template files: {len(templates)} (expected 39)")
print(f"report steps: {steps} (expected 1..8)")
print(f"migration files: {len(migrations)}")
fail = edits != 15 or len(templates) != 39 or steps != list(range(1, 9))
sys.exit(1 if fail else 0)
PY
