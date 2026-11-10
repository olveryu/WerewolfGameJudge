# Confirm pipeline — only the verified surface

## Where it lives

- Engine: `packages/game-engine/src/games/werewolf/domain/handlers/confirmContext.ts`
- Client display: part of the werewolf web client, which lands in P3
  (`docs/web-client-rewrite.md` §8.2). In the removed client (last
  present in commit `ccedf18b5`) the night-interaction resolver read
  schema text through `requireSchemaText` for `confirmTitle` /
  `confirmText` and related fields.
- Schema UI type: `ConfirmStatusUi` in
  `.../roles/spec/schema.types.ts` (discriminant `kind`, with shoot /
  faction / wolf-teammates / infection variants).

## Verified facts only

- `ConfirmRole` is exactly five roles: `'hunter' | 'darkWolfKing' |
'avenger' | 'hiddenWolf' | 'seedWolf'` (`confirmContext.ts`).
- `CONFIRM_STEP_ROLE` is derived from the role specs
  (`deriveConfirmStepRoleMap`), and `computeConfirmStatus` computes the
  status for one of those roles. A confirm-kind step for any other role
  throws at module init (`deriveConfirmStepRoleMap`, `Unsupported
confirm role`).
- A role is a confirm role only if its step is a confirm step in the
  spec. Read `confirmContext.ts` before adding a confirm step to any
  other role.

## Not verified for this draft

The internal computation of `computeConfirmStatus` and the
per-variant reference behaviour were not verified line-by-line. Read
`confirmContext.ts` before touching confirm behaviour, and do not
paste a pipeline description from older text.
