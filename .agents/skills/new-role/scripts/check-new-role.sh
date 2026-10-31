#!/bin/sh
# Read-only structural checks for a new-role change. Run from the repo root:
#   sh .agents/skills/new-role/scripts/check-new-role.sh [repo-root]
# Exits non-zero only on structural breaks. Coverage gaps are warnings.
set -eu
ROOT="${1:-$(cd "$(dirname "$0")/../../.." && pwd)}"
python3 - "$ROOT" <<'PY'
import re, sys, pathlib
root = pathlib.Path(sys.argv[1])
specs = (root / "packages/game-engine/src/games/werewolf/domain/models/roles/spec/specs.ts").read_text()
ids_src = (root / "packages/game-engine/src/games/werewolf/domain/models/roles/spec/nightStepIds.ts").read_text()
res_src = (root / "packages/game-engine/src/games/werewolf/domain/resolvers/index.ts").read_text()
contract = (root / "packages/game-engine/src/games/werewolf/domain/models/roles/spec/__tests__/specs.contract.test.ts").read_text()
role_ids = re.findall(r"^\s+id: '([^']+)',", specs, re.M)
order = re.findall(r"'([a-zA-Z]+)',", ids_src[ids_src.index("NIGHT_STEP_IDS"):ids_src.index("] as const")])
res_keys = re.findall(r"^\s{2}(\w+):", res_src, re.M)
expected = re.search(r"toHaveLength\((\d+)\)", contract)
print(f"roles in ROLE_SPECS: {len(role_ids)}")
print(f"step ids in NIGHT_STEP_ORDER: {len(order)}")
print(f"resolver keys: {len(res_keys)}")
fail = False
if expected and len(role_ids) != int(expected.group(1)):
    print(f"FAIL: role count {len(role_ids)} != contract expectation {expected.group(1)}")
    fail = True
missing = [s for s in order if s not in res_keys]
extra = [k for k in res_keys if k not in order]
if missing:
    print(f"FAIL: step ids without resolver: {missing}"); fail = True
if extra:
    print(f"FAIL: resolver keys with no step id: {extra}"); fail = True
badge = root / "scripts/badge-config.mjs"
if badge.exists():
    em = badge.read_text()
    print(f"WARN: roles without EMOJI_MAP entry: {[r for r in role_ids if f'{r}:' not in em]}")
else:
    print("WARN: badge-config.mjs not found; badge coverage not checked")
sys.exit(1 if fail else 0)
PY
