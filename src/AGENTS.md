# Client

Scope: `src/**` only. Engine rules live in `packages/game-engine/AGENTS.md`; worker rules in `packages/api-worker/AGENTS.md`; shared workflow, commands, and gates in the root file. E2E rules live in `e2e/AGENTS.md`.

## Room shell

- Host management is built only when `viewer.isHost`, bottom buttons declare only the audiences `participant` or `anyone`, and host task references are validated at assembly, all enforced by `createRoomShellModel` (`src/features/room/model/createRoomShellModel.ts`, which throws on a `participant` button for a viewer holding no seat).

## Sheriff secrecy and night review

- Sheriff candidate records return `null` during `registration` (`getSheriffCandidateRecords`, `packages/game-engine/src/games/werewolf/domain/review/sheriffElectionRecord.ts`), the single derivation shared by the panel and the night review.
- The wolf-kill target and verdict are computed once, in one persisted action (`packages/game-engine/src/games/werewolf/domain/handlers/wolfKillResolution.ts`), and the client renders the recorded verdict only.

## Settle countdown

- Settlement uses one arm decision (`decideSettleCountdownArm`, `SETTLE_COUNTDOWN_MS = 5000`) with no manual finish, pinned by `settleCountdown.contract.test.ts` (`packages/game-engine/src/platform/room/settleCountdown.ts`).

## Enforced conventions, platform split, and layer boundaries

- Import `Modal` only from `@/components/AppModal`, enforced by `no-restricted-imports` in `eslint.config.mjs` (the only exemption is `AppModal` itself).
- `console.*` is a `no-console` error in `eslint.config.mjs`, exempt only in `jest.setup.ts`, `__mocks__/**`, `e2e/helpers/diagnostics.ts`, and the worker logger, with named loggers from `src/utils/logger.ts` (`log.extend('Module')`).
- Style values use `@/theme` tokens, policed by `No hardcoded style values` in `src/__tests__/noHardcodedStyleValues.contract.test.ts` (ratchet allowlist, 0/1 literals allowed).
- No ordinary assertions in production files: only `as const` is allowed, pinned by `Production types: no ordinary assertions` in `src/__tests__/architecture.contract.test.ts`; the six `no-unsafe-*` lint rules and `no-explicit-any` are errors in `eslint.config.mjs`.
- Permissive `z.object` appears only in the 8 worker files listed by `uses permissive Zod objects only for external provider payloads` in `src/__tests__/architecture.contract.test.ts`, all external provider payloads.
- `src/platform/` has five subdirectories: `env/`, `auth/`, `http/`, `realtime/`, `inbox/`.
- Room code starts from `useReadyRoomSession` (authenticated, ready session, single-flight submit); there is no shared `RoomSession` module.
- Layer boundaries are pinned by `architecture.contract.test.ts`: screens never runtime-import services; shared room code imports no game code and uses no game-semantic identifiers; no cross-game imports; no `facade` identifiers; persistent storage is consumed only from the single infra storage module.
- Naming conventions are enforced by the linter at warning level and consistent type-only imports at error level in `eslint.config.mjs`; commit headers are capped at 100 characters by `commitlint.config.js`.
