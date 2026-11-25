#!/bin/sh
# Read-only preset-count, board UI test map, and Night-1 snapshot checks. Run from the repo root:
#   sh .agents/skills/new-board/scripts/check-new-board.sh [repo-root]
set -eu
ROOT="${1:-$(cd "$(dirname "$0")/../../../.." && pwd)}"
python3 - "$ROOT" <<'PY'
import re, sys, pathlib, collections
root = pathlib.Path(sys.argv[1])
tpl = (root / "packages/game-engine/src/games/werewolf/domain/models/Template.ts").read_text()
block = tpl[tpl.index("export const PRESET_TEMPLATES"):]
names = re.findall(r"\n\s+name: '([^']+)'", block)
# seat counts: parse each entry's roles list, subtract bottom-card count
entries = re.findall(r"name: '([^']+)'.*?roles: \[(.*?)\]", block, re.S)
bottom = {"treasureMaster": 3, "thief": 2}
seats = {}
for name, roles_src in entries:
    roles = re.findall(r"'([^']+)'", roles_src)
    bc = sum(bottom[r] for r in set(roles) if r in bottom)
    seats[name] = len(roles) - bc
contract = (root / "packages/game-engine/src/games/werewolf/domain/models/__tests__/Template.contract.test.ts").read_text()
expected = re.findall(r"'([^']+)'", contract[contract.index("EXPECTED_TEMPLATE_NAMES"):contract.index("];", contract.index("EXPECTED_TEMPLATE_NAMES"))])
print(f"presets: {len(names)}")
print(f"seat counts: {collections.Counter(seats.values())}")
print(f"contract expected names: {len(expected)}")
fail = False
if sorted(names) != sorted(expected):
    print("FAIL: PRESET_TEMPLATES names != EXPECTED_TEMPLATE_NAMES"); fail = True
# Board UI tests: one mapped, existing file per preset, and the harness's fail-fast count.
board_tests = root / "packages/web/src/games/werewolf/room/__tests__"
coverage = (board_tests / "harness/boardDialogCoverage.ts").read_text()
mapped = dict(re.findall(r"^\s+(\S+): '(\S+\.board\.ui\.test\.tsx)',$", coverage, re.M))
count_match = re.search(r"boards\.length !== (\d+)", coverage)
print(f"board UI test map: {len(mapped)}")
if sorted(mapped) != sorted(names):
    print(f"FAIL: BOARD_TEST_FILE_MAP boards != PRESET_TEMPLATES (missing: {sorted(set(names) - set(mapped))}, extra: {sorted(set(mapped) - set(names))})"); fail = True
missing_files = [f for f in mapped.values() if not (board_tests / "boards" / f).is_file()]
if missing_files:
    print(f"FAIL: mapped board UI test files missing: {missing_files}"); fail = True
if count_match is None or int(count_match.group(1)) != len(names):
    print(f"FAIL: getAll12PBoards preset count != {len(names)}"); fail = True
# Night-1 scenarios: every preset has a recorded ordinary-night snapshot.
snapshot = (root / "packages/game-engine/src/games/werewolf/__tests__/boards/__snapshots__/night1.scenarios.integration.test.ts.snap").read_text()
recorded = set(re.findall(r"> (\S+) preset: ordinary night 1`", snapshot))
print(f"night-1 preset snapshots: {len(recorded & set(names))} of {len(names)} presets")
if set(names) - recorded:
    print(f"FAIL: presets without a recorded Night-1 snapshot: {sorted(set(names) - recorded)}"); fail = True
if recorded - set(names):
    print(f"FAIL: Night-1 snapshots for unknown presets: {sorted(recorded - set(names))}"); fail = True
if any(s != 12 for s in seats.values()):
    print(f"NOTE: non-12-seat presets present: {{k: v for k, v in seats.items() if v != 12}}")
sys.exit(1 if fail else 0)
PY
