# Web client

Scope: `packages/web/**` only. Engine rules live in `packages/game-engine/AGENTS.md`; worker rules in `packages/api-worker/AGENTS.md`; E2E rules in `e2e/AGENTS.md`; shared commands and gates in the root file.

## Stack and layout

- React DOM plus plain CSS, built by Vite, routed by React Router (data mode), with TanStack Query, Ark UI, sonner, Zod, and a PixiJS scene layer; versions in `package.json`. It runs in browsers and inside the WeChat mini-program web-view (`packages/web/src/utils/miniProgram.ts`).
- `@/` resolves to `packages/web/src/` (`vite.config.ts` alias, `tsconfig.json` paths). `tsconfig.json` sets `strict` and `noUncheckedIndexedAccess`.
- Scripts: `dev`, `build` (`vite build`, then the per-route gzip budgets in `packages/web/scripts/check-bundle-size.mjs`), `preview`, `bench:scene`, `typecheck`, `test` (Vitest, jsdom, `src/**/*.test.{ts,tsx}`, setup `packages/web/src/test/setup.ts`).
- Every game has a statically imported factory in `CLIENT_GAME_FACTORIES` (`packages/web/src/games/clientModules.tsx`); sessions are initialized on demand. Routes are declared in `packages/web/src/app/routes.tsx` with page code under `packages/web/src/routes/`. Only the scene benchmark content and background-loaded Sentry Replay use dynamic imports, pinned by the root architecture contract and build gate. PixiJS code is eager, but WebGL and audio initialize only when used.
- Deploy builds set `WEB_ASSET_BASE` to the versioned npmmirror CDN address (`vite.config.ts` `base`); public files (`manifest.json`, PWA icons) stay same-origin through `renderBuiltUrl`.
- `packages/web/src/platform/` has five subdirectories: `auth/`, `env/`, `http/`, `inbox/`, `realtime/`.

## Room shell

- Host management is built only when `viewer.isHost`, bottom buttons declare only the audiences `participant` or `anyone`, and host task references are validated at assembly, all enforced by `createRoomShellModel` (`packages/web/src/features/room/model/createRoomShellModel.ts`, which throws on a `participant` button for a viewer holding no seat).
- Audio playback lock: `isAudioPlaybackLocked` plus `applyAudioPlaybackLock` in `packages/web/src/features/room/model/audioPlaybackLock.ts` (non-exempt actions disabled with the single lock reason, press handler dropped, applied once at the game's host-management factory exit), pinned by `packages/web/src/features/room/model/__tests__/audioPlaybackLock.test.ts` and `packages/game-engine/src/platform/audio/__tests__/audioGate.contract.test.ts`.
- Review (本局复盘): every game declares `review: RoomReviewContribution<State>` in `defineClientGameModule` (`packages/web/src/games/model/defineClientGameModule.ts`); its `resolve` maps state and viewer to availability and a `RoomReviewDocument` built from the closed block vocabulary in `packages/web/src/features/room/review/types.ts`. Only `useRoomReview` renders, captures, and shares it, and entries render only through `buildReviewBottomButton` / `buildReviewHostAction`, pinned by `packages/web/src/__tests__/roomReview.contract.test.ts` and `packages/web/src/features/room/review/__tests__/`.
- Room code starts from `useReadyRoomSession` (`packages/web/src/features/room/controllers/useReadyRoomSession.ts`: authenticated user, ready snapshot, single-flight `submit`); a room screen mounts only behind `RoomEntryBoundary`. There is no shared `RoomSession` module.
- Room links live for the room flow: `RoomLinkScope` in `packages/web/src/app/AppRoot.tsx` releases every link outside the current `roomCode` route param and user, so the room page and its subpages share one link.
- In-game seat taps go through `createRoomSeatPressHandler`, which calls the shared `resolveRoomInGameSeatTap`, pinned by `Room seat taps` in `contracts/architecture.contract.test.ts`.
- Werewolf board UI tests mount the production room screen through the harness in `packages/web/src/games/werewolf/room/__tests__/harness/` (alerts recorded from the alert store by `recordAlerts`); `packages/web/src/games/werewolf/room/__tests__/contracts/boardUICoverage.contract.test.ts` requires one board UI test per preset (`BOARD_TEST_FILE_MAP`). Adding a preset follows the new-board skill.

## Layer boundaries

Pinned by `contracts/architecture.contract.test.ts` unless another test is named:

- Routes (`packages/web/src/routes/`) never runtime-import `@/services/`; services never import routes or games.
- Shared room code (`packages/web/src/features/room/`) and product components (`packages/web/src/components/`) import no game implementation, and shared room code uses no game-semantic identifiers (also `packages/web/src/__tests__/roomGameAgnostic.contract.test.ts`).
- One game never imports another. Only `packages/web/src/games/catalog.ts` (Home entries) and `packages/web/src/games/clientModules.tsx` (room factories) compose several concrete games; Home, root navigation, `packages/web/src/app/`, and `packages/web/src/main.tsx` import no concrete game and never branch on a literal game type. A game slice defines no provider or React context and no `facade` identifier.
- Rooms are created only through the shared controller; `RoomCreationService` is composed only in `packages/web/src/app/services.ts`.
- Web Storage is touched only by `packages/web/src/services/infra/localStorage.ts` and `packages/web/src/utils/miniProgram.ts`, and the storage primitive is imported only from a `services/` directory or `packages/web/src/platform/`.
- `RoomLinkImpl` exists once (`packages/web/src/platform/realtime/RoomLink.ts`) and is constructed only by `RoomLinkFactory.ts` and the test harness `packages/web/src/test-utils/roomLink.ts`.
- No custom `React.memo` comparator, pinned by `packages/web/src/__tests__/noCustomMemoCompare.contract.test.ts`.

## Conventions

- Style values in CSS use the custom properties published by `packages/web/src/theme/colors.ts` (`--color-*`, `--report-*`) and `packages/web/src/theme/tokens.css` (sizes, type, radii, shadows), policed by `No hardcoded style values` in `packages/web/src/__tests__/noHardcodedStyleValues.contract.test.ts` (color literals and px token properties; ratchet allowlist; 0/1px allowed).
- Logging goes through `packages/web/src/utils/logger.ts` (`log.extend('Module')`), the only file exempt from `no-console` in this package; errors go through `handleError` in `packages/web/src/utils/errorPipeline.ts`.
- `react/no-danger` is an error for this package in `eslint.config.mjs`: untrusted strings render only through React's escaping. The React Compiler rules of the `eslint-plugin-react-hooks` recommended config stay on, most at error.
- Dialogs go through the alert queue (`showAlert` / `showPrompt` in `packages/web/src/utils/alert.ts`, rendered by `AlertHost`); toasts use the one sonner `Toaster` in `packages/web/src/app/AppRoot.tsx`.
- Test ids live in `TESTIDS` (`packages/web/src/testids.ts`); components and E2E (`e2e/fixtures/app.fixture.ts`, `e2e/helpers/night-driver.ts`) import from it, and `packages/web/src/__tests__/testids.contract.test.ts` pins the seat selectors.
