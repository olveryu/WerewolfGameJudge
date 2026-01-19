## WerewolfGameJudge Copilot Instructions

### 0) Non-negotiables (read first)

- **Host is the ONLY authority for game logic.** Supabase is transport/discovery/identity only.
- **Offline local play.** This is a local/offline game assistant. Host device is also a player, not a separate referee device.
- **Night-1-only scope.** Do NOT add cross-night state/rules.
- **All state via BroadcastGameState.** All game information (including role-specific context like witch's killedIndex, seer's reveal result) is broadcast publicly via `BroadcastGameState`. UI filters what to display based on the player's role. This simplifies the architecture and eliminates Host/Player state sync issues.
- **Single source of truth.** No parallel ordering maps/arrays/dual-write drift.
- **Prefer libraries over custom code.** When adding new capabilities (logging, validation, etc.), search for established npm libraries first. Only write custom code if no suitable library exists or the library is overkill for the use case.

If something is unclear, ask before coding. Don't invent repo facts.

---

## Architecture boundaries

### Host vs Supabase

- Host controls: night flow, validation, resolver execution, death calculation, audio sequencing.
- Supabase controls: room lifecycle (4-digit code), presence, auth metadata, realtime transport.
- Supabase must NOT store/validate any game state, actions, votes, results.

### Code ownership boundaries

- `src/models/roles/**`: declarative only (spec/schema/types). No services, no side effects.
- `src/services/night/resolvers/**`: host-only pure resolution + validation.
- `src/screens/RoomScreen/components/**`: UI-only, no service imports.

### Logging

- **Use structured loggers** from `src/utils/logger.ts` (e.g., `gameRoomLog`, `roomScreenLog`, `gameStateLog`).
- **Add logs for key events**: state transitions, action submissions, errors, and decision branches.
- **Log format**: Include context (e.g., `[RoomScreen]`, `[GameStateService]`) and relevant data.
- **Debug vs Error**: Use `.debug()` for normal flow tracing, `.warn()` for recoverable issues, `.error()` for failures.

---

## Night flow & NightPlan (host authority)

### NightFlowController invariants

- `NightFlowController` is the single source of truth for night progression.
- When `isHost === true` and `state.status === ongoing`, `nightFlow` MUST be non-null (fail-fast if violated).
- Do NOT advance indices manually (`++` fallback is banned).
- Phase mismatch events are idempotent no-ops (debug only).

### Table-driven NightPlan single-source-of-truth

- Night-1 progression MUST come from a single table-driven plan.
- **Authoritative table (Night-1):** `NIGHT_STEPS` in `src/models/roles/spec/nightSteps.ts`.
  - Array order is the authority order.
  - Step id MUST be a stable `SchemaId`.
  - Do NOT reintroduce `night1.order` or any parallel `ACTION_ORDER`.
- Plan builder MUST fail-fast on invalid `roleId` / `schemaId`.
- Do NOT use UI copy as logic keys; tests must assert stable identifiers.

### Audio sequencing single source of truth

- Night-1 `audioKey` / optional `audioEndKey` MUST come from `NIGHT_STEPS`.
- Do NOT dual-write audio keys across specs/steps. If a temporary compat is needed: `@deprecated` + removal date + contract test enforcing equality.

### StepSpec id/schemaId de-dupe (migration rule)

- If `StepSpec` has both `id` and `schemaId`, it's migration-only.
  - `schemaId` must be `@deprecated` + `TODO(remove by YYYY-MM-DD)`.
  - Keep a contract test enforcing `step.id === step.schemaId`.
- End-state: only `id: SchemaId`.

---

## Constraints, validation, and Night-1-only red lines

### Schema-first constraints

- Input legality belongs in `SCHEMAS[*].constraints` (schema-first).
- Host resolvers MUST align with schema constraints.
  - If schema says `notSelf`, resolver must reject self-target.
  - If schema allows self-target, resolver must not reject it unless documented + tested.

### Night-1-only bans

- Ban cross-night memory: no `previousActions`, `lastNightTarget`, "连续两晚/第二晚开始" constraints, etc.
- Resolver contexts/types must not carry cross-night fields.

### Neutral judge rule (wolves)

- Wolf kill is neutral in this app: can target ANY seat (including self/wolf teammates).
- Don't add `notSelf`/`notWolf` constraints for wolf kill.

---

## Broadcast architecture (no private messages)

- **All game state is public.** `BroadcastGameState` contains all information including role-specific data.
- **UI-level filtering.** Client UI decides what to display based on `myRole`:
  - Witch sees `witchContext.killedIndex` only if `myRole === 'witch'`
  - Seer sees `seerReveal.result` only if `myRole === 'seer'`
  - Wolves see `wolfVoteStatus` only if `isWolfRole(myRole)`
- **No PRIVATE_EFFECT.** All private message infrastructure has been removed for simplicity.
- **Host and Player read from same state.** No sync issues between Host local state and broadcast state.

