# Migration: <short-title>

> Owner: <name/handle>
> Started: YYYY-MM-DD
> Target removal date: YYYY-MM-DD
>
> **Rule:** Any temporary compatibility/fallback MUST be removed by the target date.

## Goal

- Replace: `<legacy symbol / module / behavior>`
- With: `<new symbol / module / behavior>`

## Scope / non-goals

- ## In scope:
- ## Out of scope:

## Temporary compatibility inventory (single source of truth)

List every temporary shim/dual-write/fallback that still exists.

| Item | Location (file + symbol)        | Temporary behavior                 | Replacement           | Removal criteria                        | Deadline   |
| ---- | ------------------------------- | ---------------------------------- | --------------------- | --------------------------------------- | ---------- |
| 1    | `path/to/file.ts` `legacyFoo()` | e.g. fallback if `nightFlow==null` | `NightFlowController` | all call-sites migrated + tests updated | YYYY-MM-DD |

## Progress checklist

### Code call-sites

- [ ] Migrate `<call-site A>` (file: `...`)
- [ ] Migrate `<call-site B>` (file: `...`)

### Tests

- [ ] Add/adjust contract tests for new behavior
- [ ] Remove legacy tests that enforce old behavior

### Guardrails (must-have)

- [ ] `@deprecated` + `TODO(remove by YYYY-MM-DD)` added to every temporary symbol
- [ ] Block new usages (eslint rule / no-export / grep test)
- [ ] “Fails-after-deadline” test exists (or equivalent enforcement)

## Validation

Record what gates were run and the results.

- Typecheck: PASS/FAIL
- Jest: PASS/FAIL
- E2E: PASS/FAIL

## Notes

- Risks:
- Rollback plan:
- Follow-ups:
