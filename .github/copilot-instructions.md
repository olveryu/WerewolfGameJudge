## WerewolfGameJudge Copilot Instructions (short)

### 0) Non-negotiables (read first)

- **Host is the ONLY authority for game logic.** Supabase is transport/discovery/identity only.
- **Night## Fix strategy

### Prefer big fixes over small patches

- When fixing a bug, prefer a **single, complete root-cause fix** over multiple small / band-aid patches.
- If the fix requires touching multiple files or layers, that's acceptable—holistic fixes are better than scattered workarounds.
- Do NOT add "temporary" or "partial" fixes unless the complete fix is blocked by an external dependency or explicitly agreed with the user.

### Revert obsolete / wrong fixes after finding root cause

- Once the **true root cause** is identified and fixed:
   1. Audit any prior patches made under a wrong hypothesis.
   2. **Revert** those obsolete patches entirely (don't leave dead / misleading code).
   3. Document in the commit message which earlier commits were reverted and why.
- A single clean fix + revert is better than accumulating layers of "just-in-case" code.

---

## Reporting discipline

- Don't claim changes without evidence.
- For non-trivial work, report:
   - commit hash (or "not committed yet")
   - files changed
   - key symbols changed
   - logical behavior changes
   - verification run (typecheck/Jest/e2e) + outcomecope.** Do NOT add cross-night state/rules.
- **Anti-cheat.** Sensitive info goes via toUid private messages; keep `BroadcastGameState` as room-public view-model only.
- **Single source of truth.** No parallel ordering maps/arrays/dual-write drift.

If something is unclear, ask before coding. Don’t invent repo facts.

**Additional rule:** Follow the architecture constraints in this document exactly; if a requirement or boundary is unclear or conflicts with what you see in the repo, stop and ask the user before making changes.

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

### Directory & file responsibility map (prevent repeat mistakes)

- `src/models/roles/spec/schemas.ts`
   - **Only** the action schema registry `SCHEMAS` (+ schema helpers/types).
   - `SchemaId` is derived from `keyof typeof SCHEMAS`.
   - **Do NOT** put non-night-step configs or “non-schema” rule knobs here (it expands `SchemaId` and breaks night-step typing/contract).
- `src/models/roles/spec/nightSteps.ts`
   - Night-1 step order + audio + visibility **single source of truth**.
   - Each step `id` must be a `SchemaId` that exists in `SCHEMAS`.
- `src/models/roles/spec/index.ts`
   - Public API for declarative spec layer.
   - **Must not export** host-only runtime code (`src/services/**`, resolvers).
- `src/models/roles/spec/wolfMeetingVoteConfig.ts`
   - Wolf-meeting-vote-only restrictions/config **must live here** (or an equivalent dedicated module).
   - This config is **not** a night-step schema; it must **not** be added to `SCHEMAS`.
- `src/services/GameStateService.ts`
   - Host-authoritative runtime gate + message routing.
   - Illegal input must produce private reject receipt (`sendPrivate(toUid, ACTION_REJECTED)`), never public.
- `src/services/types/PrivateBroadcast.ts`
   - **Single source of truth** for private payload union (sensitive info).
   - Reject reasons/reveals must be private (`toUid`).
- `src/screens/RoomScreen/**`
   - UI orchestrator/intent/dialogs only; UI is not the rule authority.
   - Any local “blocked/disabled/selectable” is UX only; Host remains the judge.
- `src/services/__tests__/boards/*.integration.test.ts`
   - Host runtime integration tests (observed facts), using `hostGameFactory.ts`.
- `src/**/__tests__/*.contract.test.ts`
   - “Red line” contract tests: schema/table boundaries, anti-cheat boundaries, single-source-of-truth invariants.

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

- If `StepSpec` has both `id` and `schemaId`, it’s migration-only.
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

- Ban cross-night memory: no `previousActions`, `lastNightTarget`, “连续两晚/第二晚开始” constraints, etc.
- Resolver contexts/types must not carry cross-night fields.

### Neutral judge rule (wolves)

- Wolf kill is neutral in this app: can target ANY seat (including self/wolf teammates).
- Don’t add `notSelf`/`notWolf` constraints for wolf kill.

### Wolf meeting vote vs wolfKill (do not mix)

- `wolfKill` is a Night-1 action schema/step and must remain **neutral judge**.
- Any forbidden-target logic for **wolf meeting vote** (`WOLF_VOTE` messages) must be implemented only in the meeting-vote input gate (host-side) and configured via `wolfMeetingVoteConfig.ts` (or equivalent), **not** via `SCHEMAS.wolfKill`.
- Maintain a contract test that fails if `SCHEMAS.wolfKill` gains a forbidden-target field.

---

## Anti-cheat & broadcast rules

- `BroadcastGameState` is room-public view-model only.
- Sensitive results (seer/psychic reveals, per-player prompts/results) MUST be toUid private messages.
- Any step visibility helpers (e.g. `actsSolo`) must NOT leak into public broadcasts.

---

## Tests & quality gates

### Type-safety rules (avoid papering over bugs)

- **Do not use `as any` / `as unknown as` / `as string[]` (or similar casts) to bypass the type system.**
   - If the code needs a cast, first ask: “Is the type model wrong, or am I comparing the wrong concepts?”
   - Preferred fixes:
      - add/adjust the correct type at the source (e.g. `RoleId`, `SchemaId`)
      - use type guards / narrowing (e.g. `isValidRoleId(x)` before treating `x` as `RoleId`)
      - use discriminated unions instead of casting.
- **Allowed exceptions** (must be documented in code):
   - migration shims with a clear `TODO(remove by YYYY-MM-DD)` and a contract test preventing drift.
- Concrete pitfall to avoid (real incident):
   - Wolf meeting vote restrictions must **not** do `(forbiddenRoles as string[]).includes(targetRole)`.
   - Instead: narrow `targetRole` with `isValidRoleId` and compare `RoleId` vs `RoleId`.

### Anti-guessing discipline (NO speculative tests/logic)

- **No guessing repo behavior.** If unsure, stop and gather evidence (search/read existing tests, inspect the authoritative tables) before writing code.
- **Expected values must come from a source of truth** (not a hardcoded guess):
   - `PRESET_TEMPLATES` (templates)
   - `NIGHT_STEPS` (night order + audio + visibility)
   - `SCHEMAS[*].constraints` (input legality)
   - existing host runtime integration tests (observed facts)
- **Red → Green rule:** for any behavior change (resolver/night flow/visibility/private messages), write a failing test first, then implement until green. Don’t only add tests after code “seems to work”.
- **Never snapshot UI copy as logic.** Assertions must use stable identifiers (SchemaId/roleId/testIDs), not user-facing strings.
- **When changing tables/specs**, update/extend contract tests in the same change so drift is impossible.

### Jest contract tests (required for table-driven night)

Maintain/update contract tests to guarantee:

- `NIGHT_STEPS` reference validity (`roleId` exists; `SchemaId` exists)
- deterministic order (snapshot of step ids)
- uniqueness (step ids)
- Night-1-only red lines
- audioKey non-empty
- anti-cheat boundary (no sensitive fields in public broadcasts)

### E2E rules (Playwright)

- E2E is smoke-only. Never use it as the rule referee.
- Run core e2e with workers=1. Never run multiple e2e processes in parallel.
- Room readiness must use `waitForRoomScreenReady()` (joiner must reach `🟢 已连接` or finish “强制同步”).

### UI test stability (Jest + RNTL)

- Prefer `getByTestId`/`findByTestId`. Don’t add new `UNSAFE_*`.
- Keep testIDs centralized in `src/testids.ts` and preserve legacy IDs via compatibility mapping.

---

## Checklists

### Adding a new role / schema / step

- Add role to `ROLE_SPECS` (`src/models/roles/spec/specs.ts`) and keep `RoleId` derived from registry keys.
- If it acts on Night-1:
   - add/extend `SCHEMAS` (`src/models/roles/spec/schemas.ts`) with schema-first constraints
   - add a step to `NIGHT_STEPS` (`src/models/roles/spec/nightSteps.ts`) with `id: SchemaId`, `audioKey`, `visibility`
   - implement/update resolver under `src/services/night/resolvers/**` (schema-aligned)
   - update contract tests (order snapshot + validity + red lines)

---

## Reporting discipline

- Don’t claim changes without evidence.
- For non-trivial work, report:
   - commit hash (or “not committed yet”)
   - files changed
   - key symbols changed
   - logical behavior changes
   - verification run (typecheck/Jest/e2e) + outcome
