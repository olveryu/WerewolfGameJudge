#!/bin/sh
# Read-only E2E inventory checks. Run from the repo root:
#   sh .agents/skills/new-e2e-spec/scripts/check-e2e.sh [repo-root]
set -eu
ROOT="${1:-$(cd "$(dirname "$0")/../../.." && pwd)}"
python3 - "$ROOT" <<'PY'
import re, sys, pathlib
root = pathlib.Path(sys.argv[1])
fail = False
for rel in ["e2e/fixtures/app.fixture.ts", "e2e/helpers/README.md",
            "e2e/helpers/diagnostics.ts", "e2e/helpers/home.ts",
            "e2e/helpers/image-sharing.ts", "e2e/helpers/multi-player.ts",
            "e2e/helpers/night-driver.ts", "e2e/helpers/night-setup.ts",
            "e2e/helpers/resilience.ts", "e2e/helpers/ui.ts",
            "e2e/helpers/waits.ts", "e2e/reporters/failureBundle.ts",
            "playwright.config.ts",
            ".github/workflows/e2e-single-spec.yml",
            ".github/workflows/e2e-run.yml"]:
    if not (root / rel).exists():
        print(f"FAIL: missing {rel}"); fail = True
pages = sorted(p.name for p in (root / "e2e/pages").glob("*.ts"))
print(f"pages: {pages}")
specs = sorted(p.name for p in (root / "e2e/specs").glob("*.spec.ts"))
print(f"specs: {len(specs)}")
forced = []
for p in (root / "e2e/specs").glob("*.spec.ts"):
    for i, line in enumerate(p.read_text().splitlines(), 1):
        if "force: true" in line:
            forced.append(f"{p.name}:{i}")
print(f"force:true in specs: {forced} (expected only drawguess.spec.ts:79)")
if forced != ["drawguess.spec.ts:79"]:
    print("NOTE: force:true occurrences changed; re-check the sanctioned-exception wording")
hits = [str(p) for p in (root / "e2e").rglob("*.ts") if "NIGHT_STEP_ORDER_INTERNAL" in p.read_text()]
print(f"NIGHT_STEP_ORDER_INTERNAL in e2e/: {hits} (expected [])")
sys.exit(1 if fail else 0)
PY
