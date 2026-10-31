# Board integration test and coverage contract

## Harness

Tests live in `src/games/werewolf/__tests__/engine/boards/`. The
correct imports, verified against the guard test:

```ts
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import type { GameContext } from './gameContext';
import { cleanupGame, createGame } from './gameFactory';
import { executeFullNight } from './stepByStepRunner';
```

`createGame` takes a preset name (or a role list) plus an optional
seat-to-role assignment map; `executeFullNight` drives the whole
first night. `GameContext` is imported as a type from
`./gameContext` — not from `gameFactory`. A test must assert at
least one topic-specific outcome (a reveal, a night result, or an
action record), not deaths alone.

Name a new test file
`night1.<topic>.<role-feature>.<N>p.integration.test.ts`, where `<N>`
is the `roles` entry count including bottom cards, following the
existing files (`night1.guard.blocks_wolfkill.12p.integration.test.ts`,
`night1.thiefCupid.14p.integration.test.ts`,
`night1.treasureMaster.choose.15p.integration.test.ts`). The file
declares `const TEMPLATE_NAME = '<board name>';` and passes it to
`createGame`.

## Coverage contract — 12-seat boards only

`night1.boards.coverage.contract.test.ts` requires a test file for
each of 14 boards in `REQUIRED_12P_TEMPLATES`, matched by a
`TEMPLATE_TO_TEST_PATTERN` regex on the `TEMPLATE_NAME` assignment,
and requires at least one theme assertion (night results, a reveal,
a converted seat, or an action record). At drafting time the list
has 14 of the 26 presets. A new board that seats 12 players joins
this list (add the name and its regex). A board with any other seat
count has no coverage-contract entry today: do not add it to the
12-player list, and record the gap in the work notes instead of
inventing a rule for it.

## Other contract tests

- `Template.contract.test.ts` — preset self-consistency and the
  expected-name list (see `references/preset-rules.md`).
- `nightPlanSchemas.contract.test.ts` — every preset in
  `PRESET_TEMPLATES` produces a valid step sequence with valid step
  counts and audio keys.

## E2E

A board change does not automatically need a new E2E spec. If one is
proposed, it follows the new-e2e-spec skill: report first, one spec
per change, real multi-context seats. The board picker page object
exposes `selectTemplate(name)` / `selectDefaultTemplate()` — there is
no `selectPreset` method; do not write one into a spec.
