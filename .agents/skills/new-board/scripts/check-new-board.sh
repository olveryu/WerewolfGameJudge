#!/bin/sh
# Read-only preset-count checks. Run from the repo root:
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
if any(s != 12 for s in seats.values()):
    print(f"NOTE: non-12-seat presets present: {{k: v for k, v in seats.items() if v != 12}}")
sys.exit(1 if fail else 0)
PY
