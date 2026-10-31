# Client

Scope: `src/**` only. Engine rules live in `packages/game-engine/AGENTS.md`; worker rules in `packages/api-worker/AGENTS.md`; shared workflow, commands, and gates in the root file. E2E rules live in `e2e/AGENTS.md`.

## Room shell: host management, bottom panel, viewer identity

- Host management exists only for the host, and only the shell factory decides that: `createRoomShellModel` builds it when `viewer.isHost` and returns `null` otherwise. Games pass `buildHostManagement` ungated and must never write their own host guard.
- The host task carries no handler. It references sheet action keys; the factory validates those references at assembly, so a dangling key fails there, not in render. All press behavior lives in the sheet sections.
- Bottom buttons have exactly two audiences, `participant` and `anyone`. There is no host audience: host commands live in host management and reach the host through the task card, never the bottom panel. `participant` requires an effective seat (own seat or a taken-over bot seat); `anyone` is open to spectators.
- Viewer identity has two axes: `isHost` wins, otherwise a null seat means spectator and a seat means seated. Bot takeover is not identity; it only widens the effective seat.
- Disabled state lives on the model (`isEnabled: false` plus a reason); renderers render the shared button disabled. Do not put business gates inside press handlers.

## Werewolf host-only flow

- The Day/Ended flow is last-night info, then review, then closing (`panelFlow.ts`). Day runs only the first step; Ended runs all three.
- Last-night info completes only on host confirmation in its dialog (client-local progress, never room state). The review step completes only when the review was opened and shared: the engine's `nightReviewAllowedSeats` must be non-empty. Merely opening the review does not complete it.
- Spectators get exactly one bottom button, the review, as `primary`. Seated non-hosts get view-identity plus the review button as `ghost` only when they may open it (`canOpenNightReview`); the `ghost` variant belongs to the review button, never to view-identity. No step bar and no host buttons appear on the bottom panel for any non-host audience.

## View identity and board info

- View identity: viewing step renders `primary`, every other phase renders `secondary`, never `ghost`. Size is `md`. A hidden action resolves to `null`, never to a disabled button; the only disabled state is the single-flight command lock. This rule is stated identically for werewolf, Avalon, FibKing, and Undercover only. Do not generalize it to the other games: the drawing/writing games have no view-identity bottom rule in code.
- FibKing is the audience exception: its view button is `anyone`, showing the topic to spectators and the identity to seated players.
- Board info is per-game section assembly with shared card rendering. Werewolf: expanded during setup, collapsed once the game runs (`Ongoing`, `Day`, `Ended`). Avalon: expanded in the lobby, always collapsed in game, using its own adapter component over the shared card. FibKing and Undercover: always expanded (no `collapsed` prop). Pictionary, DrawGuess, StoryRelay, and Demo have no board-info card at all; do not write a collapse rule for them.

## Audio lock

- One predicate: `isAudioPlaybackLocked(isAudioPlaying)` returns its input. One combinator, `applyAudioPlaybackLock`, flips enabled non-exempt actions to disabled with the single reason `语音播报中，请稍候` and drops their press behavior, while exempt actions pass through untouched.
- Werewolf and Avalon host management both declare an empty exemption set today: no host-management action is exempt. An action may be exempt only if it sends no server command, writes no flow progress, and starts no capture or share.
- While audio plays, the werewolf bottom layout collapses to empty for every audience, the bottom message is nulled, and seats are visually disabled. The night policy gate checks the audio lock first. The engine is the backstop: it rejects commands while narration plays.
- Avalon exception, and the only one: its night confirm-info button stays enabled during audio, deliberately, so confirmation runs in parallel with narration. Do not generalize this into an exemption mechanism.
- No additional Ended-specific audio rule exists in code beyond the collapse and empty exemption set above. Do not write one as if it did; any further Ended change is undecided.
- Only the host plays narration. UI never plays audio in effects and never toggles the playing flag; the flag is owned by the audio-queue events only. Acknowledgement is `<game>.audio.ack` carrying the batch id, dispatched durable.

## Sheriff secrecy and night review

- Sheriff registration secrecy is enforced by one shared derivation: candidate records return `null` during `registration`. During that phase no surface (panel, review, host included) may display the count or list; only the viewer's own registration state is exposed. The raw `registeredSeats` array is present in broadcast state, so the rule is about display, never about a claim that the engine withholds the field.
- Open voting rounds expose counts only. Closed rounds expose the full tally re-derived from ballots. Individual in-progress ballots are never exposed beyond the viewer's own ballot.
- The engine settles the wolf-kill target and verdict once, in one persisted action. The client renders the engine verdict only and never recounts votes: an unrecorded verdict renders as tie-pending even when the votes are unanimous. The night review is one shared derivation rendered by one shared body; the sheriff section inside it comes from the same record as the panel.