---

## Night action role checklist (MUST follow for every role)

When implementing or modifying a night-action role:

1. **Nightmare block logic**
   - Every night-action role MUST handle being blocked by nightmare
   - Check `currentNightResults.blockedSeat === actorSeat` in resolver
   - If blocked: return `{ valid: true, result: {} }` (no effect, but valid)

2. **Context in BroadcastGameState**
   - Roles that need context MUST have it in `BroadcastGameState`:
     - `witch` → `witchContext: { killedIndex, canSave, canPoison }`
     - `hunter` / `darkWolfKing` → `confirmStatus: { role, canShoot }`
   - Roles that reveal info MUST have result in `BroadcastGameState`:
     - `seer` → `seerReveal: { targetSeat, result }`
     - `psychic` → `psychicReveal: { targetSeat, result }`
     - etc.

3. **UI reads from gameState**
   - Client reads from `gameState.witchContext`, `gameState.seerReveal`, etc.
   - UI filters by `myRole` to decide what to display

4. **Schema alignment**
   - Resolver validation MUST match schema constraints
   - If schema says `notSelf`, resolver MUST reject self-target

---

## Tests & quality gates

### Linting (ESLint + Prettier)

- **After any code change**, run `npm run lint:fix` and `npm run format:write` to ensure zero errors/warnings.
- **Unused variables**: prefix with `_` (e.g., `_unusedParam`) to satisfy `@typescript-eslint/no-unused-vars`.
- **React hooks exhaustive-deps**:
  - If a dependency is intentionally omitted, add `// eslint-disable-next-line react-hooks/exhaustive-deps` with a comment explaining why.
  - If a dependency is missing, add it to the dependency array.
  - If a dependency is unnecessary, remove it.
- **Do NOT disable linting rules globally** without explicit approval. Prefer per-line disable comments with justification.
- **Prettier**: use default config. Run `npm run format:write` before committing.

### Jest contract tests (required for table-driven night)

Maintain/update contract tests to guarantee:

- `NIGHT_STEPS` reference validity (`roleId` exists; `SchemaId` exists)
- deterministic order (snapshot of step ids)
- uniqueness (step ids)
- Night-1-only red lines
- audioKey non-empty

### E2E rules (Playwright)

- E2E is smoke-only. Never use it as the rule referee.
- Run core e2e with workers=1. Never run multiple e2e processes in parallel.
- Room readiness must use `waitForRoomScreenReady()` (joiner must reach `🟢 已连接` or finish "强制同步").

### UI test stability (Jest + RNTL)

- Prefer `getByTestId`/`findByTestId`. Don't add new `UNSAFE_*`.
- Keep testIDs centralized in `src/testids.ts` and preserve legacy IDs via compatibility mapping.

---

## Checklists

### Adding a new role / schema / step

- Add role to `ROLE_SPECS` (`src/models/roles/spec/specs.ts`) and keep `RoleId` derived from registry keys.
- If it acts on Night-1:
  - add/extend `SCHEMAS` (`src/models/roles/spec/schemas.ts`) with schema-first constraints
  - add a step to `NIGHT_STEPS` (`src/models/roles/spec/nightSteps.ts`) with `id: SchemaId`, `audioKey`, `visibility`
  - implement/update resolver under `src/services/night/resolvers/**` (schema-aligned)
  - **if blockable by nightmare:** add block check in resolver (`currentNightResults.blockedSeat === actorSeat`)
  - **if needs context at turn start:** add field to `BroadcastGameState` + Host sets it + UI reads it
  - **if reveals info after action:** add field to `BroadcastGameState` for result
  - update contract tests (order snapshot + validity + red lines)

---

## Fix strategy

### Prefer big fixes over small patches

- When fixing a bug, prefer a **single, complete root-cause fix** over multiple small / band-aid patches.
- If the fix requires touching multiple files or layers, that's acceptable—holistic fixes are better than scattered workarounds.
- Do NOT add "temporary" or "partial" fixes unless the complete fix is blocked by an external dependency or explicitly agreed with the user.

### Revert obsolete / wrong fixes after finding root cause

- Once the **true root cause** is identified and fixed:
  1.  Audit any prior patches made under a wrong hypothesis.
  2.  **Revert** those obsolete patches entirely (don't leave dead / misleading code).
  3.  Document in the commit message which earlier commits were reverted and why.
- A single clean fix + revert is better than accumulating layers of "just-in-case" code.

---

## Reporting discipline

- Don't claim changes without evidence.
- For non-trivial work, report:
  - commit hash (or "not committed yet")
  - files changed
  - key symbols changed
  - logical behavior changes
  - verification run (typecheck/Jest/e2e) + outcome

---

## Terminal command rules

- **No `| head` or `| tail` piping.** Run commands without output truncation so you can see the full result.
- If output is very long, use `grep` to filter relevant lines instead of head/tail.