## Avalon record, review, and settle countdown

- The mid-game record above the seat board shows only public, settled information: never identities, unsettled ballots, or Lady check results. In dark-vote mode ballots are counts only.
- The end review renders only at `ended`, in fixed order: conclusion, identities, configuration, Lady chain (complete, with results), quest progress. Lady results are private to the holder during play (`ladyCheckResult` is non-null only for the holder seat); the review derives them from revealed ended identities. Who was checked is public history in both faces; the result is not in the mid-game record.
- Settle countdown: `SETTLE_COUNTDOWN_MS = 5000`, one arm decision, no manual finish command. Client expiry submission is acceleration only; the server's scheduled settle is the correctness path, and host status never gates it.

## Confirmations, modals, logging, theme, types

- Confirmations: call `showAlert`/`showPrompt` from `@/utils/alert`, or render `AlertModal` directly. Never call the platform alert directly in UI code; its only production caller is the fallback inside the alert helper itself.
- Modals: import `Modal` only from `@/components/AppModal`. Importing it from the platform library is a lint error; the only production import of the platform modal is inside `AppModal` itself.
- Logging: named loggers from `src/utils/logger.ts` (`log.extend('Module')`). `console.*` is a lint error, exempt only in `jest.setup.ts`, `__mocks__/**`, `e2e/helpers/diagnostics.ts`, and the worker logger. Catch blocks call `handleError`, which classifies abort/expected/unexpected (unexpected: error log plus error reporting plus UI feedback; expected: warn plus UI feedback).
- Theme: import tokens from `@/theme` (`colors`, `spacing`, `typography`, `borderRadius`, `shadows`, and the rest). The hardcoded-value contract test scans production UI files: `fontSize` numbers, `padding`/`margin`/`gap`/`borderRadius` numbers at 2 or above, digit `fontWeight` strings, and color literals must use tokens. Literals 0/1 are allowed. Excluded directories are `RoleRevealEffects`, `AIChatBubble`, `avatarFrames`, `seatAnimations`, `seatFlairs`, `seatPets`, `__tests__`, `__mocks__`; excluded files are `ErrorBoundary.tsx`, `SkiaShaderWarmup.tsx`, `WxLoginFailedScreen.tsx`. Known violations are pinned per file in a ratchet allowlist that can only decrease.
- Type honesty: no ordinary assertions in production files across all three packages; only `as const` is allowed (both `x as T` and `<T>x` are violations, pinned by contract tests). The six `no-unsafe-*` lint rules are errors, and `no-explicit-any` is an error.
- Schema boundaries: permissive `z.object` is allowlisted to exactly eight worker files for external provider payloads (listed by the architecture contract test). Do not claim a client-side strict-schema contract test exists; none was found. Realtime protocol parsing uses strict schemas.

## Platform split and layer boundaries

- `src/platform/` has five subdirectories: `env/`, `auth/`, `http/`, `realtime/`, `inbox/`. Product HTTP goes through `ApiClient` (bearer auth with one refresh-and-retry, deadline, retry for idempotent requests only; every failure is an `ApiError`).
- Room commands go only through `RoomLink.dispatch`, over one `POST /room/command` per send, correlated by `commandId`. Never send a room command through `ApiClient`. Snapshots and presence arrive over the socket. Room code starts from `useReadyRoomSession` (authenticated, ready session, single-flight submit); there is no shared `RoomSession` module.
- RoomLink is the link implementation; the wire protocol is v2. One room, one identity, one epoch. Reconnection is unbounded with full-jitter backoff capped at 10 seconds, driven by a pure reducer; only terminal close codes (1002, 4000–4003) stop it. 4004 (rate-limited) is not terminal. Durable intents persist locally and replay with the same `commandId` until the server decides.
- Layer boundaries pinned by contract test: screens never import services at runtime; shared room code imports no game code and uses no game-semantic identifiers; no cross-game imports; no `facade` identifiers; persistent storage is consumed only from the single infra storage module.

## Naming and documentation style

- Grep before naming. Booleans use `is`/`has`/`should`; foreign keys use `<entity>Id`; an entity's own primary key is `id`. These are conventions, not lint-enforced rules.
- The linter enforces a naming convention at warning level and consistent type-only imports at error level. No documentation-comment rule is enforced by the linter; follow the module-header style of the file being edited and do not invent a documentation gate. Commit headers are limited to 100 characters by the commit config; no body/footer line limit is enforced there.
