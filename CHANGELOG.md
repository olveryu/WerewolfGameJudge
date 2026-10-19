# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Conventional Commits](https://www.conventionalcommits.org/).

## [2.8.0] - 2026-10-19

- docs(announcements): add v2.8.0 What's New entry
- Merge pull request #219 from olveryu/fix/announcement-changelog-first
- fix(home): changelog tab leads the announcement modal and is its default page
- Merge pull request #218 from olveryu/feat/e2e-flake-ledger
- fix(ci): close QA findings — digest waits for unit jobs, ledger state anchored
- feat(ci): flake ledger — rolling issue accounting for e2e and unit failures
- Merge pull request #217 from olveryu/feat/e2e-gate-decoupling
- Revert "test(tmp): break one unit test for PR-2 live gate check"
- test(tmp): break one unit test for PR-2 live gate check
- feat(ci): decouple e2e gate, add ci-gate aggregate check
- Merge pull request #216 from olveryu/feat/e2e-failure-bundle
- fix(ci): combine e2e reporters into one comma-joined flag
- feat(ci): e2e failure digest comment and investigation guide
- feat(e2e): failure bundle reporter with per-attempt errors
- Merge pull request #215 from olveryu/refactor/bottom-layout-unification
- refactor(room): unify bottom actions on the stacked three-tier model
- Merge pull request #212 from olveryu/fix/host-start-confirm
- test(e2e): confirm the host-action dialog in drawguess start step
- test(e2e): confirm the host-action dialog in storyrelay start step
- test(e2e): confirm the host-action dialogs in undercover start steps
- test(e2e): confirm the host-action dialogs in avalon start steps
- feat(admin): add normal x10 supply button and fix force x10 styling
- test(e2e): confirm the host-action dialog in pictionary startRound
- test(e2e): confirm the host-action dialog in fibking start flows
- Merge remote-tracking branch 'origin/main' into fix/host-start-confirm
- test(avalon): read the assassination target from the dealt roles
- refactor(werewolf): converge host flow actions onto the shared command pipeline (#213)
- refactor(pictionary): settle the round when the final step completes (#211)
- fix(room): start confirms live on the action, not the console
- Merge pull request #210 from olveryu/feat/room-guidance-prc
- feat(werewolf): seat-action prompt becomes a schema contract
- feat(room): guidance matrix registry contract and generator templates
- feat(room): guidance matrix for werewolf, guide derivation extracted
- feat(room): guidance matrix for demo
- feat(room): guidance matrix for drawguess
- feat(room): guidance matrix for storyrelay
- feat(room): guidance matrix for pictionary
- feat(room): guidance matrix for undercover
- feat(room): guidance matrix for fibking
- feat(room): guidance matrix declaration and contract, avalon first
- feat(room): shared view-identity action definition factory
- test(avalon): pin night step narration keys to literal values (#209)
- refactor(audio): extract shared client audio core and bind werewolf/avalon to it (#208)
- test(avalon): pin draft-mirror follow-ups (rejected draft propose, bot leader takeover) (#207)
- refactor(avalon): align night stepping with declarative steps and one completion evaluation (#206)
- test: stub-strengthening batch (submitting pins, VM cross-check, hero fold) + doc fixes (#204)
- Merge pull request #205 from olveryu/fix/avalon-pick-optimistic-mirror
- Merge pull request #203 from olveryu/refactor/e3-audio-engine-core
- feat(avalon): show nomination picks from the seat picking mirror
- refactor(avalon): run the audio queue on the shared platform machine
- refactor(werewolf): run the audio queue on the shared platform machine
- feat(engine): add shared platform audio queue machine
- Merge pull request #202 from olveryu/feat/room-guidance-prb
- feat(room): add optimistic mirror to seat picking room storage
- revert(room): withdraw the G-3 day guide; the state it served does not exist
- test(e2e): pin the story relay gallery viewer notice
- test(werewolf): pin the day host wait at the adapter level, revert seer-flow detour
- test(e2e): spare the lone villager so the seer flow reaches a day phase
- test(e2e): pin werewolf step wait and day host wait
- test(e2e): pin avalon night wait, vote count, lady process and ended wait
- test(e2e): pin undercover lobby, speaking-order and aborted waits
- test(demo): pin the ended waiting message on the generated game
- fix(room): scope night wait to non-actioners, wire ended wait into demo and templates
- fix(avalon): single source for the ended wait, precise lady process copy
- feat(storyrelay,drawguess): gallery viewer notice and round-end wait
- feat(werewolf): personified night wait and daytime host wait
- feat(avalon): night, vote, lady and ended waiting messages
- feat(undercover): phase waiting messages in the bottom panel
- feat(room): shared waiting-message builders for the bottom panel
- Merge pull request #201 from olveryu/feat/room-guidance-redesign-pra
- test(e2e): make the story-relay editor floor relative to the viewport
- fix(room): keep the pictionary drawing usable at short viewport heights
- test(e2e): poll for the wolf prompt in the night-flow death-message test
- feat(room): add shell phase anchor and bind night-end detection to it
- fix(werewolf): restore the Ended settlement line for every viewer
- Merge remote-tracking branch 'origin/main' into feat/room-guidance-redesign-pra
- test(e2e): probe fibking ongoing via the reveal action, not the ribbon
- test(e2e): force the disabled start-button press attempt in drawguess
- test(e2e): register the retired undercover aborted line in the spec
- docs(platform): drop the remaining present-tense status ribbon claims
- docs(platform): sync the shell structure to the guidance redesign
- fix(werewolf): carry the Assigned viewing count on the start action
- test(e2e): assert the drawguess gate reason on the console
- chore: retrigger CI
- test: fix full-jest fallout from the guidance redesign
- docs: record the room guidance redesign in the game design docs
- test(pictionary): pin the bottom progress derivation
- test(e2e): undercover spec asserts console and management signals
- feat(undercover): carry the winner line on the results surface
- test(e2e): fibking-responsive spec asserts the console primary for a full lobby
- test(e2e): fibking spec asserts the console primary for a full lobby
- test(e2e): drawguess spec follows the retired disabled-press popup
- test(e2e): avalon spec asserts the console instead of the ribbon
- test(e2e): point helpers and pages at the console primary
- test(room): pin the one-reason-one-screen console contract cross-game
- feat(templates): sync new-game templates to the console model
- fix(room): make the game summary subtitle optional
- feat(demo): rewire room guidance to the console model
- feat(drawguess): rewire room guidance to the console model
- feat(storyrelay): rewire room guidance to the console model
- feat(pictionary): rewire room guidance to the console model
- feat(undercover): rewire room guidance to the console model
- feat(fibking): rewire room guidance to the console model
- feat(avalon): rewire room guidance to the console model
- feat(werewolf): rewire room guidance to the console model
- feat(room): merge host guidance into one console model, drop status ribbon
- Merge pull request #200 from olveryu/fix/seats-not-full-copy
- fix(copy): drop bot mention from seats-not-full message
- Merge pull request #199 from olveryu/feat/next-step-guidance-pr1
- Merge branch 'main' into feat/next-step-guidance-pr1
- test(e2e): scope drawguess seat-gate alert assertion to the alert
- fix(undercover): use player seat-count wording for the lobby start caption
- feat(new-game): emit next step from both generator templates
- feat(demo): derive host next step for assignment and game start
- feat(drawguess): derive host next step and prefix the lobby preview
- feat(storyrelay): derive host next step and prefix the lobby preview
- feat(pictionary): derive host next step for game start
- feat(undercover): add lobby and viewing next steps with previews
- feat(fibking): derive host next step beside the phase preview
- feat(avalon): derive host next step and prefix management previews
- feat(werewolf): derive host next step for assignment and game start
- feat(room): add next-step strip and inline disabled reasons
- Merge pull request #198 from olveryu/chore/e2e-page-orphan-cleanup
- chore(e2e): remove orphaned page object methods
- Merge pull request #195 from olveryu/refactor/au39-werewolf-visibility
- test(werewolf): match plain dotted reads in the AU-39 projection scan
- Merge branch 'main' into refactor/au39-werewolf-visibility
- Merge pull request #197 from olveryu/refactor/seat-picking-draft
- test(e2e): assert the nomination draft badges sync to a second player
- refactor(room): extract the seat picking mechanism
- feat(avalon): move the nomination draft to the server
- Merge pull request #196 from olveryu/refactor/e4-avalon-settle-expire
- test(engine): pin the pictionary expire seat gate, fix avalon settle comments
- refactor(avalon): unify settle timeout commands as phase expire and settleExpired
- test(werewolf): carry the view model in room hook test mocks
- refactor(relay): share the phase expiry guard sequence
- Merge pull request #194 from olveryu/feat/avalon-seat-board-picking-c8
- test(werewolf): pin the view model as the only projection entry (AU-39 slice 4)
- refactor(werewolf): consume the AU-39 view model in room hooks and executors
- fix(werewolf): align view model display name fallback with the client rule
- refactor(avalon): remove the unreachable isAlone night branch
- feat(avalon): route early strike picking through the seat board
- Merge pull request #193 from olveryu/refactor/au39-werewolf-visibility
- feat(werewolf): add AU-39 slice 1 getWerewolfViewModel engine projection
- Merge pull request #192 from olveryu/feat/stage-frame-c7
- test(werewolf): add AU-39 slice 0 visibility characterization tests
- chore(new-game): use shared StageFrame in the stage template
- refactor(pictionary): pin waiting-stage heading via shared StageFrame
- refactor(drawguess): consume shared StageFrame for stage views
- feat(room): add shared StageFrame with pinned header
- Merge pull request #191 from olveryu/feat/seat-data-source-c2
- chore(generator): emit seat data sources through the shared factory
- refactor(games): build seat data sources through the shared factory
- feat(room): add shared seat data source factory
- Merge pull request #190 from olveryu/feat/host-action-marshal-c4
- Merge pull request #189 from olveryu/fix/game-picker-page-and-art
- Merge pull request #188 from olveryu/feat/status-ribbon-c1-c6-c9
- refactor(undercover): switch host actions to shared pending marshal
- refactor(avalon): switch finish actions to shared pending marshal
- refactor(fibking): switch host actions to shared pending marshal
- refactor(room): extract pending-aware host action marshal to shared model
- Merge pull request #186 from olveryu/feat/platform-factories-w4-w11
- feat(home): turn the game picker into a real stack page
- Merge pull request #187 from olveryu/refactor/e2e-spec-reorg-b
- Merge remote-tracking branch 'origin/main' into feat/platform-factories-w4-w11
- refactor(templates): generator adapters use ribbon factory and lobby hint
- refactor(werewolf): single source for host phase status copy
- test(ci): repin deploy-frontend needs literal to the split check jobs
- refactor(fibking): single source for phase status copy
- refactor(games): adopt shared lobby host-start hint in four adapters
- refactor(games): adopt statusRibbon factories in five game adapters
- ci: pass --shard without a '--' separator so sharding actually engages
- fix(home): give featured picker art an explicit size so web cover-crops it
- feat(room): add shared lobby host-start hint to RoomBottomActions
- Merge pull request #185 from olveryu/feat/platform-media-w12-r2
- ci: split lint and root tests out of the quality job
- refactor(client): assemble session game modules through defineClientGameModule
- refactor(worker): move three copied module defaults into defineWorkerGameModule
- ci(e2e): sync shard lists with Phase B spec names
- docs(e2e): sync spec references for Phase B renames
- refactor(e2e): rename offline-recovery-canary.spec.ts to resilience-offline-canary.spec.ts
- refactor(e2e): rename db-recovery.spec.ts to resilience-db-recovery.spec.ts
- refactor(e2e): rename restart.spec.ts to resilience-restart.spec.ts
- refactor(e2e): rename rejoin.spec.ts to resilience-rejoin.spec.ts
- refactor(e2e): rename reconnect.spec.ts to resilience-reconnect.spec.ts
- refactor(e2e): rename room-lifecycle.spec.ts to app-room-lifecycle.spec.ts
- refactor(e2e): rename entry-flow.spec.ts to app-entry-flow.spec.ts
- refactor(e2e): rename home.spec.ts to app-home.spec.ts
- refactor(e2e): rename config.spec.ts to werewolf-config.spec.ts
- refactor(e2e): rename seating.spec.ts to werewolf-seating.spec.ts
- refactor(e2e): rename sheriff-election.spec.ts to werewolf-sheriff-election.spec.ts
- refactor(worker): converge duplicate drawing write/read scaffolds (R2)
- Merge pull request #184 from olveryu/refactor/e2e-spec-reorg-a
- Merge pull request #183 from olveryu/feat/game-picker-library
- refactor(worker): share png drawing upload validation in platform (W12)
- ci(e2e): rebalance shards to 9 by measured runtime, rename spec references
- refactor(e2e): rename night-roles-gargoyle.spec.ts to werewolf-night-gargoyle
- refactor(e2e): rename night-roles-piper.spec.ts to werewolf-night-piper
- refactor(e2e): rename night-roles-protect.spec.ts to werewolf-night-protect
- refactor(e2e): rename night-roles-seed-wolf.spec.ts to werewolf-night-seed-wolf
- refactor(e2e): merge eclipse-queen and hidden-wolf-crow into special-roles-2
- refactor(e2e): merge treasure and thief-cupid into werewolf-night-special-roles
- refactor(e2e): merge night-verify, night-2p, night-6p into werewolf-night-flow
- refactor(e2e): rename night-roles-block.spec.ts to werewolf-night-block.spec.ts
- refactor(e2e): split completion smoke tests into werewolf-night-completion
- refactor(e2e): rename night-roles-kill.spec.ts to werewolf-night-kill.spec.ts
- refactor(e2e): remove emptied night-roles-check.spec.ts
- refactor(e2e): create werewolf-night-gun-status.spec.ts from kill and check
- feat(home): wire approved key art into the game library picker
- refactor(e2e): split check interactions into werewolf-night-check-interactions
- refactor(e2e): split basic checks into werewolf-night-check.spec.ts
- Merge pull request #182 from olveryu/feat/platform-helpers-w3-w5
- feat(home): full-screen game library picker with per-game theme gradients
- refactor(worker): migrate werewolf roster dispatch onto dispatchEffectCommand
- Merge pull request #181 from olveryu/fix/avalon-night-end-audio
- refactor(worker): extract definePublicCommandOptions into platform
- refactor(worker): extract dispatchEffectCommand for effect-driven dispatch
- fix(avalon): replace night_end clip with the full dawn narration
- Merge pull request #179 from olveryu/test/avalon-e2e-full-game
- ci(e2e): wire avalon spec into main ci as solo shard 7
- test(e2e): avalon spec - strike confirm copy carries name only
- test(e2e): avalon spec - assert quest result before panel sweep
- test(e2e): avalon spec - leader seat keeps captain badge when picked
- test(e2e): avalon spec - oberon has no night action entry
- test(e2e): add avalon full-game spec for a 10-player human game
- Merge pull request #177 from olveryu/feat/wave9-skill-rewrite
- fix(generator): re-run prettier after eslint --fix in the shaping pipeline
- docs(skill): rewrite the new-game skill as a template runbook
- fix(generator): make template output lint-clean and effect-union ready
- Merge pull request #176 from olveryu/feat/wave9-demo-game
- feat(client): filter non-production games out of the home lists
- fix(generator): keep the dispatch-sites anchor stable across generations
- feat(demo): add the generator-produced demo reference game
- Merge pull request #175 from olveryu/fix/avalon-leader-badge-phase-gate
- fix(avalon): gate the leader seat badge to daytime phases
- Merge pull request #174 from olveryu/feat/wave9-new-game-generator
- test(scripts): cover new-game generator presets and wiring
- feat(scripts): add stage new-game templates
- feat(scripts): add shared and identity new-game templates
- feat(scripts): add new-game generator core and cli
- Merge pull request #173 from olveryu/chore/encyclopedia-cleanup
- test(room): port structured description suite and delete dormant werewolf view
- test(avalon): widen role introduction literal pin to all avalon sources
- Merge pull request #172 from olveryu/feat/avalon-role-guide
- Merge pull request #171 from olveryu/feat/wave9-capabilities
- fix(avalon): remove temporary AvalonLockGate entry lock (#169)
- Merge pull request #170 from olveryu/fix/avalon-reveal-replay
- test(contract): weld revealAnimation to client reveal-gate consumption
- feat: avalon guide on shared encyclopedia with single-source role intros
- refactor: extract shared encyclopedia from werewolf guide screen
- feat(engine): declare the full capability switch set in engine definitions
- fix(avalon): stop settled result panels replaying on room re-entry
- Merge pull request #168 from olveryu/feat/wave9-registry-metadata
- feat(engine): add game registration metadata layer
- Merge pull request #167 from olveryu/docs/new-game-skill-corrections
- docs(skill): correct stale rules in the new-game skill
- Merge pull request #166 from olveryu/feat/bot-display-extraction
- refactor(undercover): resolve word card seat through platform acting-seat gates
- refactor(game-engine): delete per-game bot seat wrappers, call platform seating directly
- refactor(game-engine): delete the four bot display-name wrappers
- feat(game-engine): share the seat identity view core for avalon and drawguess
- feat(game-engine): share the seat display-name guard in platform seatIdentity
- refactor(room): project bot seat players through toRoomSeatPlayer in five adapters
- feat(room): share the roster profile-target derivation across six games
- Merge pull request #164 from olveryu/feat/bot-werewolf-fill-mark
- Merge pull request #165 from olveryu/fix/sheriff-tally-seat-order
- fix(werewolf): present the sheriff election tally in seat order
- fix(avalon): use the unified bots name in the expire hook test
- refactor(protocol): unify the mark-bots-viewed scaffold command name in four games
- docs(game-engine): register werewolf group-confirm bot scaffold as game-owned
- refactor(game-engine): move werewolf bot fill onto the platform roster fill decide
- Merge pull request #163 from olveryu/feat/avalon-history-record
- Merge pull request #162 from olveryu/fix/avalon-server-settle-timer
- fix(avalon): mark the quest leader in the history task-area team line
- Merge pull request #161 from olveryu/fix/bot-worker-mediaroutes
- Merge pull request #160 from olveryu/fix/bot-scaffold-decide
- test(avalon): cover history summary projection and tabbed overlay
- feat(avalon): tabbed match-record overlay with summary-strip entry
- feat(avalon): project round records into the view model
- feat(avalon): record every settled proposal per round in state v6
- refactor(client): keep the avalon client command surface public-only
- feat(api-worker): deliver avalon settle effects at their deadline via the room alarm
- refactor(words): align fibking publication with the shared five-piece interface (#159)
- feat(game-engine): add server-scheduled settle path for avalon countdowns
- refactor(api-worker): switch drawguess media routes to shared access
- refactor(api-worker): extract shared media room access into platform
- refactor(game-engine): move werewolf viewing participants and mark gate onto the platform pieces
- refactor(game-engine): move avalon, fibking, undercover onto the shared scaffold
- feat(game-engine): add shared viewing participants and mark decide
- feat: add role-card art for avalon, fibking, and undercover (#157)
- Bot 波 PR-2: 引擎接管解析抽取 (resolveActingSeat) (#158)
- refactor(preparation): extract the shared word preparation protocol (#156)
- Merge pull request #155 from olveryu/fix/avalon-audio-canonical-voice
- Merge pull request #154 from olveryu/fix/bot-dispatch-discipline
- fix(audio): re-record avalon narration with the canonical werewolf voice
- fix(audio): restore edge tts generation and pin the canonical voice set
- chore(room): drop the bot-seat-only failure copy constant
- test(room): pin the bot takeover dispatch discipline for all seven games
- chore: remove the dead per-game controlled-seat-not-bot reasons
- refactor(werewolf): build the mark-bots-viewed action from the shared builder
- fix(drawguess): stop hanging the controlled seat on host commands
- refactor(pictionary): run pictionary on the shared relay chain machine (#153)
- refactor(relay): extract the shared chain engine and migrate storyrelay (#152)
- feat(fibking): three-stage flow (v8) with host guess (#151)
- refactor(room): extract in-game seat tap adjudication into RoomSeatTap (#150)
- fix(avalon): align takeover dispatch and in-game seat taps with werewolf (#149)
- feat(undercover): three-stage round flow with host begin gate (state v5) (#146)
- fix(avalon): move daytime stages off the seat board bottom (#148)
- fix(avalon): viewing-stage display contract — badges viewing-only, no stage card (#147)
- feat: flow wave PR-A — platform kit + avalon three-stage opening (state v5) (#145)
- fix(drawguess): use the shared completion payload schema in worker effects (#144)
- refactor: clear the audit refactor's filed follow-ups (AU-46, AU-38, P3 items) (#143)
- Wave 8: 码制统一（AU-48/AU-38/mark 口径） (#142)
- Wave 7: worker 与产品底座（AU-40/41/43） (#141)
- Wave 6: 引擎骨架收敛（AU-44/35/36/37/38/39/42/34） (#140)
- Wave 5: 身份查看协议全平台统一（按狼人杀口径） (#139)
- refactor: wave 4 phase deadlines, reveal anchors, avalon audio ack (AU-25/26/20/21/22/23/33/24/27/30) (#138)
- refactor: Wave 3 - host management and shared copy (AU-31/32/29/49/50/51) (#137)
- refactor(room): wave 2 seat and shell assembly convergence (AU-04/05/06/07/08/16/01) (#136)
- Merge pull request #135 from olveryu/fix/settle-event-decoder
- test(account): give every SETTLE_RESULT fixture field a distinct value
- test(account): assert the full decoded SETTLE_RESULT object per game type
- test(account): harden settle decoder contract against template-literal lists
- fix(account): dead-letter undecodable account events instead of blocking the inbox
- fix(account): decode SETTLE_RESULT gameType via platform single source
- refactor: Wave 1 client convergence (AU-02/03/10/11/12/13/28/15) (#134)
- fix(avalon): port banner gate extraction and bot deal-time viewed record (#133)
- feat(avalon): flow redesign — auto-settle countdowns, action modals, seat-board picking, night badges (#132)
- feat: unify seat rosters across all seven games and align bot takeover (#131)
- fix(avalon): qa-found ui bugs (#130)
- Merge pull request #129 from olveryu/feat/avalon-ui-werewolf-parity
- refactor: share FactionChip across games (werewolf + avalon)
- fix(avalon): qa round 3 findings
- fix(avalon): host management always visible in-game (aligns with werewolf)
- docs(avalon): update §7 for werewolf UI parity (seats/board info/role card/night two-step)
- feat(avalon): werewolf UI parity - role card, board info, seats for all phases
- Merge pull request #128 from olveryu/feat/avalon-night-audio
- fix(avalon): controlledSeat test acks audio before testing gate
- feat(avalon): night phase uses seat board + confirm modal (Cupid pattern)
- feat(avalon): add first-night narration mp3s (tts skill, zh)
- ci: add workflow to generate avalon audio mp3s
- fix(avalon): qa follow-ups for night audio
- feat(avalon): lock game behind password 369 (not yet playable)
- feat(avalon): first-night narration with edge tts audio queue
- fix(avalon): oberon does not participate in evilReveal confirmation
- Merge pull request #126 from olveryu/feat/avalon
- Merge pull request #122 from olveryu/fix/storyrelay-bot-takeover-unit-tests
- docs(avalon): clarify seat-tap bot takeover (werewolf-style, D12)
- feat(avalon): use werewolf-style seat-tap bot takeover, remove TakeoverFab
- feat(avalon): set XP reward to 2/3 of werewolf (33)
- feat(avalon): add Avalon game (engine, worker, client, registrations)
- Merge pull request #125 from olveryu/fix/e2e-undercover-real-players
- Merge pull request #124 from olveryu/fix/e2e-fibking-responsive-real-players
- Merge pull request #123 from olveryu/fix/e2e-fibking-real-players
- test(undercover): don't open host panel before word-confirm loop
- test(fibking-responsive): simulate 4 real players instead of bot scaffolding
- test(fibking): simulate 4 real players instead of bot scaffolding
- test(undercover): simulate 6 real players instead of bot scaffolding
- test(storyrelay): replace bot-inputs e2e with unit tests
- Merge pull request #121 from olveryu/fix/drawguess-undo-first-tap
- fix(drawguess): undo first tap no-op due to flush clearing pending before reading
- Merge pull request #119 from olveryu/revert/pr-112-alertmodal
- chore: remove AlertModal mock and hookAlert leftovers from revert
- Revert "PR #112: AlertModal migration (35 files)" - premature merge, redo properly
- Merge pull request #118 from olveryu/revert/cleanup-diagnostic-endpoint
- revert: remove manual room cleanup diagnostic endpoint
- Merge pull request #117 from olveryu/fix/batch-room-expiry-update
- fix(room): batch expiry UPDATE to stay under D1 parameter limit
- Merge pull request #116 from olveryu/fix/cleanup-limit-param
- feat(admin): add limit param to cleanup-expired for diagnosis
- Merge pull request #115 from olveryu/fix/remove-unused-showDismissAlert
- chore: remove unused showDismissAlert and DISMISS_BUTTON
- Merge pull request #114 from olveryu/fix/room-cleanup-error-handling
- fix(admin): capture expiry errors in manual room cleanup
- Merge pull request #113 from olveryu/fix/room-cleanup-manual-trigger
- feat(admin): add manual expired-room cleanup trigger
- refactor(alert): migrate 6 werewolf hooks to AlertModal (batch 5)
- refactor(alert): migrate 5 hooks to AlertModal (batch 4)
- refactor(alert): migrate 7 hooks to AlertModal (batch 3)
- refactor(alert): migrate 5 more files to AlertModal (batch 2)
- refactor(alert): migrate ShardExchangeScreen to AlertModal
- refactor(alert): migrate 11 components to AlertModal (batch 1)
- refactor(alert): migrate GameRulesScreen to AlertModal, remove from allowlist
- Merge pull request #111 from olveryu/fix/pictionary-alertmodal
- fix(drawing): align custom color button size with preset swatches (32px)
- fix(drawguess): add clear confirm AlertModal; fix toolbar double-confirm
- feat(drawguess): add redo support and fix slow undo with optimistic update
- fix(alert): remove fade animation that swallows first click on web
- fix(pictionary): memoize AlertModal buttons to fix double-click issue
- docs: add AlertModal rule to AGENTS.md and contract test
- fix(pictionary): use AlertModal directly for clear confirmation instead of showDestructiveAlert
- Merge pull request #100 from olveryu/fix/upgrade-wrangler
- ci: add manual workflow for single-spec e2e debugging
- fix(e2e): scope exerciseDrawingTools stage locator to current step
- fix(e2e): scope pictionary stage locator to current step to avoid stale frame race
- fix(pictionary): use testID for custom color button
- fix(pictionary): use testID for all color buttons, remove fragile viewport check
- chore: remove duplicate Setup D1 migrations step
- fix(pictionary): use testID for brush width buttons
- chore: move night-roles-hidden-wolf-crow to shard 3
- chore: split e2e shard 5 into 2 shards (5+6)
- chore: shard api-worker tests across 3 runners
- fix(pictionary): use testID for color buttons in e2e
- fix(drawguess): use testID for word choice buttons in e2e
- chore: use warn level for drawguess word choose debug logs
- chore: debug log drawguess word choose submit result
- chore: build web once, share via artifact across e2e shards
- chore: fail-fast D1 migrations with dedicated CI step
- chore: log d1_migrations journal state on CI migration retry
- fix: upgrade wrangler in api-worker to 4.147.0 (missed in #100)
- chore: upgrade wrangler 4.95.0 → 4.147.0
- fix(pictionary): restore legacy '关闭选择面板' label on tool panel close (#110)
- fix(copy): 删除小游戏大厅重复的选座提示 (#108)
- Merge pull request #69 from olveryu/fix/fibking-modern-words
- fix(fibking): update force reservation test for 78-query plan after rebase
- fix(fibking): cut ancient queries 29->20, add 9 cross-domain queries
- fix(fibking): add law, trade jargon, dialect, martial arts, linguistics queries
- fix(fibking): rebalance word supply toward modern and internet slang terms
- Merge pull request #107 from olveryu/fix/pictionary-media-unit-test
- refactor(test): extract canReadDrawing unit tests, simplify mediaRoutes integration
- Merge pull request #106 from olveryu/fix/pictionary-media-test-split
- refactor(test): split pictionary spectator media test
- Merge pull request #105 from olveryu/fix/drawguess-seed-pinyin
- fix(e2e): use space-separated pinyin initials in drawguess seed
- Merge pull request #104 from olveryu/fix/vitest-obsolete-snapshot
- fix: remove obsolete Vitest snapshot (nightSteps contract)
- Merge pull request #103 from olveryu/chore/vitest-game-engine
- chore(game-engine): migrate tests from Jest to Vitest
- Merge pull request #102 from olveryu/fix/drawguess-single-char-word
- fix(drawguess): allow single-character words (1-8 chars)
- Merge pull request #101 from olveryu/fix/drawguess-random-word
- fix(e2e): don't assert specific random word in drawguess wordSelect
- fix(e2e): make drawguess fixture non-fatal
- fix(e2e): make drawguess fixture non-fatal if table missing
- fix(e2e): check 4/4 status on main lobby, not closed host panel
- fix(e2e): verify D1 migrations against journal, retry, fail fast on incomplete
- fix(drawguess): make stage content scrollable on mobile
- fix(drawguess): limit canvas height on mobile so chat gets space
- fix(drawguess): chat list scroll - only auto-scroll near bottom, taller list
- fix(e2e): unify fibking fixture to plain VALUES
- fix(e2e): simplify drawguess fixture to plain INSERTs
- Merge pull request #96 from olveryu/fix/admin-drawguess-codec
- fix(takeover): use colors.overlay token for backdrop
- fix(toolbar): use valid theme tokens for gradient fallbacks
- fix(contracts): remove 'as' assertions, use type guards; fix hardcoded colors
- fix(toolbar): use AppModal, extract inline positioning styles
- fix(knip): remove unused isPictionaryDrawingColor export
- refactor(pictionary): delete 532 lines legacy toolbar dead code
- fix(toolbar): QA round 3 - title/colorCurrent/modalBackdrop/dead styles
- fix(toolbar): add hover/focus tooltip like legacy
- fix(toolbar): a11y - pressed state, current color/width in labels
- fix(toolbar): QA round 2 - visual parity with legacy
- docs(drawguess): remove 'all-guessed early end' (Gartic.io: timer only)
- fix(drawguess): remove early round end on all-guessed (Gartic.io: timer only)
- fix(toolbar): QA round - redo/canUndo, destructive clear, rememberColor on close, tool highlight, fail-fast, ScrollView
- fix(toolbar): selected swatch shows checkmark like legacy
- fix(toolbar): match legacy details (gradient custom btn, clear in tool panel, width styles)
- fix(toolbar): match legacy color panel (toggle picker, anchor positioning)
- fix(toolbar): match pictionary button styles (flex, bg, border, size)
- fix(toolbar): add top/bottom borders like pictionary original
- fix(toolbar): color button shows solid dot like pictionary original
- feat(pictionary): use shared DrawingToolbar (unify with drawguess)
- fix(takeover): remove duplicate banner, use RoomShell's ControlledSeatBanner
- fix(takeover): make bot list scrollable in sheet
- feat: unified BotTakeover UI (2026 redesign) for drawguess+pictionary
- fix(drawguess): move bot takeover strip above viewport (not blocking canvas)
- feat(drawguess): viewport-bounded drawing layout (one screen, align pictionary)
- feat(drawguess): shared DrawingToolbar with pictionary (no drift)
- feat(drawguess): responsive drawing layout with prominent chat (align pictionary)
- test(e2e): seed 20 drawguess words and test full wordSelect flow
- fix(admin): void operator for fire-and-forget IIFE (lint)
- test: un-skip drawguess e2e (no more skipping)
- fix(admin): show 触发中… on all trigger buttons while triggering
- fix(admin): 补词×10 use force mode; fire-and-forget trigger (modal closes immediately)
- fix(admin): accept drawguess in game word game codec (PR #95 missed this)
- Merge pull request #95 from olveryu/fix/drawguess-infra-alignment
- test: use alert-button testID for undercover clear-seats confirm (more robust)
- test: scope undercover clear-seats confirm to alert modal (avoid ambiguous button name)
- test: skip drawguess e2e pending lobby rendering investigation (functional changes covered by unit tests)
- test: temporarily disable drawguess guide step to diagnose lobby rendering
- test: wait for drawguess lobby content before guide button (diagnose e2e)
- chore: prettier format new-game SKILL.md
- chore: add new-game skill to PR (single-PR rule); temporarily remove drawguess e2e to diagnose shard-5 interference
- docs: prettier format story-relay-game-design.md
- test: hoist migration lookup out of finally block (no-unsafe-finally)
- feat(admin): add drawguess to word-supply dashboard and batch x10 trigger
- fix(drawguess): drop remove-bots button from host panel
- fix(undercover): drop remove-bots button, align host panel with werewolf
- fix(storyrelay): drop remove-bots button, align host panel with werewolf
- test(drawguess): restore 0062 schema in storyrelay test instead of working around it
- test(drawguess): add e2e spec, unit tests, and doc sync
- fix(drawguess): align start gating and host panel with other minigames
- Merge pull request #94 from olveryu/fix/drawguess-bot-alignment
- fix(drawguess): 对齐其他游戏的机器人机制
- Merge pull request #93 from olveryu/fix/drawguess-no-player-pill
- Revert "feat(drawguess): show 4–12人 player count pill in game picker"
- Merge pull request #92 from olveryu/feat/drawguess
- feat(drawguess): show 4–12人 player count pill in game picker
- fix(drawguess): add drawguess media routes to worker catalog test
- fix(drawguess): add drawguess to worker contract test allowlists
- fix(drawguess): add drawguess public export to contract test expectations
- fix(drawguess): drop reverted playerLabel/durationLabel home fields
- chore(drawguess): sync pnpm-lock.yaml for pinyin-pro dependency
- feat(drawguess): add idioms and internet memes word categories
- feat(drawguess): word supply workflow and completion rewards wiring
- feat(drawguess): XP settlement effect and pinyin initials fix
- docs(drawguess): add classic draw-and-guess game design document
- feat(drawguess): add client game module, room UI and canvas
- feat(drawguess): add api-worker module, media routes and migration
- feat(drawguess): add game-engine for classic draw-and-guess
- Merge pull request #91 from olveryu/fix/werewolf-anon-display-name
- fix(werewolf): 没名字的玩家显示'匿名玩家'，不再自动生成趣味名
- Merge pull request #90 from olveryu/revert/pr-85-88
- Revert "Merge pull request #85 from olveryu/feat/ui-polish-home-picker"
- Revert "Merge pull request #88 from olveryu/fix/home-hero-scrim"
- Merge pull request #89 from olveryu/revert/pr-86
- Revert "Merge pull request #86 from olveryu/feat/ui-polish-werewolf-room"
- Merge pull request #88 from olveryu/fix/home-hero-scrim
- Merge pull request #86 from olveryu/feat/ui-polish-werewolf-room
- fix(home): 首页 hero 渐隐减半，主视觉透出来
- chore: 移除误提交的 node_modules 软链
- fix(room): 投票明细折叠时保留 DOM，修复 e2e sheriff-election 历史记录断言
- Merge pull request #85 from olveryu/feat/ui-polish-home-picker
- fix(room): buildIdentities 改为模块私有，修复 knip unused export
- feat(room): 狼人杀房间 UI 走查 W1–W20
- feat(home): picker decision info + werewolf key art + home UI polish batch
- Merge pull request #84 from olveryu/fix/create-picker-visual-polish
- fix(home): restyle create-game picker — gradient hero + borderless mini list
- Merge pull request #83 from olveryu/feat/create-modal-main-mini-tiers
- feat(home): tiered create-game picker with werewolf hero and mini-games section
- Merge pull request #81 from olveryu/fix/e2e-webserver-export-flake
- fix(e2e): pre-build web dist outside Playwright webServer timeout
- Merge pull request #80 from olveryu/feat/admin-tavily-v2
- feat(admin): 显示 Tavily 本月用量 X/1000
- Merge pull request #79 from olveryu/feat/fibking-leaderboard-pagination
- feat(admin): 瞎掰王查询产出榜加分页
- Merge pull request #78 from olveryu/feat/fibking-supply-v11
- feat(fibking): 审核 rubric 升级 v11 + Admin 拒因统计
- Merge pull request #77 from olveryu/fix/games-tab-category-labels
- Merge pull request #76 from olveryu/fix/fibking-monthly-budget-72
- docs(fibking): drop derived monthly request totals
- feat(admin): localize word categories and show full query leaderboard
- feat(fibking): tie monthly batch budget to search query count
- Merge pull request #75 from olveryu/fix/fibking-new-search-queries
- feat(fibking): add 12 modern search queries to word supply plan
- Merge pull request #73 from olveryu/fix/force-bypass-model-budget
- fix: force word supply bypasses the editorial model budget
- Merge pull request #72 from olveryu/fix/games-tab-confirm-modal
- fix(admin): use AlertModal instead of Alert.alert in GamesTab
- Merge pull request #71 from olveryu/fix/undercover-fun-prompt
- feat(undercover): encourage fun word pairs in generation prompt
- Merge pull request #70 from olveryu/feat/admin-games-tab
- fix: strictObject for searchIndex parse (worker boundary contract)
- fix: use design tokens in GamesTab, zod-parse searchIndex (contract tests)
- fix(admin): prettier formatting in adminApi
- fix(admin): unexport GAME_WORD_GAMES (knip)
- feat(admin): add Games tab with word-supply dashboard and manual triggers
- Merge pull request #68 from olveryu/fix/copy-audit-v3-full
- fix(e2e): update FibConfigPage shrink rejection assertion for new copy
- fix(copy): unify terminology and punctuation polish
- fix(copy): improve party-game and werewolf guidance copy
- fix(copy): correct misleading reconnect and seat-shrink messages
- Merge pull request #67 from olveryu/fix/copy-friendliness-pass2
- fix(e2e): update rejection alert assertion for renamed title
- Merge pull request #66 from olveryu/fix/copy-audit-stale-hints
- fix(test): update actionRejected dialog matcher for renamed title
- fix(format): prettier
- fix(undercover): pass viewer seat to bottom actions for lobby hint
- fix(format): prettier
- fix(copy): friendlier room guidance and structural copy fixes
- fix(copy): correct stale UI hints across werewolf and relay games
- Merge pull request #65 from olveryu/fix/relay-settling-stay-in-app-reminder
- feat(relay): add stay-in-app reminder to settling wait UI
- Merge pull request #64 from olveryu/fix/unify-endstage-host-actions
- fix(room): unify end-stage host actions into host management panel
- fix(share): exclude unrelated images from relay capture
- feat(relay): share story and drawing results as images in wechat
- feat: add RoomTaskViewport component for keyboard handling in task views
- feat(storyrelay): add plain-text story relay game
- feat(undercover): add round restart and random first speaker
- fix(e2e): wait for qr modal dismissal before room readiness
- feat(undercover): add completion rewards and durable account delivery
- feat(werewolf): implement role preview functionality and integrate AI assistance
- docs(ui): correct design references and sync onboarding instructions
- feat(docs): update design and integration documents for new game onboarding and UI standards
- feat(werewolf): add gameplay guide and current room rules
- feat: update docs
- refactor: unify room surface styles and enhance game settings components
- feat: refactor game guide and screen components for improved readability and structure
- fix(undercover): improve bot controls and elimination confirmation
- fix(undercover): repair word generation and enable automatic supply
- refactor: remove test mode references and update game logic
- feat(undercover): add offline game and word supply pipeline
- feat(pictionary): implement state migration for persisted rounds and enhance step offset handling
- feat(pictionary): enhance color picker functionality and media access control
- feat(werewolf): separate one-time mvp selection from restart
- feat(rewards): add game completion and player-count mvp rewards
- feat(admin): add ticket reward grants with audit history
- feat: refactor epic animations and flair components
- feat(gacha): add three mythic cosmetic collections
- fix(pictionary): automate empty task submission and improve draft handling
- feat(pictionary): enhance game configuration and submission handling
- fix(pictionary): preserve drafts and limit relay participation
- refactor(app): separate boot resources and account lifecycle from home
- fix(appearance): constrain desktop editor width
- refactor(gacha): make confirmed results independent of animation
- refactor(appearance): scope editing and save tasks to the account
- refactor(room): isolate night review capture and dialog lifetimes
- refactor(room): isolate command recovery by session epoch
- test(feedback): control asynchronous reconciliation stages
- docs(architecture): record fixes verification and accepted release risks
- fix(feedback): persist publication intents and reconcile uncertain results
- fix(account): consume durable events independently of game rooms
- fix(ci): verify release asset bytes before publishing frontend
- fix(admin): bind user queries to current filters and cancellation
- fix(ui): expose picker semantics and associate field errors
- fix(theme): keep semantic dimensions independent of initial viewport
- fix(gacha): distinguish unavailable balances from confirmed zero
- fix(settings): commit preferences only after persistence succeeds
- fix(account): preserve active avatars until replacement commits
- fix(room): compare command receipt identities by canonical json
- feat: add EternalCrownFrame and NightCrownMotif components for mythic avatar frames
- feat: enhance witch context handling to support self-healing rules and update related tests
- feat: enhance Pictionary functionality with improved canvas handling and UI updates
- feat: update HomeScreen to display game mode options in subtitle and add corresponding test
- feat: update room entry navigation and tap handling for admin access
- feat(admin): add room entry and shared title shortcuts
- feat: update Fib word provider schemas and prompts for improved clarity and accuracy
- feat: add opencc-js dependency and implement simplified Chinese conversion in Fib word processing
- feat: enhance Fib word publication and supply workflow
- feat: enhance npm version confirmation process with improved timeout handling and error reporting
- feat: refine evidence citation handling and update prompt version for FibKing word provider
- feat: enhance fib word supply workflow with configurable batch limits and improved testing
- feat: enhance fibking word provider with editorial candidate structure and evidence handling
- feat: enhance error handling and diagnostics in Fib word supply workflow and providers
- feat(config): update sheriff election rule setting to use config screen directly
- feat: enable automatic fib word supply in production configuration
- feat(settings): add sheriff election preference management and UI toggle
- feat: enhance fib word supply workflow with inventory review and candidate prioritization
- feat: add fib word publication and supply workflow with database capacity management
- refactor(room): make shell content modes explicit
- fix(outbox): atomically terminalize failures and audit settlement replay
- refactor(gacha): persist account-bound operations and validate replay parameters
- refactor(room): allocate exclusive sessions on entry and dispose on exit
- refactor(auth): publish sessions and isolate account query caches
- feat(pictionary): collect editable drafts and reveal cumulative albums
- feat(pictionary): update game mechanics for relay steps and player interactions
- feat(pictionary): add prompt-first relay and drawing tools
- feat(pictionary): add host-controlled bots
- test(pictionary): add full four-player relay coverage
- feat(pictionary): implement synchronized drawing relay game
- feat(fibking): enforce player count limits and update related validations
- feat(fibking): cap rooms at 20 players
- feat(sheriff): refine election flow and narration
- feat(werewolf): add visibility assertion for audio waiting button in host registration actions
- feat(werewolf): implement seed wolf infection mechanics and update role reveal logic
- feat(werewolf): add self-destruct mechanism for ending sheriff election in mock functions
- feat(werewolf): implement self-destruct mechanism for sheriff election
- feat(werewolf): enhance night end message, improve action layout, and add night-review functionality
- feat(werewolf): update night end message and enhance action labels in host management tests
- feat(werewolf): refine game status checks for night review and post-game actions
- feat(werewolf): enhance night-review access sharing for host with status checks
- feat(werewolf): add mini-program support for night-review report
- feat(werewolf): implement sheriff candidate status management and update notepad functionalities
- feat(fibking): add redraw and abandon game functionalities with corresponding UI updates
- feat(fibking): enhance game round management with skip and redraw functionalities
- feat(room): update Host management styles for improved contrast and accessibility
- feat(fibking): implement quality checks for word reviews and update database schema
- feat(werewolf): add seed wolf role and knight preset
- perf(app): reduce background work and measure realtime traffic
- chore(agent): consolidate configuration and refresh project docs
- feat(room): enhance room header layout with new measurements and responsive styles
- refactor(traffic): remove legacy room state references and update related tests
- feat(admin): add request traffic monitoring
- fix(accessibility): label host management actions
- Merge pull request #61 from olveryu/feat/werewolf-sheriff-election
- feat(realtime): replace HTTP polling with recoverable state sync
- fix(e2e): follow host management action flow
- feat(room): add sheriff election and unified host management
- feat(error): implement NetworkTimeoutError for better error handling fix(connection): update connection methods to throw NetworkTimeoutError on timeout test(connection): add tests for NetworkTimeoutError handling in connection methods test(error): enhance error handling tests for NetworkTimeoutError classification
- fix(vote): enhance wolf vote confirmation and improve error handling
- feat(revealEffect): migrate legacy empty reveal effect to 'none' and update related functionality
- fix(ci): verify npmmirror artifacts through public registry
- fix(fibking): review generated words before activation
- fix(room): persist and recover confirmed werewolf actions
- refactor: extract Fib preparation status pattern into a constant
- feat: add public tables for FibKing game lease state and generation cycles
- refactor: change exports to constants for FibKing word supply and selection parameters
- feat: add word supply and selection functionality for FibKing game
- feat: add recent-word fallback handling in Fib word generation effect tests
- feat: expand Fib word candidate selection and update prompt rules for improved gameplay
- feat: update timeout handling for Fib word generation and improve test coverage
- feat: update URLs to point to werewolfgamer.com
- feat: update app title and related references to '狼人面杀电子裁判助手'
- feat: refactor code structure for improved readability and maintainability

## [2.7.0] - 2026-08-17

- docs(announcements): add v2.7.0 What's New entry
- feat: enforce strict candidate count and improve validation in Fib word provider
- feat: update growth system to support unbounded levels and enhance level progression logic
- feat: enhance Gemini word provider with improved error logging and response handling
- feat: refactor Fib word provider to exclusively use Gemini, removing Workers AI fallback
- feat: refactor Fib word provider logic to support multiple candidates and enhance validation
- feat(fibking): update FibRoundView to support spectator roles and enhance UI feedback
- feat: enhance Gemini word provider error handling and fallback logic
- feat(fibking): add end game functionality and return to lobby feature
- feat: enhance room deletion logic to handle failed effects and add related tests
- feat: update Gemini model to version 3.5-flash-lite in word providers and routes
- feat: implement stable category selection for Fib word generation and enhance category instructions
- feat: add accessibility role to card options in ChooseBottomCardModal
- feat: add tests for error handling and network error classification; enhance stale-tab reload logic
- feat: enhance abort signal handling and error management in various services
- feat(ci): enhance npmmirror sync process with improved error handling and status reporting
- fix(ci): update deploy-frontend condition to allow workflow dispatch
- fix: update README to remove mention of remote play for clarity
- fix: remove outdated note about remote play coordination in README
- feat(fibking): enhance preparation phase with failure handling and word definition structure
- Revert "fix(fibking): use reviewed catalog and terminal preparation states"
- fix(fibking): use reviewed catalog and terminal preparation states
- feat(fibking): implement preparation progress tracking and validation
- feat: update werewolf stats handling and improve profile details display
- feat: enhance FibKing game with Chinese definition validation and loading indicators
- feat(fibking): show word pinyin
- fix: resolve e2e tests
- fix(ci): bind worker deploy config
- Merge pull request #57 from olveryu/feat/multigame-platform-architecture
- feat(fibking): diversify word generation
- fix(ci): cover every e2e spec
- fix(room): restore shared seat behavior
- fix(worker): bind local seed to worker config
- refactor(client): eliminate ordinary type assertions
- refactor(room): preserve authoritative command decisions
- refactor(platform): enforce canonical command boundaries
- refactor(game-engine): enforce bottom-card state invariants
- fix(api-worker): bind wrangler commands to worker config
- refactor(game-engine): enforce werewolf registry contracts
- refactor(platform): enforce runtime response contracts
- refactor(client): remove production type escape hatches
- refactor(client): remove mobile debug facade
- refactor(client): make disabled feedback explicit
- refactor(gacha): enforce canonical reward timestamps
- refactor(game-engine): unify resolver outcomes
- refactor(client): replace werewolf facade identity
- refactor(game-engine): remove aggregate package entrypoint
- refactor(api-worker): centralize request metadata parsing
- refactor(api-worker): enforce provider and mutation contracts
- refactor(auth): centralize access token principal validation
- refactor(cloudflare): generate runtime binding types
- refactor(api-worker): enforce request ownership
- refactor(api-worker): assign persistence ownership
- refactor(api-worker): centralize game runtime ownership
- refactor(api-worker): assign vertical route ownership
- refactor(platform): open game module authoring
- refactor(catalog): unify game plugin composition
- refactor(workspace): adopt neutral package scope
- refactor(client): move product runtime to feature ownership
- test(architecture): move werewolf engine tests to game ownership
- refactor(navigation): derive routes from game capabilities
- refactor(client): centralize room creation and local persistence
- refactor(game-engine): separate product and platform ownership
- refactor(api-worker): move game-owned runtime code
- test(architecture): close multigame import boundary gaps
- refactor(game-engine): move werewolf domain behind public api
- feat(fibking): complete multigame vertical slice
- fix(ci): separate report merge from Pages deployment
- refactor(client): make Home and navigation game-neutral
- refactor(client): move werewolf audio and assets into game ownership
- refactor(client): centralize account and cosmetic capabilities
- refactor(client): move werewolf ui into game ownership
- refactor(client): centralize game session composition
- refactor(game-engine): move room roster into platform ownership
- refactor(room): centralize room session ownership
- refactor(platform): isolate game-owned room contracts
- refactor(werewolf): move room client into game module
- refactor(room): centralize shared room controllers
- refactor(room): extract shared room shell
- feat(platform): add recoverable room directory
- fix(platform): harden command and event delivery
- feat(platform): add authoritative room command pipeline
- feat(engine): add authoritative werewolf engine
- fix(engine): honor wolf robot progression gate
- fix(protocol): align command result boundary
- fix(engine): fail fast on invalid progression
- refactor(engine): inject deterministic command execution
- refactor(protocol): define authoritative werewolf commands
- refactor(engine): define typed game decision contract
- refactor(transport): unify room snapshot envelopes
- refactor(store): align broadcast command naming
- refactor(protocol): add versioned state codecs
- refactor(protocol): add canonical game state identity
- refactor(engine): extract shared seating kernel
- test(platform): lock room behavior contracts
- docs(architecture): define multigame platform design
- feat(camp-stats): add 2h settlement delay hint to camp distribution
- feat(admin): show per-room game-start status in rooms tab
- feat(BoardCard): update role name hint and remove select hint style
- feat(BoardPicker): add select hint below select button and remove subtitle hint
- feat(avatars): use full role avatar in flip card and role detail sheet
- chore(avatars): regenerate 46 avatars/badges via macos vision background removal
- chore(assets): replace hiddenWolf avatar with new transparent image
- docs(prompts): use natural human face proportions, drop pointy chin
- docs(prompts): switch avatar prompts to pure white background
- refactor(agents): resolve prettier bin via package.json bin field
- fix(agents): make sync output prettier-clean and run it once in lint-staged
- fix(connection): refresh token before ws upgrade and use literal ping/pong
- feat(rooms): display host country alongside host name in room details
- fix(gitignore): add Python virtual environment to ignore list
- feat(stats): add per-player camp distribution with 2h delayed visibility
- fix(seattile): increase entrance animation loop delay to reduce CPU usage
- feat(music): add new background music tracks and update announcements
- Add files via upload

## [2.6.0] - 2026-06-27

- docs(announcements): add v2.6.0 What's New entry
- fix(roomscreen): render avatar frame outside entrance-animation clip box
- Revert "Revert "fix(roomscreen): drop avatar frame during ongoing so highlight ring shows""
- Revert "fix(roomscreen): drop avatar frame during ongoing so highlight ring shows"
- fix(roomscreen): drop avatar frame during ongoing so highlight ring shows
- perf(seat-cosmetics): cancel infinite reanimated loops on unmount to stop battery drain
- perf(roomscreen): disable seat decorations during ongoing phase to cut heat & battery drain
- fix(roomscreen): unify seat highlight into avatar-independent ring
- build(typecheck): align quality typecheck with CI/pre-push using root tsconfig
- test(audio): cover BgmPlayer web path with jsdom
- feat(AudioContextOwner): implement shared AudioContext lifecycle management and ensure running state
- fix(CFStorageService): enhance error handling for image processing and loading
- refactor: replace Sentry error handling with unified errorPipeline in multiple components
- feat(errorUtils): add isAbortError function to handle WeChat WKWebView abort scenarios
- style(roleSelector): update chipVariant borderColor to use colors.text
- docs(github): rename .github/README.md to NOTES.md so root README renders
- docs(readme): update expo sdk 55→56 and rn 0.83→0.85 version badges
- chore: add .gitattributes and Windows notes to CONTRIBUTING.md
- chore(husky): guard asdf in pre-push
- chore(husky): guard asdf in hooks
- chore: normalize line endings
- fix(auth): improve refresh token rotation logic to handle concurrent requests and expired tokens
- fix(avatar): convert blob URL to data URL before setting img.src in WeChat WebView
- feat(auth): handle auth expiration by navigating to AuthLogin modal for re-authentication
- feat(auth): implement auth expiration handling and update related tests
- docs(skills): add Chinese output directive; translate new-role SKILL.md to English
- test(navigation): centralize @react-navigation/native mock in jest.setup.ts
- feat(web): enhance splash screen handling for WeChat login and boot errors
- fix(PlayerGrid): update isAppVisible to consider focus state
- feat(index): add onHide and onShow methods to manage screen brightness
- fix(miniapp): block web-view load when offline instead of just showing hint
- feat(miniapp,web): add network status detection during loading
- fix(entry): polyfill Array.prototype.at for iOS < 15.4 webview
- fix(entry): polyfill crypto.randomUUID for iOS < 15.4 webview
- fix(avatar): remove crossOrigin from image compression to fix WeChat WebView upload
- feat(game-rules): enhance GameRules navigation with existingRoomCode and nominateMode parameters
- fix(lint): remove 597 unnecessary type assertions after TS6 upgrade
- feat(game-rules): add game rules settings screen end-to-end
- chore(deps): upgrade @sentry/react-native to v8
- chore(deps): upgrade commitlint to v21
- chore(deps): update patch/minor dependencies
- fix(e2e): add game-engine paths to e2e/tsconfig.json for Playwright resolution
- ci: add game-engine build step to quality and e2e jobs
- ci(quality): add game-engine build to quality pipeline
- fix(game-engine): migrate tsconfig.build to module node16 (TS6 deprecation fix)
- fix(tsconfig): exclude jest types from build config for fail-fast
- chore: upgrade expo 55→56, typescript 5→6, react-native 0.76→0.85
- fix(ci): upgrade wrangler-action and upload-pages-artifact to latest versions
- fix(ci): pass commit subject only to Cloudflare Pages deploy
- feat(roomscreen): propagate isPlagueMode in updateTemplate and improve host UX hints
- refactor(roomscreen): enforce viewRole seat invariant in resolver, simplify layout rules
- test(roomscreen): align restart dialog tests with status-based condition
- fix(dialogs): prevent restart dialog when game is not ended
- fix(config): validate treasureMaster prereqs, fix plague mode toggle/visibility
- feat(game-engine,config): add plague mode (黑死病) for wolf-free card dealing
- refactor(i18n): translate Chinese JSDoc comments in RoleRevealEffects and GachaScreen
- revert(skia): restore SVG+Reanimated for seat flairs/animations, remove ResilientCanvas
- refactor(i18n): translate remaining source code comments to English
- refactor(i18n): translate source code comments to English (batch 2)
- refactor(i18n): translate source code comments to English
- docs(i18n): add English titles and markers to archive docs
- docs(i18n): translate remaining design docs to English
- docs(i18n): translate design docs to English
- docs(i18n): translate core governance, instruction, and skill files to English
- fix(skia): prevent WebGL context exhaustion via \_\_destroyWebGLContextAfterRender
- chore(copilot): align instructions/skills with 2026 customization spec
- docs(readme): fix stale stats, unify WeChat branding, sync bilingual content
- docs(jsdoc): add @throws, @pre, @remarks, and field comments across codebase
- docs: standardize JSDoc for all exported symbols
- docs: sync all docs/instructions with v2.5.0 codebase
- fix(skia): recover from WebGL context loss via canvas remount

## [2.5.0] - 2026-05-24

- fix(seatFlairs): fix lint errors in ResilientCanvas hook ordering
- docs(announcements): add v2.5.0 What's New entry
- feat(hiddenWolf): add board strategy, fix seat display, E2E spec + skill docs
- fix(skia): structural StaticCanvas wrapper to prevent WebGL context-loss crash
- feat(hiddenWolf): add hidden wolf role end-to-end with preset board
- fix(seatFlairs): use StaticWebGLRenderer for preview contexts to prevent WeChat crash
- fix(connection): race prefetch with grace timer to prevent timeout on slow networks
- perf(rendering): convert SVG+Reanimated animations to Skia Picture worklets
- fix(roomscreen): seat highlight invisible on framed tiles
- feat(feedback): include user profile in GitHub issue body
- feat(gacha): grant 1 golden draw with daily login reward
- Merge pull request #50 from olveryu/dependabot/npm_and_yarn/npm_and_yarn-b468f437e1
- refactor(miniapp): unify splash screen to single fixed blue background
- refactor(auth): tighten expectedCodes to actual server contract
- feat(compat): polyfill AbortSignal.timeout/any for legacy WebViews
- chore(deps): bump the npm_and_yarn group across 1 directory with 2 updates
- fix(auth): add error handling to tryClaimToken/fetchAndCacheUser, tighten types
- refactor(auth): remove tryClaimToken retry now that miniapp race is fixed
- fix(miniapp): remove wechat/auth wording from login screen for review compliance
- fix(auth): eliminate infinite login loop in miniapp claim flow
- refactor(auth): defer user creation to claim-time, add claim-bind for email users
- fix(auth): make rotateRefreshToken atomic with DELETE RETURNING
- refactor(auth): remove legacy code-in-URL wechat auth flow
- feat(auth): implement nonce-based claim flow for WeChat mini-program web-view
- fix(auth): fallback to anonymous login when wx code missing or failed
- fix(WxLoginFailedScreen): replace Math.random with randomPick, exclude from style contract
- style(WxLoginFailedScreen): match splash screen visual style
- fix(miniapp): improve wx login error UX and remove dead query param fallback
- fix(miniapp): transmit wxcode via path segment to survive security page
- fix(miniProgram): add query param fallback for backward compat with old miniapp
- fix(miniapp): transmit wxcode via hash fragment instead of query param
- feat(feedback): add status/resolve lifecycle and fix structural bugs
- fix(ci): replace sleep with npm registry polling before npmmirror sync

## [2.4.0] - 2026-05-11

- docs(announcements): add v2.4.0 What's New entry
- fix(admin): add fetch timeout and fix unhandled rejections in admin api
- Merge pull request #49 from olveryu/dependabot/npm_and_yarn/npm_and_yarn-0b0ca7d3fa
- perf(animations): migrate runOnJS to scheduleOnRN and pause off-screen animations
- docs(instructions): replace declarative rules with 5-point self-check checklist
- chore(deps): bump hono in the npm_and_yarn group across 1 directory
- Merge pull request #47 from olveryu/dependabot/npm_and_yarn/npm_and_yarn-03cc7c73db
- fix(roomscreen): replace timestamp debounce with modal state guard for seat taps
- fix(night-review): add skip annotations for all canSkip roles and contract test
- fix(services): prefetch state parallel to WS handshake, guard anon users from stats queries
- fix(CFAuthService): add auto reLaunch for WeChat mini-program login retry
- Revert "fix(miniapp): route intl WeChat users to custom domain to avoid security page query param stripping"
- fix(roomscreen): derive isPlayingEntrance from props instead of state
- fix(miniapp): route intl WeChat users to custom domain to avoid security page query param stripping
- fix(CFAuthService): handle mini-program login failure without wxcode or session
- feat(sentry): report query failures to Sentry via QueryCache.onError
- feat(sentry): enable structured logs + sendDefaultPii on Worker
- feat(sentry): enable Session Replay for error reproduction
- fix(sentry): enrich handleError with tags + fingerprint + complete mock
- fix(sentry): preserve original error stack in Worker onError handler
- fix(sentry): add release to Worker via CF_VERSION_METADATA binding
- fix(sentry): instrument Durable Objects with Sentry tracing
- fix(sentry): add ignoreErrors + denyUrls to filter non-actionable noise
- fix(sentry): align source map release format with SDK init
- fix(geminiProxy): change error logging from error to warning for fallback to Workers AI
- perf(api-worker): replace dynamic model cascade with fixed gemini-3.1-flash-lite
- fix(api-worker): use onConflictDoNothing for room code collision detection
- refactor(docs): streamline instruction audit template by removing outdated content
- feat(admin): add AI usage tracking with Analytics Engine telemetry
- fix(admin): stabilize onRangeChange ref to prevent infinite re-render loop
- style(homescreen): redesign RecentRoomsModal with accent bars and two-row cards
- refactor(admin,debug): extract shared components, migrate debug panel to RN
- feat(homescreen): show createdAt in RecentRoomsModal, rename card to 最近房间
- fix(admin): use toDateTime() in Analytics Engine SQL, simplify custom date input to YYYY-MM-DD
- fix(api-worker): add x-admin-token to CORS allowHeaders
- feat(admin): add admin portal with user/room/stats/analytics tabs
- refactor(homescreen): redesign RecentRoomsModal with micro-card UI and proper error state
- refactor(ci): switch to artifact-based GitHub Pages deploy (no gh-pages branch)
- chore(ci): keep only 5 most recent playwright reports
- fix(ci): use incremental commits for gh-pages (orphan push caused HTTP 500)
- fix(room): update restart dialog action to select "直接开始" option
- feat(api-worker): upgrade fallback model to gemma-4-26b-a4b-it
- feat(gacha): add rate disclosure detail rows, recent rooms modal, and fix daily reward test
- fix(e2e): suppress Sentry DSN in E2E builds to prevent log pollution
- feat(gacha): randomize per-game and level-up draw rewards, remove single-pull button
- chore(deps): bump hono in the npm_and_yarn group across 1 directory
- fix(room): write lastRoomCode only after confirmed join/create in useRoomLifecycle
- fix(e2e): use production build + static serve on CI to eliminate flaky navigation
- fix(e2e): dismiss role alert before clickBottomButton in treasure test
- fix(e2e): correct wolf vote indices and add night-driver debug logging
- perf(ci): speed up merge-reports — drop full install, combine deploy steps, add retry
- fix(e2e): ensureConnected in driveWolfVote before waiting for state
- Revert "fix(e2e): prevent tryClickAdvanceButton from hanging on inert #root"
- fix(e2e): prevent tryClickAdvanceButton from hanging on inert #root
- fix(e2e): dismissAlert should not wait for modal hidden
- fix(e2e): replace waitFor hidden with structural content markers
- fix(ci): set http.postBuffer 500MB to avoid GitHub 500 on large pushes
- fix(e2e): remove remaining defensive .catch from pages/specs
- fix(e2e): remove force:true and defensive .catch from E2E clicks
- fix(roomscreen): lock bottom panel during audio playback for all roles
- fix(e2e): use close button as announcement auto-dismisser trigger
- fix(e2e): update announcement modal auto-dismiss trigger for new default tab
- feat(home): redesign announcement modal with 3-tab layout (boards/changelog/feedback)
- fix(game): update minimum player requirement from 9 to 6
- fix(audio): wait for canplaythrough before play on web, remove timeout
- feat(debug): add structured debugging workflow documentation
- fix(ci): squash gh-pages history on every deploy (orphan commit)
- fix(ci): remove single-commit (incompatible with target-folder accumulation)
- fix(ui): reposition Toaster component to top-center

## [2.3.0] - 2026-05-06

- fix(ci): use HEAD:gh-pages refspec for worktree push
- feat(announcements): add board showcase section and v2.3.0 changelog
- refactor(logger): use ua-parser-js for browser.name detection
- feat(skills): add debug skill
- fix(logger): detect WKWebView in-app browser for browser.name attribute
- fix(roomscreen): prevent duplicate actionPrompt after groupConfirm ack
- ci(e2e): retain report history on gh-pages with per-run subdirectories
- fix(ci): update package version format for CDN asset URLs
- fix(home): update auto-dismiss button text for announcements
- feat(feedback): add user feedback submission via github issues
- fix(logger): explicitly attach browser.name to Sentry structured logs
- refactor(ci): update test sharding to improve runtime distribution
- refactor(hooks): remove ref-mirror pattern from useBgmControl
- test: remove duplicate contract tests from wolfKillDisabled
- refactor(styles): hoist static styles to module scope
- fix(test): replace any[] with SeatViewModel[] in PlayerGrid test
- fix(connection): route errors through handleError pipeline
- refactor(api-worker): add IGameRoomRPC interface for compile-time sync
- fix(hooks): log silenced level fetch errors in useRoomLifecycle
- fix(api-worker): atomic settle with settled_at guard
- feat(gacha): add idempotency key to draw and exchange endpoints
- chore(docs): archive code-audit-2026-04-08.md
- revert: undo 13 M-numbered audit commits above P0-P3 plan scope
- perf(client): memoize style computations, hoist constants, simplify wolfVotes
- refactor(game-engine): normalize handler API and add schema completeness check
- refactor: eliminate non-null assertions with narrowing and fail-fast
- refactor(client): replace type assertion bypasses with safe patterns
- fix(client): remove dead wolfVotes fallback and fix countdown tick leak
- refactor(game-engine): remove type assertion bypasses in resolvers
- refactor(game-engine): replace ROLE_SPECS double-cast with getRoleSpec
- refactor(game-engine): add assertNever exhaustiveness checks
- docs(game-engine): document sideEffects [] vs undefined semantics
- fix(audio): add user notification on init failure and handle resume rejections
- fix(game-engine): replace groupConfirm ack ternary fallthrough with explicit map
- fix(game-engine): fix cross-link-type chain death propagation in DeathCalculator
- fix(game-engine): add explicit isEndAudio: false to night_end PLAY_AUDIO side effect
- refactor(api-worker): centralize DO RPC type wrapper, eliminate 22 type casts
- refactor(errors): unify API error wire format and consolidate error-to-message logic
- refactor(facade): replace takeSeat positional params with SeatProfile object
- refactor(api-worker): extract userProfile module to eliminate auth response shape drift
- refactor: replace loose {success: boolean} with ActionResult discriminated union
- feat(sentry): enable sending default PII for structured logs
- fix(alert): capture generation before onPress to prevent closing replacement alert
- style(alert): fix import sort order in AlertModal
- refactor(error): replace alertTitle with feedback mode in handleError (alert/toast/false)
- fix(alert): enforce strict void-returning callbacks and add async button support
- docs(skills): remove confirmation step from quality-commit skill
- refactor(roomscreen): add audioWaiting button and exempt VIEW_ROLE from audio gate
- refactor(roomscreen): replace per-ack pending booleans with mutation lifecycle
- feat(protocol): add useAckMutation + usePendingAcks for in-flight gating
- docs(skills): update quality-commit skill constraints
- chore(app-modal): remove useModalStack from barrel export
- docs(skills): add quality-commit skill for run quality fix commit push workflow
- refactor(.gitignore): clarify Claude Code local state comments and expand lock file patterns
- test(e2e): add wolfRobot poisoned hunter gate assertion
- refactor(roomscreen): remove dead REVEAL_ACK and HUNTER_STATUS_VIEWED policy chains
- fix(bgm): drive BGM start by gameStatus transition instead of HTTP response
- fix(group-confirm-ack): await server confirmation before dismissing dialog
- fix(reveal-ack): await server confirmation before dismissing reveal dialog
- fix(web): use unpkg for canvaskit WASM in local dev
- fix(roomscreen): improve ended-phase guide messages
- revert(sentry): remove beforeSendLog debug filter, quota is sufficient
- refactor(branding): rename 狼人kill电子裁判 to 狼人面杀电子裁判助手
- fix(auth): structural fix for VALIDATION_ERROR Sentry regression
- fix(auth): resolve VALIDATION_ERROR Sentry regression (WEREWOLFJUDGE-1J)
- fix(sentry): drop debug-level logs in beforeSendLog to conserve quota
- docs(skills): add query-prod-data skill for D1/Analytics Engine lookups
- fix(ci): skip npm publish when CDN version already exists
- fix(boot): preload icon font during boot to prevent FOIT on web
- Revert "fix(web): use document.fonts.load() instead of .ready for icon font"
- fix(web): cache splash image choice in sessionStorage
- feat(encyclopedia): show counts in guide tabs and board category chips
- fix(web): use document.fonts.load() instead of .ready for icon font
- fix(roomscreen): show wolf vote hint persistently in bottom panel
- chore(assets): move pwa source images to raw/ subfolder
- chore(assets): replace splash images, organize pwa/web/
- refactor(web): simplify boot to Expo standard pattern
- feat(roles): add eclipseWolfQueen + sequencePrince
- refactor(splash): move document.fonts.ready into useBootProgress
- fix(splash): wait for document.fonts.ready before dismissing splash
- fix(connection,auth,home): wechat webview production audit fixes
- fix(splash): wait for first screen render + avatar prefetch before dismiss
- fix(splash): web uses single HTML splash until ready, skip LoadingScreen
- fix(splash): defer body background switch until splash is dismissed
- fix(splash): prevent background color flash between dark splash and light theme
- feat(splash): fullscreen background art with random selection and styled title
- chore(eslint): promote no-explicit-any from warn to error
- docs(instructions): align with 2026 community conventions
- docs(instructions): add noUncheckedIndexedAccess and no-unsafe-\* rules
- chore(types): enable noUncheckedIndexedAccess
- chore(types): enable noUncheckedIndexedAccess
- Merge branch 'chore/eslint-no-unsafe'
- chore(eslint): enable no-unsafe-\* rules as error, fix all violations
- test(ai-chat): add unit tests for playerContext and rolePlayGuide
- perf(query): prefetch queries before screen navigation
- refactor: enforce consistent-type-imports via ESLint
- fix(ci): add --tag latest for npm 11 prerelease publish
- perf(api-worker): add WebSocket auto-response to GameRoom DO
- fix(api-worker): remove CORS_ORIGIN fallback, explicit test env vars
- feat(build): enable React Compiler via Expo experiments
- feat(prompts): add prompt for delegating tasks to specialists
- feat(docs): add CI/CD deployment instructions and E2E spec skill documentation
- fix(api-worker): use D1 batch API for draw history insert
- feat(favorites): add onAddToFavorites method for sharing functionality
- feat(observability): enable traces for enhanced logging and monitoring
- fix(room): lower strategy match threshold to 0.1 for custom boards
- feat(game-engine): add wolf_tie_random UI hint on normal boards
- revert(ci): restore ci.yml before React settings change
- feat(eslint): add global React settings for automatic version detection
- fix(lint): move eslint-disable-next-line to correct line for multi-line require
- feat(observability): add structured logger + Sentry to Worker, enforce no-console
- chore(logger): forward debug-level logs to Sentry structured logs
- fix(ci): poll npmmirror sync task status instead of single file check
- fix(game-engine): wolf vote tie randomly picks one target instead of no-kill
- feat(announcements): add encyclopedia entry to v2.2.0 changelog
- refactor(data): consolidate board tags to 9-tag controlled vocabulary
- fix(data): correct 11 factual errors in boardStrategyData
- feat(encyclopedia): unified guide screen with tag filter and DRY board card
- feat(strategy): add board strategy modal with fuzzy matching
- fix(chat): add option to skip message history when sending messages
- fix(room-screen): update game status messages to use localized text
- chore(ci): remove dead R2 purge step
- perf(web): eliminate code splitting by replacing dynamic import() with require()
- fix(ci): rewrite asset URLs before npm publish so CDN chunks resolve correctly
- fix(api-worker): parse telemetry body as text for text/plain content-type
- fix(telemetry): send beacon as text/plain to avoid CORS preflight
- feat(telemetry): load timing beacon + splash friendly labels
- ci: trigger deploy after token permission update
- refactor(auth): dual-token auth with refresh rotation, WS JWT verification, token revocation

## [2.2.0] - 2026-04-29

- fix(ci): cp wasm before gzip to avoid pnpm hardlink refusal
- perf(web): pre-gzip canvaskit.wasm for npmmirror CDN
- ci(cdn): switch CDN to npmmirror with jsdelivr fallback
- fix(gacha): use locale-independent date format for daily reward
- feat(seatAnimations): add flash + glow + spring scale to epic-tier entrance animations
- chore: add security.txt for cloudflare security center
- fix(cosmetics): show warning toast when GameState sync fails
- refactor(cosmetics): use object param for GameRoom.updateProfile
- refactor(cosmetics): migrate gacha routes to jsonBody middleware
- fix(cosmetics): sync unequipped cosmetics on reconnect
- fix(cosmetics): replace as-string casts with runtime-safe metaString in toUser
- fix(cosmetics): sync roleRevealEffect to GameState on equip/save
- fix(cosmetics): validate equip ownership server-side in PUT /auth/profile
- fix(api-worker): refactor GameRoom.seat() to object params
- fix(cosmetics): sync seatAnimation through full auth + game profile pipeline
- fix(seat): show flair/pet during entrance loop gap
- feat(seat): loop entrance animation every 5s
- fix(ui): closeButton refactor, gradient text inline fix, entrance anim cleanup
- feat(gacha): standardize seat animation durations, restore profile card slots, fix UI
- fix(seed): include SEAT_ANIMATION_IDS in dev user full-unlock
- feat(room): self-tap shows profile card with leave button, remove double confirms
- feat(profile): add role reveal effect to user profile and equipment showcase
- feat(gacha): add seat pet system — 12 animated pets tied to role reveal effects
- fix(unlocks): render generated avatars in UnlocksScreen
- chore: update eslint config, e2e helpers, seed script, and contract tests
- feat(game-engine): update reward catalog and gacha probability
- feat(appearance): update AppearanceScreen for new cosmetic types
- feat(gacha): add rate disclosure modal and update gacha/reward UI
- feat(gacha): add GeneratedAvatar component and update avatar utils
- feat(gacha): add 30 seat flair components
- feat(gacha): add 30 avatar frame components
- feat(gacha): increase per-game normal draws from 1 to 2
- fix(rewardCatalog): update rarity mapping for role reveal effects and adjust comments
- refactor(gacha): simplify rollRarity logic and remove rollFromSubset function
- feat(gacha): rebalance welcome bonus and level-up rewards
- refactor(appearance): extract sub-modules from AppearanceScreen
- fix(auth): clear wxcode from URL when WeChat already bound
- refactor(appearance): rename AvatarPickerScreen → AppearanceScreen
- feat(avatar-picker): show styled display name in hero area, fix equippedEffect persistence
- fix(cdn): use fastly.jsdelivr.net to bypass DNS pollution in China
- feat(gacha): wrap overlays in Modal, redesign buttons, add header nav icons
- style(gacha): switch bottom panel to light theme with card wrapper
- chore(web): remove suicide service worker
- fix(web): remove redundant controllerchange listener
- fix(web): remove canvaskit WASM preload with hardcoded version
- fix(ci): use sed instead of perl for jsdelivr URL rewrite
- feat(cdn): switch from R2 to jsdelivr npm CDN for China acceleration
- fix(AIChatService): increase maxTokens to 2048 for improved chat response capacity
- fix(pwa): suicide SW force-navigates all clients on activate
- fix(miniapp): add cache-busting param to bypass webview stale cache
- fix(pwa): auto-reload when suicide SW replaces stale caching SW
- fix(ci): remove --size-only from R2 sync to fix stale JS bundles
- fix(pwa): replace service worker with suicide SW to clear stale caches
- fix(audio): preserve Web Audio element↔source binding across stop/start cycles
- fix(audio): add crossOrigin to BGM element for CDN CORS
- fix(room): hide share room button in wechat miniprogram
- perf(cdn): replace wrangler r2 loop with aws s3 sync
- fix(cdn): add --remote flag to wrangler r2 object put
- feat(cdn): add R2 upload to CI, update sw.js for dual-host CDN caching
- feat(gacha): redesign bottom panel with dual-tab switcher
- ci(cdn): improve npm package metadata for whitelist review
- feat(gacha): redirect anonymous users to auth on draw button press
- fix(sw): use exact hostname match for CDN URL validation
- feat(cdn): publish all assets to npmmirror CDN and compress BGM
- ci: temporarily skip npmmirror CDN steps (pending white list #553)
- feat(ci): publish werewolf-judge-cdn as importable manifest library
- fix(sw): open cache before clone to prevent body-used TypeError
- fix(build): copy sw.js to dist for Cloudflare Pages
- feat(web): switch CDN from jsdelivr to npmmirror for China acceleration
- feat(web): serve JS bundles from jsdelivr CDN for China acceleration
- feat(web): add Service Worker for runtime caching
- revert(web): switch CanvasKit CDN back to jsdelivr
- fix(web): update CanvasKit CDN paths to use full directory for WASM files
- perf(web): switch CanvasKit CDN to npmmirror with jsdelivr fallback
- fix(web): load Skia WASM in entry-point before App import
- fix(gacha): rarity via background gradient, selection via rarity-colored border
- fix(UnlockCell): update unlockedBorder color to match background
- fix(nav): chain Skia screen prefetch after WASM load
- feat(boot): step-based LoadingScreen with real progress, error retry, reduced motion
- fix(nav): wrap screenLayout with ErrorBoundary for chunk load resilience
- perf(web): lazy-load Skia WASM and code-split all non-Home screens
- fix(room): hide kick button outside Unseated/Seated phases
- fix(audio): resume suspended AudioContext before BGM play
- fix(sentry): remove **SENTRY_TRACING**:false that killed all performance tracing
- fix(audio): register webAudioUnlock synchronously in constructor
- fix(sentry): add @sentry/browser to knip ignore, fix formatting
- chore(sentry): temp 100% sampling + integration diag log
- chore(sentry): temporary debug:true to diagnose missing performance data
- fix(sentry): add browserTracingIntegration for web performance tracing
- feat(sentry): add reactNavigationIntegration for performance tracing
- fix(web): update CanvasKit WASM preload to use CDN for improved loading performance
- refactor(web): update Skia initialization pattern and remove CanvasKit WASM handling
- refactor(tarot): consolidate prompt text into HintWithWarning, remove dead Skia init from index.ts
- perf(web): add WASM immutable caching + jsdelivr CDN race
- revert: undo Skia removal (3dff02db, bfb150e8, d4c73e8f)
- fix(test): tighten CapsuleMachine ratchet 18 → 17 after color extraction
- Merge pull request #44 from olveryu/dependabot/npm_and_yarn/npm_and_yarn-da47bb892b
- chore: update lockfile after removing @shopify/react-native-skia
- refactor(effects): replace Skia with SVG/Reanimated in all role reveal effects
- feat(audio): add gesture-authorized BGM element for improved playback handling
- fix(hooks): destructure useMutation to stabilize useCallback/useEffect deps
- chore(deps): bump hono in the npm_and_yarn group across 1 directory
- fix(api-worker): use new_sqlite_classes for WeChatAuthProxy
- docs(api-worker): fix WeChatAuthProxy comment accuracy
- feat(api-worker): proxy WeChat API via DO with locationHint apac
- refactor(facade): remove optimistic update infrastructure
- perf(api-worker): add DO locationHint from cf.continent
- chore: remove unused exports flagged by knip
- test(api-worker): add auth handler integration tests
- test(api-worker): add GameRoom DO integration tests for night flow, clearAllSeats, board nomination
- refactor(encyclopedia): extract useEncyclopediaScreenState hook and styles
- refactor(board-picker): extract useBoardPickerScreenState hook and BoardCard component
- refactor(unlocks): extract useUnlocksScreenState hook and UnlockCell component
- chore: remove stale supabase references
- refactor(logging): remove colons from warning and error messages for consistency
- perf(config): read displayName from AuthContext instead of HTTP
- perf(hooks): eliminate redundant HTTP requests in seat/profile flows
- fix(room): sync profile to roster on reconnect
- fix(e2e): use idiomatic addLocatorHandler for announcement modal
- feat(miniapp): keep screen on during gameplay
- test: convert all real-timer waits to fake timers or remove no-ops
- refactor(web): replace pointerEventsStyle constant with per-component StyleSheet entries
- feat(home): replace announcement pagination with scrollable version list

## [2.1.0] - 2026-04-22

- docs(announcements): add v2.1.0 What's New entry
- chore(auth): remove unused wechat mutation hooks
- fix(settings): add try/catch to handleSignOut for error feedback
- feat(network): queryClient mutationCache, manual reconnect, wechat error page (§3.12-3.13, §4.3)
- feat(network): extract room mutations to TanStack hooks (§3.8)
- feat(network): extract auth mutations to TanStack hooks, simplify AuthContext (§3.7, §3.10-3.11)
- feat(network): add network-layer retry infrastructure (§3.1-3.6, §3.14)
- fix(auth): improve loading timeout and auth resilience for slow networks
- refactor: make hypnotizedSeats/piperRevealAcks/conversionRevealAcks/cupidLoversRevealAcks required
- fix: add NormalizedFields to schema smoke test mock
- fix: replace || with ??, annotate eslint-disables, remove dead re-exports
- refactor(client): tighten types at transport boundary, remove redundant ?? []
- refactor(api-worker): update DO + handlers to use GameStatePayload
- refactor(game-engine): update engine internals to use GameStatePayload
- refactor(game-engine): rename GameState → GameStatePayload, introduce tight GameState
- refactor(avatar): remove dead props roomId/avatarIndex and cascade cleanup
- chore: remove .node-version, unify on .nvmrc
- chore: remove leftover Vercel config files
- fix(gacha): hide avatar placeholder background when frame is present
- Revert "fix(gacha): add base Rect stroke to Cross and Scallop frames"
- fix(gacha): add base Rect stroke to Cross and Scallop frames
- fix(audio): reorder webAudioUnlock to create HTMLAudioElement before AudioContext
- style(room): make tile fully transparent when avatar frame equipped
- docs: add naming-before-grep rule, remove redundant dictionary table
- chore(lint): add no-restricted-syntax rules for deprecated identifiers
- refactor: update LAST_ROOM_CODE_KEY storage value to lastRoomCode
- refactor(api-worker): rename D1 columns for naming consistency
- refactor: rename seatNumber to seat across the codebase
- style(room): hide tile border when player has avatar frame
- refactor: rename roomNumber to roomCode across the codebase
- style(room): remove self-seat background tint
- fix(gacha): replace same-day dedup with pure cooldown guard
- refactor: unify user identifier naming (uid → userId, User.uid → User.id)
- fix(e2e): auto-dismiss announcement modal via addLocatorHandler
- fix(audio): don't close shared AudioContext in BgmPlayer.stop()
- chore: update v2.0.1 announcement with gacha and new boards
- fix(auth): add Smart Placement, WeChat API timeout, and auth error UI
- test: add stopBgm to audioService mocks
- fix(audio): stop BGM when leaving room
- fix(audio): remove destructive cleanup() on leave room
- ci(miniapp): trigger upload on release commits
- chore(release): check announcements entry before release
- fix(home): defer announcement modal until auth loading settles
- fix(e2e): dismiss announcement modal in ensureHomeReady
- feat(ui): add copy button next to WeChat ID in announcement modal and settings

## [2.0.1] - 2026-04-20

- fix(lint): remove all unnecessary type assertions and unused imports
- refactor(home): replace tip cards with changelog card + controlled announcement modal
- feat(home): add What's New announcement modal on version update
- fix(audio): add silent audio unlock for Android WebView autoplay policy
- feat(auth): simplify WeChat sign-in process and add wxReLaunch for code refresh
- fix(gacha): store ISO datetime in lastLoginRewardAt for accurate cooldown
- feat(assets): add WebP role badges + contract tests for web variants
- fix(main): stop removing #root in WeChat guide to prevent Invariant Violation
- style(frames): rebalance common/rare visual hierarchy
- fix(main): force evaluation of expo module to prevent "Requiring unknown module" crash
- fix(flairs): redesign 4 common flairs that looked like borders
- fix: revert accidental conflict markers in metro.config.js
- fix(frames): redesign diamond frame with rounded-rect + accent gems
- fix(frames): redesign scallop frame with shallow bezier waves
- perf(web): self-host CanvasKit WASM + same-origin preload
- perf(nav): remove React.lazy screen splitting to eliminate navigation spinner
- feat(gacha): add animated shimmer to legendary avatar frames
- docs(index): clarify Skia SkiaViewApi workaround with upstream context
- docs(instructions): sync with 2026 codebase state
- revert(metro): remove ineffective Skia inlineRequires blockList
- feat(eslint): upgrade to recommendedTypeChecked for async/promise safety
- fix(skia-web): pre-import NativeSkiaModule to set global.SkiaViewApi
- fix(queries): add queryOptions to react-query mock and fix enabled type
- refactor: rename screen-level styles.ts to ScreenName.styles.ts
- refactor: replace 9 barrel imports with deep imports from game-engine
- chore(docs): archive historical design docs to docs/archive/
- refactor(metro): simplify Skia inlineRequires blockList with recursive readdirSync
- fix(metro): exclude @shopify/react-native-skia from inlineRequires
- chore: gitignore \*.tmp.sql to prevent temp query files from being committed
- chore: remove accidentally committed temp SQL file
- fix(ai-chat): raise token limits + remove conflicting length caps + add fetch timeout
- chore: fix knip false positive for babel-plugin-transform-define
- perf(nav): lazy-load 11 non-essential screens
- perf(assets): compress avatars + badges to WebP for web
- perf(icons): use direct Ionicons import to exclude 17 unused font families
- perf(sentry): tree-shake debug + replay + tracing code
- perf(metro): enable tree shaking + inline requires
- chore: migrate instruction files to 2026 YAML frontmatter format
- docs: update gacha system documentation to reflect implementation
- feat(gacha): daily login reward — 1 free normal draw per day
- fix(ai-chat): handle versionless model IDs + exclude latest aliases
- feat(ai-chat): dynamic Gemini model discovery with cascade fallback
- fix(ai-chat): use correct Gemini 3.1 Flash Lite model ID
- fix(connection): suppress background reconnect loop + auto-recover from Failed on foreground
- ci: cancel in-progress runs on new push to same ref
- revert(web): restore jsdelivr CDN for canvaskit WASM
- fix(ai-chat): transform Workers AI SSE to OpenAI format for client compatibility
- fix(auth): merge user_stats + draw_history on WeChat→email account bind
- fix(gacha): optimistic concurrency control + invalidate cache on settle
- feat(growth): promote 6 frames + 5 flairs from epic to legendary
- refactor(wechat): follow official docs for miniprogram detection
- fix(web): remove wxcode URL check from miniProgram detection
- fix(auth): use wxcode presence as definitive miniprogram signal
- fix(miniapp): switch web-view URL to pages.dev for China access
- Revert "fix(web): remove wxcode URL param from miniProgram detection"
- fix(web): add WeChat domain unblock verification file
- fix(avatar): improve avatar filtering logic and add placeholder for grid alignment
- fix(web): self-host canvaskit WASM to fix WeChat web-view in China
- feat(api): record user geo (country/colo) on auth, add request logging
- fix(web): remove wxcode URL param from miniProgram detection
- fix(auth): defer wxcode deletion, retry sign-in, block anonymous in WeChat
- feat(gacha): allow partial multi-draw when tickets < 10
- chore: remove obsolete gacha UI preview HTML
- feat(growth): add rare tier + expand common tier for frames and flairs
- fix(growth): differentiate rare nameStyle prefixes visually
- feat(growth): rework nameStyle rarity tiers with factory pattern
- feat(gacha): visual redesign with extracted components + layout fix
- test(gacha): update rarity count assertions for rebalance
- fix(query): extract useAuthenticatedQuery base hook, guard gacha + avatar sync
- fix(gacha): scale capsule machine by both width and height
- fix(stats): replace racy anonymous provider with React Query enabled guard
- fix(e2e): use wrangler.test.toml for e2e dev server
- feat(avatar-picker): inline special cells + bare-text rarity chips
- style(growth): filled capsule rarity chips — full color bg + white text
- style(growth): redesign rarity sub-tab chips with color-tinted active state
- fix(avatar): uploaded avatar checkmark persists after selecting another
- feat(growth): add rarity sub-tabs and group TenResultOverlay by rarity
- fix(api-worker): use separate wrangler config for vitest
- fix(unlocks): pad last grid row with spacers to fix alignment
- feat(growth): add 150 common items + reclassify existing tiers
- fix(pnpm): remove unused expo-blur dependency
- fix(web): catch icon font load timeout in WeChat WebView
- fix: resolve quality check failures (knip, contract tests, formatting)
- fix(home): unify card spacing and add gacha chevron
- Merge branch 'feature/gocha_system'
- feat(gacha): ui polish, ticket badge, settings entry, welcome bonus
- fix(web): detect mini-program web-view via wxcode URL param
- feat(gacha): add gacha capsule machine system
- chore: remove obsolete preview HTML files
- feat(nameStyle): add name text effects end-to-end
- refactor(theme): update primary color values and description for consistency
- style(theme): apple-style bottom panels with hairline separators
- refactor(theme): update color values and remove alpha adjustments for consistency
- refactor(room): integrate three-tier BottomActionPanel with declarative layout
- feat(room): add useBottomLayout hook
- feat(room): add resolveBottomLayout pure function + 39 tests
- feat(room): add BottomLayout types, static button registry, and LAYOUT_RULES
- fix(safe-area): upgrade react-native-safe-area-context to 5.7.0
- fix(safe-area): use record edges to prevent phantom bottom inset on web
- fix(web): correct viewport height for PWA and WeChat web-view
- fix(styles): add flexGrow to listContent for improved layout consistency
- fix(room): update seat status checks to reflect kicked player state
- refactor(screens): unify header, container, and padding patterns
- fix(nav): remove presentation:'modal' from full-screen pages
- fix(nav): make contentStyle transparent so screenLayout gradient shows through
- style(room): elevate visual atmosphere across RoomScreen and app
- fix(styles): remove background color from emptyTile style in SeatTile
- fix(styles): update cardBFooterHint color and remove unnecessary styles
- fix(styles): remove background color from cardSelected style
- fix(test): update known violation line number after import shift
- fix(room): add missing shadows import to SeatTile
- style(auth): modal card elevation + avatar strip shadow + button shadow
- style(music): track row tint + radio modernization
- style(animation-settings): option card elevation + preview section polish
- style(notepad): input elevation + legend bg tint + AI button fill
- style(unlocks): progress bar hero treatment + cell elevation + tab shadow
- style(avatar): thicker tab indicator + grid cell elevation
- style(settings): growth section hero treatment + thicker XP bar
- style(config): section header accent + stepper count tint + template pill shadow
- style(room): seat tile elevation + empty seat dashed border
- style(room): night progress gradient + board info header accent
- style(screens): polish encyclopedia, board picker, avatar, unlocks
- style(settings): tinted growth card, thicker XP bar, red sign-out
- style(config): stronger chip fill, styled hint banner
- style(room): polish seat tiles and bottom action panel
- style(home): polish action cards and tip cards
- style(button): gradient fill for primary variant
- style(home): gradient hero card for create-room CTA
- style(theme): enlarge border-radius and tinted purple shadows
- style(theme): refresh color palette — warmer purple tones with game atmosphere
- fix(seed): use execFileSync to avoid shell injection from path
- feat(nomination): deduplicate identical board nominations
- docs: fix corrupted emoji in README cross-platform section
- refactor(nomination): use cardBase + add role preview on chip press
- style(nomination): use cardBase pattern for nomination cards
- feat(nomination): show board name as card title instead of author
- feat(auth): replace display name with werewolf-themed random nicknames
- feat(nomination): accordion expand for nomination cards
- refactor(config): improve type narrowing and add missing lint comment
- fix(nomination): preserve boardNominations on adopt and restart
- fix(config): merge competing effects into single priority-based init
- docs: update READMEs — fix outdated board count, add R2/WeChat, remove PWA offline claim
- fix(stats): skip stats fetch for anonymous users at service layer
- fix(logger): forward info+ severity to Sentry Structured Logs to save quota
- fix(log): prefix Sentry log messages with [module] for readability
- perf(auth): skip redundant bindWechat on startup if already bound
- docs: update stale references after code audit migrations
- fix(room): suppress ghost loading-timeout warn on leave-room
- fix(logging): downgrade share-card pre-capture to debug, skip delegation warn before role assignment
- build(deps): upgrade vitest 3→4, pool-workers 0.8→0.13 + minor dep bumps
- refactor(api-worker): remove unused DrizzleDb type
- refactor(logging): structured Sentry logs transport + codebase-wide log cleanup
- feat(logger): add Sentry transport for structured logging in production
- refactor(build): remove ESM compilation step for game-engine
- refactor(api-worker): migrate raw D1 SQL to Drizzle ORM
- feat(sentry): enable structured logging (Logs beta)
- refactor(storage): migrate AsyncStorage to react-native-mmkv
- fix(settings): skip user stats query for anonymous users
- refactor(data): migrate to TanStack Query v5
- chore(deps): remove unused react-test-renderer
- refactor(icons): unify on Ionicons, remove lucide-react-native
- ci: upload source maps to Sentry on deploy
- refactor: migrate LoadingScreen and ConnectionStatusBar from Animated to Reanimated
- refactor: use Context as provider instead of Context.Provider (React 19)
- refactor: replace forwardRef with ref-as-prop (React 19)
- chore: remove dead code detected by knip --production
- chore: enable format-on-save with Prettier in VS Code
- refactor: remove PageGuideModal onboarding system
- docs: clarify Web as primary platform in copilot instructions
- fix(e2e): use testids for seat confirm modal selectors
- chore(api-worker): remove unused @hono/zod-validator dep and un-export internal types
- style(ui): unify Chinese copy to 2026 conventions
- refactor(api-worker): migrate to hono framework
- feat(api-worker): add zod runtime validation for all handler endpoints
- fix(ux): improve board-to-config flow copy for discoverability
- docs(instructions): enforce doc lookup before using training data
- feat(BoardPicker): add subtitle hint and soften select button text
- refactor(modal): replace deprecated TouchableWithoutFeedback with Pressable
- perf(avatar-picker): virtualize frame/flair tabs with FlatList
- feat(unlocks): view other players' collections from profile card
- feat(dx): add db:seed:local script with dev user and full item unlock
- fix(music-settings): increase VolumeSlider thumb and track size for easier dragging
- feat(growth): add 10 new avatar frames and update reward catalog
- fix(wolf-reveal): restore RadialGradient in fog Picture to prevent text occlusion
- perf(wolf-reveal): merge fog/blood into Picture API, reduce useDerivedValue by 76%
- perf(reveal-effects): replace Skia with Reanimated in RevealBurst/AtmosphericBackground
- refactor(seatFlairs): rewrite all 30 flairs from Skia Canvas to react-native-svg
- fix(growth): use Set union for unlock count to avoid double-counting free items
- Revert "perf(web): virtualize flair grid to fix WebGL 16-context limit"
- perf(web): virtualize flair grid to fix WebGL 16-context limit
- feat(growth): add 20 new seat flair particle effects (Skia)
- feat(profile): redesign player profile card with game-card style
- fix(e2e): update seating tests for player profile card on seat tap
- ci(knip): add knip to quality pipeline as strict dead-code gate
- chore: remove dead code detected by knip
- docs: add growth system, seat flairs, missing screens to README and instructions
- feat(roomscreen): allow VIEW_PROFILE in all non-ongoing phases
- feat(room): add player profile card on seat tap
- chore(scripts): add backfill-xp one-time script for user_stats
- refactor(ui): extract shared UserAvatar component, fix room badge truncation
- feat(flair): seat flair system, reward tuning, unlocks tab, room level badge
- feat(growth): add UnlocksScreen with tab-based avatar/frame gallery
- style(settings): inline level pill next to name, compact growth section
- style(board): merge hint text and nomination buttons into single row
- feat(avatar): sort frame picker — unlocked frames first
- fix(growth): roomCode:revision idempotency key + fix {seat}号 duplicate suffix
- refactor(growth): roster update via processAction + alarm-based settle retry
- refactor(night): remove dead endNight HTTP/facade chain
- fix(growth): settle trigger via audioAck + roster level broadcast + toast 10s
- feat(growth): level-based reward unlock — frame every 3 levels, avatar otherwise
- refactor(theme): remove multi-theme system, use static light colors
- refactor(branding): rename 大柠檬助手 to 狼人kill电子裁判
- fix(share): remove toast hint hidden behind wx.previewImage overlay
- fix(ui): move toast position to bottom-center to avoid blocking speech order
- refactor(roster): extract display fields from Player into GameState.roster
- chore(deps): update expo to ~55.0.14
- fix(share): add toast hint after wx.previewImage in mini program
- feat(user-avatar): add level badge to UserAvatar component
- docs(worker): update wrangler.toml comments for R2 lifecycle + cron tasks
- feat(share): mini program battle report via R2 upload + wx.previewImage
- chore(deps): update expo packages to SDK 55 expected versions
- fix(share): use Canvas 2D for mini program, revert html2canvas workarounds
- ci(miniapp): fix secret name to MINIAPP_UPLOAD_KEY
- ci(miniapp): add deploy-miniapp job to auto-upload on miniapp/ changes
- fix(share): clone card to document.body for html2canvas capture
- fix(share): reposition cloned container in onclone for html2canvas capture
- fix(auth): move wxcode auth into CFAuthService to fix race with room init
- fix(share): use html2canvas onclone to fix truncation from ancestor overflow:hidden
- fix(share): fix html2canvas truncation caused by RN Web overflow:hidden
- feat(growth): random unlock rewards per level-up
- fix(share): fix truncated battle report capture and improve overlay hint text
- fix(bgm): reuse HTMLAudioElement across playlist tracks
- feat(share): add long-press image overlay for mini program battle report sharing
- feat(growth): simplify to level-only system with settle toast
- fix(growth): count anonymous in threshold & merge card
- fix(brand): rename 大柠檬狼助手 to 大柠檬助手, remove wolf emoji from header
- refactor(settings): replace inline name edit with prompt modal
- fix(api): persist custom_avatar_url to D1 on avatar upload
- fix(audio): add timeupdate fallback for BGM in WeChat web-view
- feat(growth): merge growth system (P0+P1)
- feat(avatar): sort unlocked avatars to front of grid
- feat(growth): add P1 collection screen, growth card, avatar unlock
- fix(chat): prevent bubble from jumping when keyboard opens
- fix(bgm): reuse AudioContext across playlist tracks
- fix(nav): set Home screen title to 大柠檬狼助手
- fix(ui): rename app title 狼人杀法官 → 大柠檬狼助手
- fix(miniapp): rename title to 大柠檬狼助手
- feat(growth): add P0 growth system
- feat(web): show loading percentage in splash screen
- fix(web): remove Service Worker to prevent stale cache white screen
- fix(web): real loading progress via PerformanceObserver, earlier refresh button
- fix(settings): hide switch-account and logout in miniprogram for all users
- fix(auth): account merge UNIQUE constraint conflict on wechat_openid
- fix(auth): handle account merge errors and update logging for merge failure
- style(settings): add desc text to dresserEntry bind buttons
- feat(settings): dresserEntry style bind buttons + hideDisplayName for existing account bind
- style(settings): use outlineButton for miniprogram bind options
- style(settings): replace bind buttons with card-style UI for miniprogram
- fix(auth): preserve existing email session over wxcode in loadUser
- fix(settings): hide logout/switch for wechat-only users in miniprogram
- feat(auth): wechat account merge with existing email account
- ci: auto-apply D1 migrations before worker deploy
- fix(api-worker): allow WeChat users to upgrade to email in-place
- feat(client): add bind-email UI for WeChat users
- feat(auth): add WeChat login flow (miniapp wx.login → web auto-login)
- feat(api-worker): add WeChat login + bind-wechat auth endpoints
- feat(client): update QRCodeModal mini program guide for direct room entry
- feat(miniapp,client): share with room URL + restore last page + JSSDK
- docs(meta): add WeChat mini-program to platform docs and fix descriptions
- feat(client): show WeChat forward guide in QRCodeModal for mini program
- fix(web): allow mini program web-view to bypass WeChat overlay
- feat(miniapp): add WeChat mini program web-view shell + domain verification
- fix(client): bottom bars extend into safe area with own paddingBottom
- fix(client): re-fetch state on same-room reconnect + skip store reset
- fix(client,web): fix bottom safe-area color + dynamic theme-color sync
- fix(client): iOS native safe-area pattern — header owns top inset, container uses background
- fix(client): add colors.background to scroll/content areas (iOS grouped pattern)
- fix(client): unify safe-area background to colors.surface across all screens
- fix(client): use edges+useSafeAreaInsets for bottom safe-area across all screens
- docs(copilot): add husky/lint-staged detail and --no-verify prohibition to verification pipeline
- feat(api-worker,game-engine,client): add lastAction envelope for passive toast
- refactor(client): compact nomination cards with expand/collapse toggle
- fix(web): remove duplicate safe-area padding on body
- feat(game-engine,api-worker,client): add board nomination feature + fix leaveSeat status check
- refactor(client): remove defensive ?? false on required boolean hasViewedRole
- chore: regenerate pnpm-lock.yaml for api-worker test deps
- docs: update instructions and READMEs for DO SQLite architecture
- feat(api-worker): add vitest DO tests + D1 column cleanup migration
- refactor(api-worker): remove D1 gameStateManager and broadcast relay (Phase 2)
- feat(api-worker): migrate game state from D1 to Durable Objects (Phase 1)
- fix(client,e2e): correct kick wording from 踢出房间 to 移出座位
- feat(game-engine,api-worker,client): add host kick player feature
- test(e2e): update seating tests for host kick feature
- feat(audio): add 2s gap between playlist BGM tracks
- feat(client): redesign HomeScreen with UserAvatar, RandomRoleCard, dynamic tips
- docs: update matrix, add preset boards ref, fix specs header
- docs: enrich README with motivation, expanded features, FAQ, star history & contributors
- docs: split README into zh-CN/en with language switcher

## [2.0.0] - 2026-04-08

- refactor(game-engine,api-worker,client): replace HandlerResult boolean with discriminated union
- refactor(client): replace emoji with Ionicons in UI elements
- refactor(client): upgrade VolumeSlider to react-native-awesome-slider
- style(client): move 'none' animation option next to 'random' in picker
- refactor(client): replace emoji with Ionicons in MusicSettingsScreen
- feat(client): redesign MusicSettingsScreen with improved UX
- fix(client): sync animation setting to gameState via popTo
- fix(client): inject JWT token in AIChatService streaming request
- docs: mark P5 layer-A fixes in code-audit report
- test(game-engine): add unit tests for untested handlers and utils
- docs: mark completed audit items in code-audit report (P0-P4)
- fix(api-worker,game-engine,client): resolve P4 audit issues (M22, M14, M35)
- fix(client,api-worker): resolve P5 layer-A runtime risk issues from audit
- refactor(client,game-engine): resolve P3 code quality issues from audit
- fix(api-worker): patch 4 P1 security issues from code audit
- fix(game-engine,client): resolve P2 correctness bugs from code audit
- fix(api-worker): patch 4 P0 security/reliability issues
- refactor(settings): remove animation and music entries from SettingsScreen
- fix(slider): add touch-action none to prevent browser scroll during drag
- fix(avatar): await profile sync and add missing avatarFrame to takeSeatWithAck
- fix(lint): use sourceType commonjs for **mocks**/\*.js instead of no-undef off
- feat(audio): add BGM toggle in room header + music/animation settings screens
- refactor(instructions): slim copilot-instructions, extract RoomScreen state machine to docs
- feat(skills): add new-role and new-board skills, consolidate old instruction files
- feat(audio): add BGM track selection with playlist shuffle mode
- Add files via upload
- Add files via upload
- Add files via upload
- Add files via upload
- fix(config): correct 8 inaccurate guide content items to match actual UI
- feat(config): add page guide for BoardPicker and Notepad screens
- chore: sync pnpm-lock.yaml after esbuild removal from game-engine
- feat(splash): add refresh button after 8s timeout with cache clearing
- fix(wechat): block SPA loading in WeChat WebView to preserve original URL
- refactor(og): replace UA detection with HTMLRewriter for universal dynamic OG
- fix(og): remove MicroMessenger/QQBrowser from crawler UA list
- feat(room): promote copy-link button to primary in QR modal
- feat(config): add custom domain support (SITE_URL, OG meta, linking prefixes)
- feat(config): add custom domain support (SITE_URL, OG meta, linking prefixes)
- docs: update deployment docs from vercel to cloudflare pages
- fix(navigation): generalize deep-link Home injection + add contract test
- fix(config): increase testTimeout to 10s for parallel board UI tests
- fix(navigation): inject Home under auth screens for web deep-link/refresh
- fix(auth): use correct Resend verified domain in FROM address
- fix(auth): map CF API errors to Chinese + prevent double-submit on forgot password
- ci(config): purge CDN cache after frontend deploy
- fix(web): disable immutable cache for JS bundles
- fix(auth): clear stale pending action and fix AvatarPicker readOnly
- feat(auth): upgrade avatar preview card and unify button styles
- feat(auth): add password reset flow with email verification
- chore(deps): update expo packages to compatible versions
- feat(config): bind custom domain api.werewolfjudge.eu.org
- fix(hooks): auto-scroll chat to bottom on bridge-initiated messages
- feat(components): add AI role play guide to role cards
- fix(services): convert 0-based seat to 1-based in AI notepad analysis
- fix(services): make CONNECT a global FSM transition and use typed SupersededError

## [1.13.0] - 2026-04-06

- chore(models): update maskedMan avatar and badge
- fix(config): neutralize screen flash color to prevent alignment leakage
- refactor(models): replace badge images with animal emojis in RoleHunt animation
- refactor(models): align template names, audio, docs with official terminology
- refactor(models): align role displayNames with official NetEase Werewolf terminology
- docs(models): clarify piper loss condition in description
- fix(night): correct death reason labels for wolfQueenLink and checkDeath
- feat(game-engine): add deathReasons tracking via calculateDeathsDetailed
- fix(night): add missing annotations to night review summary
- feat(models): add cursedFox role and 咒狐乌鸦 12p template
- feat(game-engine): add maskedMan role and treasureMaster S21 board support
- fix(models): normalize maskedMan/treasureMaster descriptions and fix wolf vote visibility
- fix(engine): authoritative canShoot for all linked-death causes
- fix(theme): migrate deprecated shadow style props to cross-platform API
- fix(deps): pin react 19.2.0 for Expo SDK 55 compatibility
- chore(deps): upgrade compatible dependencies
- fix(room): use onLayout for PlayerGrid tile size calculation
- chore: remove unused exports, types, and dead barrel file
- fix(services): add disconnect() to prevent permanent Disposed state
- fix(services): address second FSM review findings
- fix(services): address FSM review findings P1-P4 + #7
- fix(services): preserve attempt counter across Syncing, retry fetch in-place
- refactor(services): rewrite reconnection as deterministic FSM
- fix(pwa): add Cache-Control no-cache for HTML to prevent white screen
- refactor(services): clean up reconnection system for CF architecture
- fix(settings): hide switch-account and logout buttons during password change
- fix(e2e): remove flaky URL assertion in non-existent room test
- refactor(e2e): remove run-e2e-web.mjs and simplify devConfig
- fix(auth): update user state after signInAnonymously
- chore: remove all Supabase code, Edge Functions, and dependencies
- feat(auth): add change password for logged-in email users
- fix(ci): build game-engine before deploying api-worker
- style(api-worker): autofix import sort in index.ts
- ci(e2e): switch from local Supabase to wrangler dev --local
- fix(e2e): click template pill instead of back button in ConfigPage
- chore: remove temp migration scripts, gitignore .wrangler/
- fix(ci): add packageManager: pnpm to wrangler-action
- style: format migration script
- Merge pull request #42 from olveryu/feat/cf-full-migration
- ci(frontend): switch deploy-frontend to cloudflare backend, drop supabase env vars
- ci: add deploy-api-worker job for Cloudflare Workers auto-deploy
- fix(config): separate env vars per backend to avoid .env.local override
- fix(api-worker): remove extra param binding in room create with initialState
- fix(notepad): preserve Room in nav stack after Stale Tab reload
- chore(config): set real CF Worker URL in api.ts
- chore(api-worker): enable R2 bucket binding
- chore(api-worker): set D1 database_id, make R2 optional
- feat(services): add bcrypt dual-hash verification + user migration script
- fix(notepad): preserve Room in nav stack after Stale Tab reload
- fix(config): use popTo to return to Config from BoardPicker
- fix(config): preserve edit mode when navigating to BoardPicker
- feat(services): implement cloudflare workers backend (phases 1-4)
- refactor(services): extract service interfaces and create ServiceRegistry
- feat: init Supabase to Cloudflare full-stack migration
- feat: init Supabase → Cloudflare full-stack migration
- fix(config): default splash theme to light, validate themeKey before use
- fix(config): password input styling & animation validation
- ci: remove PR edge deploy + restore-edge-functions job
- fix(ci): fix JSON generation for local Supabase config
- ci(deploy): add Cloudflare Pages deploy job via wrangler-action
- ci(e2e): switch from remote to local Supabase

## [1.12.0] - 2026-04-03

- docs: update all Vercel references to Cloudflare Pages
- chore(deploy): remove vercel.json after Cloudflare Pages migration
- chore(deploy): fix Cloudflare Pages config
- chore(deploy): add wrangler.json for Cloudflare Pages config
- chore: add .node-version for Cloudflare Pages build
- chore(deploy): migrate frontend hosting from Vercel to Cloudflare Pages
- fix(e2e): seer reveal uses '狼人' not '坏人' for wolf faction
- fix(e2e): handle thief disabled card and dynamic wolf faction
- fix(room): use effective role in buildSeatViewModels and bottomActionBuilder
- fix(room): getWolfVoteSummary uses effective role for vote count
- fix(game-engine): bottom card actors use effective role for all steps
- fix(game-engine): use Chinese bot display names with formatSeat
- feat(services): configurable maxTokens, confirm dialog, recorder identity
- refactor(game-engine): add formatSeat() and eliminate scattered seat+1 conversions
- fix(ai-chat): fix 1-based seat keys in notepad summary and add hand summary line
- fix(notepad): stay on notepad screen after AI analysis request
- feat(ai-chat): add AI notepad analysis from NotepadScreen
- feat(night): add VortexCollapse reveal animation
- refactor(notepad): promote notepad from Modal to independent Screen
- feat(night): add MeteorStrike and FilmRewind reveal animations
- feat(ai-chat): add werewolf terminology quick questions and increase to 6 slots
- fix(night): raise ScratchReveal auto-reveal threshold to 25%
- fix(night): fix EnhancedRoulette SPIN button overlap and credit display
- feat(config): increase wolf and villager max count from 5 to 10
- refactor(night): unify autoTimeout + hint/warning across all 9 reveal effects
- feat(night): rewrite RoleHunt as scope-sniper reveal animation
- refactor(components): extract useRevealLifecycle hook from reveal effects
- fix(services): prevent zombie channel on subscribe failure and retry CLOSED
- docs(instructions): align rules with executable source of truth
- feat(web): add indeterminate progress bar to web splash screen
- perf(avatar): use 512px thumbs for picker grid and preview strips
- refactor(settings): extract AvatarPickerScreen from bottom sheet to full screen
- feat(room): add indeterminate progress bar to LoadingScreen
- feat(game-engine): add 白狼王守卫 preset template
- chore: update lockfile after sharp removal
- feat(config): show template count per category tab in BoardPicker
- chore: remove dead exports (sharp, FormTextFieldProps, FactionStats, TemplateRoleItem)
- chore(contexts): remove dead NetworkContext (zero consumers)
- refactor(config): migrate toast library from react-native-toast-message to sonner-native
- feat(game-engine): add mark-bots-group-confirmed for debug mode
- refactor(components): extract business logic from AIChatBubble to caller
- feat(night): add thief & cupid roles with bottom card modal refactor

## [1.11.0] - 2026-03-31

- fix(services): unify error code mapping and fix error handling quality
- fix(services): improve error handling quality across 7 files
- refactor(components): extract BaseCenterModal from center modals
- refactor(components): extract FormTextField from repeated TextInput patterns
- refactor(utils): extract showAlert preset helpers to reduce boilerplate
- refactor(game-engine): split stepTransitionHandler into focused modules
- fix(room): stale tab auto-reload after 5min iOS background
- fix(e2e): scope locators to screen roots to avoid strict mode violations
- feat(config): replace template picker with full-screen BoardPickerScreen
- fix(config): catch sw reg.update() to prevent unhandled rejection on iOS
- fix(room): defer share card capture to user interaction to fix e2e flakiness
- fix(room): use visibility:hidden for share card to prevent false E2E night-end detection
- style(theme): unify button and alert modal border radius to capsule shape
- fix(room): pre-cache share card screenshot & allow shared players to share report
- fix(pwa): bypass HTTP cache for sw.js to ensure timely updates
- chore(sw): remove leftover \_\_diag_reload writes from SW update paths
- fix(settings): suppress LoginOptions flash during auth initialization
- chore(deps): align @types/react and jest-expo with expo sdk 55
- fix(config): read navType synchronously so React can access it before mount
- refactor(game-engine): extract isBlockedByNightmare helper and rename processPoisonDeath
- refactor(config): unify wolf attack terminology — 刀/击杀/杀人 → 袭击
- fix(narration): update nightmare prompt to reflect player selection change
- chore(config): add reload stack proxy + navType DIAG for avatar flash root cause
- fix(audio): replace recursive re-check with bounded while loop in playPendingAudioEffects
- fix(theme): use typography.captionSmall token in DIAG banner style
- fix: update resetAllGuides to use multiRemove for better performance
- chore(config): add DIAG step tracking to avatar/frame handlers for pagehide root cause
- feat(pwa): add proactive SW update polling on interval and visibility change
- fix(night): remove redundant bottom-card skip lines from night review summary
- refactor(game-engine): unify wolfVoteDeadline + autoSkipDeadline into stepDeadline
- chore(settings): move reload DIAG into settings red banner
- chore(sw): add DIAG reload source tracker to find avatar flash cause
- chore(settings): add auth state DIAG banner to debug avatar flash
- test(e2e): add treasureMaster night flow E2E test
- fix(room): remove canShare gate to fix image share on Chrome iOS
- fix(sw): add update dialog and JS bundle precache to prevent white screen
- chore: remove DIAG logging after fix verification
- fix(game-engine): defer autoSkipDeadline until audio finishes to prevent clock race
- fix(sw): remove leftover DIAG in showUpdateOverlay fallback
- fix(auth): only clear user on SIGNED_OUT event in onAuthStateChange
- style(alert): reduce border radius and button padding
- diag(settings): track auth state transition history
- chore: add DIAG banner + lifecycle tracking to SettingsScreen
- fix(night): treasureMaster actioner override + autoSkipDeadline for vacant steps
- fix(ChooseBottomCardModal): update typography and spacing for card styles
- fix(config): restore updatefound SW listeners
- fix(room): update confirmation text in ChooseBottomCardModal to use currentSchema
- chore: upgrade DIAG to localStorage + pagehide + visible banner
- fix(room): replace roles.length with numberOfPlayers for seat count
- fix(config): remove mid-session SW updatefound auto-reload
- fix(game-engine): use getPlayerCount for bot fill and template picker
- fix(room): show correct player count and seats for treasureMaster boards
- feat(game-engine): add 盗宝大师 preset template + board UI test
- feat(game-engine): add treasureMaster UI + integration tests
- feat(game-engine): implement treasureMaster role (B-E)
- revert(config): restore original SW update logic
- fix(config): prevent mid-session SW update reload
- feat(game-engine): support treasureMaster bottom card shuffle and lifecycle
- fix(service-worker): streamline service worker registration code
- fix(room): fix SealBreak freeze and add tap-to-charge support
- refactor(game-engine): replace wolfKillDisabled with self-contained wolfKillOverride object
- feat(models): add crow and poisoner roles with night-1 empty-knife rule
- fix(audioRegistry): increase BGM volume for better audio clarity
- fix(room): remove contentContainer wrapper in NightReviewModal
- fix(AvatarPickerSheet): restructure modal layout for improved usability
- fix(GameFacade): prevent automatic seat leaving when rejoining room
- fix(room): responsive layout fixes for small screens
- fix(RoleDetailSheet): remove emoji display from role details
- feat(models): add encyclopedia screen redesign with ability tags
- fix(theme): unify header text sizes across screens
- fix(room): unify header icon sizes and fix button spacing
- docs(models): split new-role instructions into concise SOP + templates doc
- docs: update new-role SOP for genericResolver and night1 removal
- chore: remove dead code (test-only exports and unused functions)
- Merge pull request #40 from olveryu/feature/refactor_spec
- feat(game-engine): implement bonded link death for shadow ↔ avenger
- refactor(game-engine): derive RoleSeatMap from deathCalcRole + reflectionSources
- fix(room): close seat modal on takeSeat failure to unblock UI
- refactor(game-engine): remove Night-2 dead code from piperHypnotizeResolver
- refactor(game-engine): enhance role ID validation in buildNightPlan and genericResolver
- refactor(game-engine): use dedicated piperHypnotizeResolver instead of generic
- refactor(game-engine): remove redundant night1.hasAction field
- fix(game-engine): use secureRng in genericResolver random transformer
- ci: deploy edge functions on PR + restore after E2E
- refactor(game-engine): flatten v2/ into spec/ top level (P10)
- refactor(game-engine): convert wrappers to re-export stubs + update barrel (P9-C)
- refactor(game-engine): move helpers + derivation into v2/ files
- refactor(game-engine): rename V2-suffixed symbols to canonical names
- chore(game-engine): delete V1 spec.types.ts (P8-C)
- docs: add P8 section to rolespec-schema-redesign design doc
- refactor(game-engine): derive SCHEMAS from V2 specs (P8-B)
- refactor(game-engine): switch specs + helpers to V2 re-exports (P8-A)
- refactor(game-engine): derive NIGHT_STEPS from V2 specs
- refactor(game-engine): remove 19 replaced V1 resolver files + 19 tests
- refactor(game-engine): update consumers to use V2 specs
- refactor(game-engine): data-drive confirmContext + revealPayload from V2
- refactor(game-engine): wire V2 nightPlan + schemas into existing consumers
- test(game-engine): add V2 nightPlan + schemas equivalence tests
- feat(game-engine): add buildNightPlanFromV2 and buildSchemasFromV2
- refactor(game-engine): migrate 21 resolvers to genericResolver
- feat(game-engine): implement genericResolver with all effect processors
- test(game-engine): add v1-v2 equivalence contract tests
- feat(game-engine): add v2 specs registry with all 36 roles
- feat(game-engine): add v2 role spec type definitions
- feat(role): add interaction field to RoleDescription and update related components
- feat(room): keep seat confirm modal open with spinner until server responds
- feat(realtime): enhance channel subscription with retry logic and improve error handling
- refactor(models): rename 9 preset templates for clarity
- perf(ui): skia picture API + shader warmup + badge prefetch
- fix(ui): use safe area insets for reveal effect top-positioned text
- feat(ui): add lucide icons and semantic label colors to RoleDescriptionView

## [1.10.0] - 2026-03-26

- fix(service-worker): skip reload on first SW install to prevent double-load
- feat(executors): implement clearExecutors function to support HMR
- fix(models): complete role descriptions with missing winCondition and restriction
- style: fix web/index.html formatting
- feat(game-engine): add psychic and pureWhite roles with reflection mechanics
- fix(models): add bonded attack details to avenger description
- feat(models): add shadow & avenger roles with bonded mechanic
- style(notepad): improve role badge and input discoverability
- refactor(service-worker): remove auto-refresh on new service worker activation
- feat(shareImage): enhance web sharing with improved canShare checks and fallback
- feat(service-worker): add auto-refresh on new service worker activation
- feat(night): wolf reveal crack + blood trail visual overhaul
- feat(config): upgrade role reveal effects with Skia visuals and lint cleanup

## [1.9.0] - 2026-03-23

- chore: add .tool-versions to .gitignore
- chore: remove .tool-versions file
- fix(RealtimeService): handle zombie channels on leaveRoom and update tests
- Merge pull request #36 from olveryu/renovate/supabase
- ci(renovate): run prettier on upgraded files via postUpgradeTasks
- Merge branch 'main' into renovate/supabase
- Merge pull request #39 from olveryu/renovate/migrate-config
- ci(renovate): add minimal permissions block to fix CodeQL alert
- style: format renovate.json with prettier
- chore(config): migrate config renovate.json
- fix(deps): update dependency @supabase/supabase-js to ^2.99.3
- chore(deps): update commitlint monorepo to ^20.5.0 (#34)
- chore(deps): update eslint (#33)
- build(deps): upgrade @sentry/react-native v7→v8
- build(deps): upgrade @react-native-async-storage/async-storage v2→v3
- ci: upgrade pnpm/action-setup v4→v5, checkout v4→v6 in renovate
- ci(renovate): use global config file for repository discovery
- ci(renovate): specify target repository
- chore(deps): remove recreateWhen workaround
- chore(deps): add recreateWhen to force-rebuild closed PRs
- ci: skip Pages deploy on PR branches
- fix(ci): use correct renovatebot/github-action version tag
- ci: add self-hosted Renovate workflow
- chore(deps): update marocchino/sticky-pull-request-comment action to v3 (#25)
- fix(deps): update dependency @shopify/react-native-skia to v2.5.3 (#20)
- chore(deps): update pnpm to v10.32.1 (#18)
- chore(deps): update node.js to v22.22.1 (#17)
- chore(deps): update node.js to >=20.20.1 (#16)
- fix(deps): update expo (#12)
- chore(deps): update dependency deno to v2.7.7 (#15)
- fix(deps): update react-navigation monorepo (#13)
- chore(deps): update dev-tooling (#10)
- chore(deps): update dependency @playwright/test to ^1.58.2 (#8)
- chore(deps): update dependency esbuild to ^0.27.4 (#9)
- ci: narrow edge-change detection to source files only
- chore(deps): add automerge for dev deps and PR concurrent limit
- chore(deps): enable Renovate dependency dashboard
- fix(sw): improve hostname checks for Supabase and CDN requests
- fix(config): exclude .venv from eslint global ignores
- fix(services): add 5s revision polling to detect missed postgres_changes broadcasts
- fix(room): update initial state_revision to 1 during room creation
- fix(room): fix QR share failure on mobile web due to user activation expiry
- fix(room): resolve web console warnings for textShadow, tintColor, and useNativeDriver
- fix(config): replace hardcoded template and avatar counts with dynamic values
- fix(room): defer QR auto-show until page guide is dismissed
- fix(room): reduce page guide delay to 300ms
- fix(room): remove HTML splash on web before signaling app-ready
- fix(room): gate page guide on app-ready signal instead of InteractionManager
- fix(room): use InteractionManager delay for page guide timing
- fix(room): delay page guide until content is loaded
- feat(room): add page-level onboarding guide system
- refactor(template): update selectTemplate method for improved clarity and interaction flow
- fix(docs): update wolf kill target results in alignment matrix
- feat(models): replace avatar & badge assets with role-specific art
- feat(avatar): add AI-generated prompts for character avatars in Werewolf game
- refactor(room): simplify header, unify header tokens, improve template picker UX
- fix(room): restrict bot takeover banner to host only
- style(room): increase gap between notepad button and collapse chevron
- fix(room): skip message fade animation on web to prevent E2E visibility race
- style(room): remove wolf tile borderColor to preserve default border
- style(room): wolf tile use shadow glow instead of thick border
- style(room): redesign ready badge and wolf tile styling
- fix(e2e): dismiss auto-shown qr modal after room creation
- feat(room): auto-show qr invite card after room creation
- feat(room): add host guide banner for contextual phase hints
- fix(services): add isNetworkError() and E2E disconnect recovery
- feat(perf): preload CanvasKit WASM at app boot for web
- feat(models): enhance ChainShatter and RoleHunt reveal animations with Skia effects
- fix(copilot): add guideline against oversimplifying solutions for better code quality

## [1.8.0] - 2026-03-16

- fix(config): fix FortuneWheel pointer landing on wrong segment
- feat(config): redesign FortuneWheel with jewel colors, gold rim, and RN text labels
- fix(config): remove fateGears migration code and fix matchFont web crash
- refactor(config): rename FateGears to FortuneWheel across codebase
- feat(config): redesign FateGears as prize wheel spinner
- fix(config): remove duplicate hint in FateGears animation
- fix(e2e): fix stale homeLoginButton refs after profile button removal
- feat(home): split login into 3 buttons, remove profile header icon
- fix(theme): adjust avatar sizing in SeatTile and camera badge position in settings
- fix(night): audit fixes — witch SSOT, reveal timeout, ack retry, subscription leak, promise settle
- docs: add instruction audit prompt template
- docs: audit and sync instruction files, project docs, and add maintenance SOP
- docs(new-role): sync instruction counts — 34 roles, 25 steps, 25 resolvers
- docs(screens): add RoomScreen UI state machine reference to instructions
- chore: remove unused exports, types, and dead code
- style(theme): enhance 6 avatar frames with richer details
- refactor(frames): same-size overlay + dynamic rx for pixel-perfect alignment
- fix(config): reduce frame grid cell size to 72
- feat(theme): replace circular avatar frames with 10 rounded-rect frames
- feat(config): redesign avatar picker with 2-tab layout and hero preview
- refactor(avatar): replace require.context with static requires
- fix(night): move gargoyle convert after all check steps
- feat(auth): add anonymous-to-registered conversion touchpoints
- feat(avatar): use lucide-react-native icons as default avatars
- fix(models): fix theme require cycle, unify autoTimeout, fix roulette re-render, fix e2e assert
- refactor(auth): remove toast notifications from signup success flow
- refactor(auth): skip confirmation alert, show login modal directly
- refactor(avatar): remove avatar categories and related state from AvatarPickerSheet
- feat(config): add avatar category tabs and new avatar images
- fix(night): use correct button label for wolf blocked by nightmare
- fix(e2e): on-demand render NightReviewShareCard to prevent false night-end detection
- fix(e2e): gate nightReviewData on GameStatus.Ended to prevent false night-end detection
- chore(settings): merge feature/fix_bug - persist custom avatar URL
- feat(settings): persist custom avatar URL across builtin switch
- feat(night): show wolf teammates during gargoyle convert step
- feat(settings): add builtin avatar picker sheet
- fix(theme): resolve pre-existing ViewStyle/TextStyle type errors
- fix(mcp): update command to use /bin/zsh for context7 server
- feat(models): add 7 mythical avatars and use require.context for auto-discovery
- refactor(room): replace "我" badge with green seat number indicator
- fix(e2e): migrate setAnimationNone from ConfigPage to RoomPage
- feat(auth): add subtitle to EmailForm for registration guidance
- fix(audio): set BGM_VOLUME to 0.05
- fix(audio): tune BGM_VOLUME to 0.01 for testing
- fix(audio): use Web Audio API GainNode for BGM volume on iOS Safari
- style(screens): unify inner page headers and polish encyclopedia/menu UI
- feat(encyclopedia): update faction filters and replace emoji with role badges
- fix(room): move hidden share card offscreen to prevent layout overlap
- fix(room): restore screenshot capture for battlefield report sharing
- feat(room): move night review share to detail action menu
- Revert "feat(room): add share-to-players button inside NightReviewModal for hosts"
- Revert "feat(encyclopedia): redesign role guide with search, 2-col cards, structured detail & favorites"
- feat(encyclopedia): redesign role guide with search, 2-col cards, structured detail & favorites
- feat(room): add share-to-players button inside NightReviewModal for hosts
- refactor(home): remove last template roles functionality and related code
- refactor(game-engine): remove redundant 12人 suffix from preset template names
- feat(home): quick start directly creates room instead of navigating to config
- feat(home): add role encyclopedia screen
- feat(room): add share screenshot button to NightReviewModal
- feat(home): add quick-start card for last used template
- fix(tests): update role assignments for awakenedGargoyle in 12P board tests
- fix(styles): adjust secondary button background and add margin to outline button
- Revert "feat(avatar): three-tier avatar system with 50 colored Lucide icons for anonymous users"
- feat(avatar): three-tier avatar system with 50 colored Lucide icons for anonymous users
- fix(game-engine): audit fixes — target checks, seat guard, DRY audio, proxy
- fix(models): harden badge system — manifest, resizeMode, test, script
- feat(models): replace emoji text with Fluent Emoji 3D badge images
- fix(e2e): raise WOLF_VOTE_STUCK_THRESHOLD to cover countdown + API timeout
- feat(theme): redesign all 8 themes with 4 light + 4 dark split
- fix(wolf-vote): keep Host interval alive for postProgression retry
- fix(wolf-vote): success-gated postProgression retry on network failure
- Revert "fix(night): fetch DB state after postProgression to cover missed broadcasts"
- fix(night): fetch DB state after postProgression to cover missed broadcasts
- refactor(theme): unify token system, adopt shared presets and textStyles, consolidate imports
- fix(husky): update scripts to include PATH for VS Code GUI commits
- fix(PlayerGrid): update tileSize calculation to use spacing token for consistency
- style(ai-chat): redesign bubble as circular FAB with vertical layout
- refactor(components): redesign AI chat bubble as capsule FAB
- fix(settings): defer signOut until switch-account auth succeeds
- refactor(theme): migrate UI emoji tokens to Ionicons icon system
- refactor(room): move notepad from AIChatBubble to BoardInfoCard header
- fix(hooks): clear notepad when game restarts back to Seated
- fix(e2e): update stale witch self-save copy in night-roles-protect spec
- fix(e2e): add testID to start/restart/lastNightInfo buttons and exact match for '我'
- fix(e2e): use testID for prepare-roles button to avoid getByText collision
- refactor(config): remove faction tab emoji icons
- fix(copy): unify Chinese copy terminology across codebase
- feat(models): unify role reveal animation UX
- refactor(room): extract alert button constants (CANCEL_BUTTON, DISMISS_BUTTON, confirmButton)
- refactor(copy): ux copy optimization pass 2 — prompts, comments, tests
- refactor(copy): systematic UX writing optimization across 48 files
- feat(ci): add Playwright version retrieval and caching to CI workflow feat(emojiTokens): remove Faction labels from emojiTokens for clarity refactor(RoleListByFaction): simplify faction labels by removing emoji references refactor(BoardInfoCard): update role category labels to remove emoji references feat(cleanup): implement cache cleanup for closed pull requests
- refactor(theme): unify emoji usage via centralized token registry
- fix(cors): add x-request-id to allowed headers
- ci: upgrade actions to node24 and opt-in FORCE_JAVASCRIPT_ACTIONS_TO_NODE24
- feat(room): seat continuity after account state changes
- fix(room): make user settings accessible to all players, not just Host
- fix(services): remove optimistic updates from seat operations
- chore(config): add scheduled game function warmup
- feat(config): batch anonymous cleanup and add anomaly guard
- test(e2e): add offline recovery canary and remove fixed wait
- feat(room): add reconnect telemetry and manual recovery alert
- feat(services): configure api region and timeout headers
- style(theme): polish hero card + cross-screen visual consistency
- feat(room): add daily cleanup for stale anonymous users
- style(theme): unify design tokens across all screens
- fix(components): add maxHeight + ScrollView + close button to SettingsSheet
- refactor(components): extract SettingsChip/ChipGroup, card-ify settings groups
- refactor(e2e): extract shared withSetup, fix polling anti-patterns, remove serial mode
- ci(e2e): reduce concurrency to ease Supabase pressure
- fix(room): pass raw roleRevealAnimation to SettingsSheet in RoomScreen
- fix(e2e): reduce flakiness across seating, db-recovery, and night-driver
- ci(release): create GitHub Release for all tags including patch

## [1.7.1] - 2026-03-09

- fix(e2e): close RoleCardSimple via confirm button instead of Escape
- fix(config): add zIndex to RoleCardSimple cardWrapper for mobile touch
- fix(config): sibling-layout modal to fix double-tap dismiss bug
- refactor(config): extract FactionChip, fix faction color & modal tap
- refactor(config): merge VariantPicker into RoleCardSimple pill bar
- feat(config): tap role chip in template picker to preview RoleCardSimple
- fix(config): use typography.body (16px) for search input to prevent iOS zoom
- fix(e2e): update ConfigPage.selectTemplate for accordion TemplatePicker
- style(theme): unify UI across Home/Config/Room/Settings screens
- refactor(theme): unify visual tokens — activeOpacity, button heights, lineHeights, magic numbers
- feat(tests): add contract test to enforce design token usage in styles
- fix(config): prevent search bar tap from closing TemplatePicker modal
- feat(config): redesign template picker with SectionList accordion cards
- feat(models): add warden role and 孤注一掷12人 board template
- fix(e2e): fix awakened gargoyle E2E variant selection and night flow
- fix(role): standardize role descriptions for consistency

## [1.7.0] - 2026-03-08

- fix(audio): improve awakened gargoyle TTS narration fluency
- fix(room): bubble label background, settings alignment & lock
- feat(game-engine): add awakened gargoyle role with convert + groupConfirm reveal
- Merge pull request #7 from olveryu/feature/refactor_1
- docs: remove groq-proxy, unify architecture refs, add gemini-proxy to CI
- fix(refactor): address self-review findings
- ci: skip e2e on PRs that modify edge functions or game-engine
- ci: enable e2e jobs on pull_request events
- docs(refactor): cleanup dead code and update docs
- refactor(services): remove IGameFacade union compat layer
- refactor(imports): migrate remaining deep imports to barrel
- refactor(imports): migrate deep imports to barrel — models + types
- refactor(game-engine): split gameReducer by action category
- refactor(game-engine): split actionHandler by concern
- refactor(components): split AIChatBubble monolithic styles into sub-files
- refactor(room): split RoomScreen monolithic styles into per-component files
- refactor(config): split ConfigScreen monolithic styles into per-component files
- refactor(services): migrate gameActions to defineGameAction factory
- refactor(services): add defineGameAction declarative factory
- refactor(room): consolidate useRoomScreenState after extraction (C14)
- refactor(room): extract useRoomSettings from useRoomScreenState (C13)
- refactor(room): extract useRoomDerived from useRoomScreenState (C12)
- refactor(room): extract useRoomIdentity from useRoomScreenState (C11)
- refactor(room): extract remaining executors, shrink useActionOrchestrator (C10)
- refactor(night): extract 4 executors from useActionOrchestrator (C09)
- feat(room): add IntentExecutor interface and registry skeleton
- refactor(services): split IGameFacade into segment interfaces
- refactor(hooks,screens): migrate error handling to errorPipeline
- refactor(services): migrate error handling to errorPipeline
- feat(utils): add errorPipeline unified error handler
- build(game-engine): configure package.json exports subpath mappings
- docs(refactor): record baseline metrics snapshot
- test(architecture): add layer boundary contract tests
- docs(refactor): add comprehensive refactoring plan with commit execution schedule

## [1.6.0] - 2026-03-07

- refactor(config): remove GitHub and Issues links from About section
- feat(room): add persistent "小助手" label below AI chat bubble
- feat(room): add SettingsSheet to RoomScreen via HostMenuDropdown
- test(e2e): add 3 reconnection E2E enhancements
- fix(room): await removeChannel to prevent rejoin race + fix animation loop on web
- feat(connection): enhance foreground recovery logic for DB fetch and channel reconnection
- fix(services): await SDK disconnect before rejoin to prevent subscribe timeout
- fix(services): reconnect audit P2 fixes, observability, and unit tests
- fix(services): harden reconnection mechanism against races and retry storms
- fix(realtime): disconnect stale WebSocket before dead channel rejoin
- fix(connection): stabilize progress bar animation during status flips
- feat(connection): add indeterminate progress bar to disconnection banner
- refactor(hooks): remove retriesExhausted + infinite 5s dead channel retry
- fix(hooks): reconnect dead channel on browser online event
- test(setup): add withAlpha/createSharedStyles/activeOpacity to theme mock
- refactor(theme): misc token fixes — SimpleMarkdown, QRCodeModal, AIChatBubble
- refactor(room): replace hardcoded borderWidth: 1 with fixed.borderWidth
- refactor(theme): unify activeOpacity to fixed.activeOpacity (0.7)
- refactor(room): extract ActionButton/DangerButton shared base styles
- refactor(theme): extract shared iconButton base into createSharedStyles
- refactor(theme): replace hex opacity concatenations with withAlpha()
- feat(theme): add withAlpha() color utility + unit tests
- fix(services): skip sentry reporting for AbortError across all network call sites
- feat(ui): merge feature/new_animation — new animations, SealBreak, menu unification
- feat(ui): unify menu button style, shorten animation labels, align SealBreak conventions
- feat(room): add manual reconnect button when auto-retry exhausted
- fix(ui): fix loading screen logo vertical offset in role reveal
- feat(ui): unify animation backgrounds and enhance role reveal hints
- feat(models): add ChainShatter and FateGears role reveal animations
- fix(build): inject all Expo script tags instead of only the first
- Revert "Revert "Revert "Revert "feat(night): add SealBreak role reveal effect""""
- Revert "Revert "Revert "feat(night): add SealBreak role reveal effect"""
- Revert "Revert "feat(night): add SealBreak role reveal effect""
- perf(roulette): replace setState-driven bulbs with Reanimated shared values
- fix(hooks): reconnect dead channel on foreground after long background
- feat(room): show loading overlay while confirming role view
- refactor(gameActions): update viewedRole to return success status and reason
- Revert "feat(night): add SealBreak role reveal effect"
- feat(night): add SealBreak role reveal effect
- revert: remove unrelated files from previous commit
- style(home): always show generic icon instead of avatar in topbar
- refactor(animation): remove 'constellation' from RoleRevealAnimation types
- fix(e2e): move homeLoginButton testID to visible TopBar avatar
- style(home): remove greeting, add avatar to TopBar, unify button radius
- style(home): refine header layout and tip conditions
- style(home,config): add contextual tip cards, simplify faction tabs
- refactor(home): redesign HomeScreen to Apple HIG layout
- feat(theme): phase-4 finalization — a11y, responsive, dedup, lineHeight
- feat(theme): phase-3 quality upgrade
- feat(theme): phase-2 interaction layer
- style(theme): phase-1 token basics & button unification
- fix(ci): build game-engine ESM before Deno tests
- docs: add trust model rule to copilot instructions
- test(game-engine): add Deno tests for Edge Function handlers
- refactor(game-engine): modularize Edge Function into handler modules
- refactor(room): extract useRoomModals from useRoomScreenState
- refactor(services): extract AudioOrchestrator + ConnectionRecoveryManager from GameFacade
- chore(config): add supabase/ to ESLint scope
- chore(config): quick wins - coverage threshold, sentry rate, e2e gate, assertNever
- feat(seat): skip occupied seats during optimistic updates in takeSeatWithAck

## [1.5.0] - 2026-03-06

- chore(config): remove redundant keep-alive workflow
- feat(alert): implement alert blocking mechanism to manage overlay interactions
- style(web): reduce wechat overlay opacity to 0.75
- feat(web): restore wechat browser overlay guide
- feat(hooks): add wechat-guide mode to usePWAInstall
- fix(room): overlay logo with View instead of SVG image prop
- fix(room): use html2canvas directly on web for QR share
- fix(room): use captureRef directly for all platforms
- fix(room): add web support for QR share card capture
- fix(room): capture full share card with react-native-view-shot
- feat(room): enhance QR code with brand colors, logo, and hint text
- chore: remove wechat miniprogram files
- Revert "fix(miniprogram): update WeChat app ID and enhance project configuration"
- fix(miniprogram): update WeChat app ID and enhance project configuration
- chore(config): ignore miniprogram/ in eslint
- fix(web): remove wechat browser overlay entirely
- feat(vscode): add settings for miniprogram path configuration
- fix(web): skip wechat overlay inside miniprogram web-view
- feat(miniprogram): add wechat mini program web-view shell
- feat(room): add QR code sharing modal
- style(theme): replace hardcoded values with design tokens and Ionicons
- fix(hooks): guard useSyncExternalStore with useIsFocused to prevent listener leak
- style(AlertModal): update styles for improved UI consistency and readability
- feat: enhance game state management and audio handling; add groq-proxy function
- feat(services): migrate AI chat from Groq to Gemini 3.1 Flash Lite
- refactor(room): consolidate ContinueGameOverlay into AlertModal
- fix(hooks): suppress auto-trigger intent while ContinueGameOverlay is visible
- refactor(hooks): remove dead fallbacks and make UI text schema-driven
- refactor(hooks): streamline action submission and enhance reveal data handling
- refactor(hooks): harden actionIntent helpers & unify submission paths
- fix(hooks): use useSyncExternalStore for facade subscription
- docs(config): add reusable code review prompt templates
- Merge pull request #6 from olveryu/feature/optimize_1
- refactor(hooks): extract actionIntentHelpers from useActionOrchestrator
- refactor(hooks): extract buildBottomAction from useRoomActions
- refactor(config): extract useConfigScreenState and configHelpers from ConfigScreen
- refactor(hooks): extract useWolfVoteCountdown and useSpeakingOrder from useRoomScreenState
- refactor(game-engine): extract player iteration helpers to reduce Object.entries boilerplate
- test(game-engine): add resolver coverage contract test and wolfQueen resolver test
- refactor(theme): extract upward shadow token from hardcoded rgba
- fix(services): defensive hardening (content-type guard, boolean validation, naming)
- refactor(hooks): replace useEffect with useFocusEffect and remove listener tracking
- fix(game-engine): type-safety & DRY improvements
- docs: add code review change plan (18 findings, 11 commits)
- chore: remove unused 'concurrently' dependency from package.json and pnpm-lock.yaml refactor(types): change SeerCheckResult to a local type in types.ts refactor(index): remove unused type exports in store/index.ts
- refactor(facade): remove redundant external listener cleanup on room join
- feat(facade): implement external listener management to prevent memory leaks on leaveRoom
- feat(hooks): add diagnostic logging for subscription and cleanup in useGameRoom
- fix(hooks): update connection status handling to use setConnectionStatus
- refactor(facade): optimize connection state handling and remove diagnostic logs
- feat(facade): enhance listener management with diagnostic logging on add/remove
- fix(services): universal reconnect fetch + DRY ack retry + hasBeenLive reset
- feat(facade): implement online event listener to fetch state from DB on reconnection
- feat(facade): add periodic poll fallback for audio acknowledgment retries
- feat(facade): implement check+listen retry mechanism for audio acknowledgment
- docs(services): add audio-ack retry and reconnect recovery architecture
- test(e2e): update reconnect tests to reflect 5-10 seconds disconnect duration feat(facade): implement online event retry for audio acknowledgment on network recovery test(facade): add tests for online event retry behavior in GameFacade
- refactor(hooks): unify business errors to toast, reserve alert for infra errors
- refactor(hooks): replace ErrorStrategy enum with callback in handleMutationResult
- fix(night): unify mutation error handling with handleMutationResult
- feat(services): dead channel recovery for Supabase Realtime
- refactor(night): merge submitWolfVote into submitAction unified pipeline
- ci: allow workflow_dispatch to run full pipeline
- fix(security): prevent stack trace exposure in Edge Function responses
- fix(game-engine): add esbuild as explicit devDependency
- chore: remove dead code detected by knip
- fix(e2e): update reconnect specs to match simplified ConnectionStatusBar
- refactor(ui): simplify ConnectionStatusBar to disconnected-only banner
- refactor(services): simplify to 2-layer reconnection (SDK + foreground fetch)
- refactor(services): simplify reconnection to 4 layers (remove L2+L3)
- fix(services): replace force reconnect with foreground DB fetch

## [1.4.0] - 2026-03-01

- fix(services): force reconnect on foreground to eliminate stale WebSocket delay
- chore: add health sub-route, update docs
- chore: remove Vercel API handlers
- fix(game-engine): replace postgres.js with supabase-js to eliminate connection pool exhaustion
- fix(e2e): enhance diagnostics to log response bodies for API and function errors
- fix(e2e): serialize ci workers to stay under supabase realtime free-tier limits
- Revert "fix(e2e): reduce idle stale threshold and ci concurrency for reliable postgres_changes"
- fix(e2e): reduce idle stale threshold and ci concurrency for reliable postgres_changes
- refactor(services): extract callApiWithRetry to apiUtils (DRY)
- fix(ci): improve Edge Function error handling and e2e reliability
- fix(ci): e2e depends on deploy-edge-functions to avoid race
- perf(auth): use getSession instead of getUser for profile metadata
- ci: trigger edge function deploy
- refactor(scripts): one-command dev with auto supabase start
- ci: remove Vercel references from workflows
- refactor(scripts): migrate dev scripts from Vercel to Supabase Edge Functions
- fix(lint): add --no-warn-ignored to lint-staged eslint command
- feat(edge): migrate API from Vercel Serverless to Supabase Edge Functions
- feat(client): switch API paths to Edge Functions
- ci(edge): add Edge Function deploy job
- feat(edge): add game Edge Function with all handlers
- feat(game-engine): add ESM build for Edge Functions
- feat(migration): implement migration to Supabase Edge Functions with ESM build and handlers
- feat(docs): add migration plan for Vercel Serverless to Supabase Edge Functions
- feat(config): auto-select slot when user picks a variant
- fix(template): replace 'hunter' with 'knight' in preset templates
- fix: suppress Sentry noise for expected network/upstream errors
- refactor(room): use SDK worker + isConnected() for background reconnect
- fix(room): extend speaking order display to 60 seconds
- fix(room): rejoin realtime channel after mobile browser background
- fix(room): suppress Sentry noise for channel-closed retry race

## [1.3.0] - 2026-02-27

- fix(room): speaking order not visible to host after restart
- docs: update README and alignment matrix for 32 roles and current schemas
- feat(assets): add 14 new dark fantasy avatar portraits (043-056)
- feat(models): add alignment reveal effects for all 4 factions
- refactor(game-engine): remove unused exports and fix JSDoc labels
- fix(screens): fix Sentry double-reporting, empty catch, and missing error handling
- fix(auth): DRY AuthContext catch blocks and fix signOut missing isExpectedAuthError
- refactor(utils): extract shared error helpers and storage key constant
- fix(config): preset templates now correctly apply variant roles
- test(e2e): add piper night role E2E tests
- feat(night): add 3 preset templates with board UI tests
- docs(models): update new-role SOP to reflect current codebase
- refactor(models): shorten all bottomActionText to 4 characters
- feat(night): add piper role (hypnotize + groupConfirm reveal)
- feat(game-state): enhance getLastNightInfo to include silenced and votebanned seat info
- refactor(audio): decompose AudioService into Strategy + BgmPlayer + registry
- feat(night): add silenceElder & votebanElder roles
- fix(game-engine): improve wolf immune rejection message
- refactor: update rejection reason for self-targeting in wolf kill resolver
- refactor(tests): update rejection alert message in night roles protection test
- fix(e2e): rename Host-data → server-data in test harness
- refactor: fix last 11 inaccurate Host comments in facade/hooks/services
- refactor: replace inaccurate Host wording with server across codebase
- refactor(tests): replace inaccurate Host wording with server in comments
- refactor(models): rename remaining inaccurate Host naming in tests
- refactor: fix stale Host naming in comments/mocks
- refactor: rename inaccurate Host naming across codebase
- refactor(types): add StartRequestBody type to action API
- refactor(game-engine): remove isHost from HandlerContext
- refactor(services): remove redundant hostUid from client-server API protocol
- refactor: remove unused isHost parameter from actioner state functions and tests
- refactor: unify host connection retrieval in game actions
- refactor: improve connection extraction functions with clearer documentation
- refactor: eliminate DRY violations across resolvers, handlers, API, and services
- fix(docs): add DRY principle to copilot instructions
- Merge pull request #5 from olveryu/dependabot/npm_and_yarn/npm_and_yarn-c7796958eb
- fix(tests): align hostGameFactory with production gameStateManager pipeline
- fix(tests): apply ACTION_REJECTED actions in hostGameFactory executeHandler
- fix(screens): replace magic values with design tokens and cleanup
- fix(config): validate and clamp persisted settings on load
- fix(game-engine): resolver, reducer, schema, and handler corrections
- fix(services): audio lifecycle, promise handling, and channel cleanup
- fix(api): apply ACTION_REJECTED actions and add no-op write guard
- chore(deps): bump minimatch in the npm_and_yarn group across 1 directory

## [1.2.0] - 2026-02-25

- fix(services): mark connection Live after createRoom channel subscribe
- fix(home): disable menu buttons while auth initializing
- fix(config,home): template chip orphan row stretch + auth race guard
- refactor(game-engine): unify DeathCalculator to flag-driven reflectsDamageSeats
- refactor(roles): remove unnecessary flags from spiritKnight and update ROLE_SPECS
- refactor(models): move role emoji from ROLE_ICONS into RoleSpec.emoji
- feat(models): add dancer and masquerade roles with masquerade template
- refactor(game-engine): extract immuneToPoison flag from RoleSeatMap
- refactor(models): convert Team, TargetConstraint, ConnectionStatus to enums
- docs(config): add no-hardcode and no-fabrication rules to first principles
- fix(models): patch remaining hardcoded enum strings and stale JSDoc
- refactor(models): enum values to PascalCase, eliminate hardcoded strings
- refactor: migrate all private class members to ES # private fields
- refactor: enforce @typescript-eslint/naming-convention
- refactor(index): streamline exports and remove unused logger
- refactor(ConfigScreen): update animation option labels to remove emojis
- test: add unit tests to meet coverage thresholds
- perf(room): add wdyr, test:coverage, and 3 memo render tests
- chore: remove dead code detected by knip
- refactor(logger): rename realtimeLog extension from Broadcast to Realtime
- refactor(protocol): rename BroadcastGameState -> GameState, BroadcastPlayer -> Player
- refactor(services): rename BroadcastService to RealtimeService

## [1.1.1] - 2026-02-23

- refactor(config): replace FlipReveal+Pinball with RoleHunt, clean up animation options
- fix(services): update facade test mocks for non-JSON response guard
- fix(game-engine): unify magician swap identity resolution in death calc
- docs: add 13 instruction rules from bug scan findings
- fix(hooks): remove unused isHost from useConnectionSync
- fix(audio): track and release stale native AudioPlayer instances
- fix(components): clamp bubble position to screen bounds on load
- fix(services): add error handling for broadcast channels
- fix(game-engine): update ROLE_SPECS comment to 27 roles
- fix(contexts): export useNetworkContext consumer hook
- fix(services): guard non-JSON HTTP errors before res.json()
- fix(night): guard duplicate audio-ack progression
- fix(services): skip Sentry for expected HTTP errors in AIChatService
- fix(screens): prevent speaking order timer from resetting on every broadcast
- fix(screens): reset isStartingGame on startGame failure
- fix(services): resolve web audio promise on stopCurrentPlayer
- fix(services): reset audio flags and stop audio on room transitions
- fix(game-engine): add sideEffects to wolfRobotHunterGateHandler
- fix(game-engine): align allViewed check in handleMarkAllBotsViewed
- fix(game-engine): reset stale fields in RESTART_GAME reducer + add state null check
- docs(audio): clarify BGM stop responsibilities between Facade and useBgmControl
- fix(audio): stop BGM before playing night_end audio
- fix(room): filter host from share count and prevent double-tap on confirm
- fix(e2e): update viewLastNightInfo button text to match client code
- fix(alert): reorder buttons in AlertModal to match iOS convention
- feat: add share review functionality for hosts in ended game phase
- feat(room): restrict night info buttons visibility
- style(room): rename restart button from 重开 to 重新开始
- fix(night): correct role displayNames in NightReview and add contract test
- fix(night): add missing night action lines to NightReview detail modal
- style(room): unify bottom panel button sizing and refactor HostControlButtons
- style(room): use danger style and anti-cheat warning for last-night-info button
- feat(room): add clear-all-seats host menu action
- feat(night): theme FlipReveal particles and glow by alignment color
- fix(audio): delay BGM stop until ending audio finishes after night ends
- refactor(room): move speaking order from toast to BoardInfoCard with 20s auto-hide
- fix(services): replay audio effects on host reconnect instead of bare ack retry
- fix(services): retry postAudioAck after host reconnect during night
- fix(e2e): handle connecting state in waitForJoinerLive and fix trace cleanup
- fix(room): show connection bar for host and defer toast until audio ends
- fix(room): prevent night review button from displaying while audio is playing
- fix(services): detect network loss instantly via browser offline event
- fix(room): unify button styles via parent props and shorten toast text
- test(e2e): add reconnect spec for non-host player disconnect during night
- fix(game-engine): allow starting game with no night-action roles
- fix(room): reorder buttons and show speaking order as toast
- fix(room): reorder ended buttons — details right of restart
- fix(room): remove button marginBottom overlap and shorten labels
- feat(notepad): split public note into two columns and reduce bottom panel padding
- feat(settings): add WeChat contact info to About section

## [1.1.0] - 2026-02-21

- ci(release): only create GitHub Releases for minor/major versions
- test(e2e): add entry-flow spec and adjust CI sharding
- feat(roles): add missing emoji icons and assistant questions with contract tests
- feat(theme): add ThemedToast with theme-aware colors
- feat(room): show one-time assistant hint toast on first room entry
- fix(services): clear old seat in optimistic takeSeat update
- feat(auth): show toast with settings link after email signup
- feat(auth): add caption text inside login option buttons
- fix(services): delete old avatars on upload
- fix(settings): change default theme from dark to light
- feat(auth): implement auth gate for first-time users and add AuthGateOverlay component
- feat(auth): implement expected auth error handling and retry logic
- refactor(RoomScreen): remove last night info functionality and related dialogs

## [1.0.274] - 2026-02-21

- fix(services): detect WebSocket reconnection and recover night action state
- feat(night-review): implement Night Review modal and related functionality

## [1.0.273] - 2026-02-20

- fix(config): set userInterfaceStyle to light for consistent default theme

## [1.0.272] - 2026-02-20

- fix(room): use maybeSingle() for room lookup to avoid false Sentry errors
- Merge pull request #4 from olveryu/dependabot/npm_and_yarn/npm_and_yarn-f1bf2b0a19
- chore(deps): bump ajv in the npm_and_yarn group across 1 directory

## [1.0.271] - 2026-02-20

- fix(e2e): replace waitForURL with web-first toHaveURL assertions

## [1.0.270] - 2026-02-20

- fix(game-engine): add notSelf constraint to all check schemas
- fix(game-engine): use darkWolfKing instead of wolfKing in 灯影预言12人 template

## [1.0.269] - 2026-02-20

- fix(theme): add border to public note input for visibility

## [1.0.268] - 2026-02-20

- fix(screens): simplify public note label and remove placeholder

## [1.0.267] - 2026-02-20

- fix(e2e): use URL-based assertions for room-lifecycle redirect checks

## [1.0.266] - 2026-02-20

- fix(e2e): use .last() for home-screen-root in room-lifecycle tests
- feat(screens): add public note area to notepad modal

## [1.0.265] - 2026-02-20

- fix(e2e): use testID for home screen redirect assertions
- refactor(config): extract Supabase client creation from config/
- refactor(e2e): replace safe waitForTimeout with event-driven waits
- refactor(api): extract shared handlerContext helpers to \_lib/
- fix(api): add runtime input validation and strip error in production
- refactor(screens): move ActionIntent types to policy/types
- fix(services): handle sendMessage errors instead of silent swallow
- fix(components): use typography token for AlertModal fontWeight
- fix(screens): replace index keys with stable keys
- fix(screens): add exhaustive switch default cases
- fix(screens): use specific showAlert titles instead of generic '提示'
- fix(services): complete error-handling 3-layer pattern

## [1.0.264] - 2026-02-20

- fix(game-engine): export missing symbols from barrel
- chore: bump version to 1.0.263 in app.json and package.json

## [1.0.262] - 2026-02-20

- fix(game-engine): replace Math.random with secureRng, use theme tokens and type guards
- feat(config): add 13 new avatar portraits (030-042)
- feat(game-engine): add wildChild role as slacker variant
- feat(config): implement role info sheet for displaying role skills on chip long-press
- feat(game-engine): update buildNightPlan to accept seerLabelMap for dynamic role ordering
- feat(config): variant system, drunkSeer client UI, audio consolidation
- feat(game-engine): add drunkSeer (酒鬼预言家) role with random 50/50 check
- feat(role): add seerLabel prop for dual-seer boards and update role name display

## [1.0.261] - 2026-02-20

- docs(readme): update role count to 25 and board count to 12

## [1.0.260] - 2026-02-20

- fix(audio): lower BGM volume from 8% to 3%

## [1.0.259] - 2026-02-20

- refactor(config): replace header buttons with overflow menu, swap BGM
- refactor(config): shorten board names, chip layout, header redesign
- feat(ConfigScreen): enhance header layout and add settings chip selection
- feat(models): add mirrorSeer (灯影预言家) role

## [1.0.258] - 2026-02-20

- fix(night): guard postProgression countdown against non-ongoing status
- fix(e2e): narrow wolfWitch waitForRoleTurn keywords to avoid stale match
- fix(models): add pureWhiteReveal and wolfWitchReveal to DialogType union
- fix(hooks): show server reason in notifyIfFailed alert
- feat(models): add pureWhite and wolfWitch roles with 纯白夜影12人 board
- docs: add SOP for adding new roles in the game

## [1.0.257] - 2026-02-19

- docs: add 4-faction color token rules to screens instructions

## [1.0.256] - 2026-02-19

- fix(room): add faction colors to BoardInfoCard role chips

## [1.0.255] - 2026-02-19

- fix(config): use section-level faction color for role chips

## [1.0.254] - 2026-02-19

- refactor(theme): unify role reveal colors with theme tokens

## [1.0.253] - 2026-02-19

- refactor(theme): unify faction colors to 4-faction system (wolf/god/villager/third)

## [1.0.252] - 2026-02-19

- feat(notepad): add team-colored text to role picker options

## [1.0.251] - 2026-02-19

- feat(notepad): add team-colored text to role badge

## [1.0.250] - 2026-02-19

- refactor(theme): add spacing.micro token, fix hardcoded values

## [1.0.249] - 2026-02-19

- fix(notepad): fix role badge alignment with fixed width container

## [1.0.248] - 2026-02-19

- fix(notepad): fix role badge / placeholder width asymmetry

## [1.0.247] - 2026-02-19

- feat(notepad): remove identity button, replace chevron with emoji placeholder

## [1.0.246] - 2026-02-19

- feat(components): replace role tag row with popover role picker

## [1.0.245] - 2026-02-19

- fix(components): enlarge notepad touch targets + hide notepad outside room

## [1.0.244] - 2026-02-19

- feat(game-engine): schema-driven notepad role tags + auto-grow TextInput

## [1.0.243] - 2026-02-19

- style(services): compact notepad card layout for one-screen fit

## [1.0.242] - 2026-02-19

- feat(services): redesign notepad to 2x6 grid with role tags and identity cards

## [1.0.241] - 2026-02-18

- fix(services): use body fontSize in notepad input to prevent iOS auto-zoom

## [1.0.240] - 2026-02-18

- feat(services): add in-game notepad with persistence and full-screen modal
- feat(room): replace speak order dialog with inline text for all players

## [1.0.239] - 2026-02-18

- fix(tarot): prevent drawn card overlay from blocking wheel card taps
- docs: replace emoji JSDoc markers with natural language across codebase
- docs: replace emoji markers with natural language in copilot instructions
- docs: simplify JSDoc convention to community standard style
- docs: add bidirectional tracing rule for parameter/guard changes

## [1.0.238] - 2026-02-18

- fix(game-engine): allow non-host players to view their own role
- chore: add pnpm-lock.yaml to prettierignore
- chore: format pnpm-lock.yaml
- fix: resolve CodeQL alerts for clear-text logging and workflow permissions
- docs: streamline README and move test gates to CONTRIBUTING
- Merge pull request #2 from olveryu/dependabot/npm_and_yarn/npm_and_yarn-01f5ad5e18
- chore(deps): bump tar in the npm_and_yarn group across 1 directory

## [1.0.237] - 2026-02-18

- refactor(client): remove dead exports and unused Button component
- refactor(services): delete dead code in services and api layers
- refactor(game-engine): remove dead exports from barrel and source files
- refactor(game-engine): remove evaluateNightProgression and dead dependencies
- refactor(game-engine): remove dead client-side progression controller
- refactor(services): remove unused role param from submitRevealAck
- refactor(game-engine): remove dead code and improve type assertions
- chore: low-severity cleanup — conventions, imports, trivial useMemo, security headers
- fix(services): medium-severity issues — testability, race condition, resource leaks
- fix(game-engine): high-severity bugs — isHost bypass, memory leak, impure reducer, dead state

## [1.0.236] - 2026-02-17

- fix(game-engine): use RANDOMIZABLE_ANIMATIONS constant in gameReducer test

## [1.0.235] - 2026-02-17

- feat(night): add cardPick animation with real-time card removal

## [1.0.234] - 2026-02-17

- fix(hooks): remove dismiss mechanism from PWA install hook

## [1.0.233] - 2026-02-17

- fix(config): add DIAG logs to PWA install hook and apple-mobile-web-app-capable meta
- feat(config): update card dimensions for improved layout
- chore(docs): update various documentation files for clarity and accuracy

## [1.0.232] - 2026-02-16

- feat(room): fire-and-forget seat confirm for instant modal dismiss
- chore(e2e): add playwright report link to ci summary
- chore(e2e): deploy playwright report to github pages

## [1.0.231] - 2026-02-16

- fix(room): fix role card description overflow and button clipping

## [1.0.230] - 2026-02-16

- feat(ui): pulse animation, expanded quick questions, BoardInfoCard fix
- style(config): enforce no-inline-styles as error and fix all violations
- chore(e2e): shard E2E tests into 3 parallel jobs with merged reports

## [1.0.229] - 2026-02-16

- refactor(config): extract shared devConfig module and add dev:full script
- feat: enhance role management with structured role items and skill preview functionality

## [1.0.228] - 2026-02-16

- fix(quality): extract inline styles, remove unused var, enforce max-warnings=0

## [1.0.227] - 2026-02-16

- chore: fix low-severity community convention issues
- refactor: fix medium-severity community convention issues
- docs(e2e): update workers rule to reflect independent room isolation
- docs: add guidelines for optimistic updates in service layer instructions

## [1.0.226] - 2026-02-16

- perf(infra): colocate region, merge routes, optimistic updates
- fix(e2e): add html reporter to CI so playwright-report/ is generated
- fix(e2e): remove unused wolfIdx variable
- fix(e2e): fix night-roles E2E test assertions and timing
- fix(e2e): pass server-side env vars explicitly to vercel dev child process
- refactor(e2e): split night-roles into 4 effect-domain files
- fix(config): use single-quoted perl regex for font path replacement
- fix(config): set Sentry environment from VERCEL_ENV
- refactor(e2e): remove redundant childEnv server-side vars
- fix(e2e): write all server env vars to .env.local for vercel dev
- fix(e2e): forward DATABASE_URL to vercel dev serverless functions
- fix(ci): add DATABASE_URL secret to e2e job env
- fix(ci): stop ignoring web/ needed by build.sh for PWA files
- fix(ci): use scripts/\* instead of scripts/ to allow negation for build.sh
- fix(ci): add VERCEL_ORG_ID and VERCEL_PROJECT_ID to e2e job
- fix(ci): keep build.sh in vercel deploy and pass token to vercel dev
- fix: resolve 10 bug findings from repo audit
- chore(prompts): remove add-role prompt markdown file
- chore(ci): add workflow_dispatch trigger for manual runs
- test(api): add handler unit tests for all 11 API routes (85 tests)
- fix(e2e): pass VERCEL_TOKEN to CI for vercel dev auth
- docs: update README for post-migration server-authority architecture
- chore(config): add test:all script for monorepo-wide testing
- fix(e2e): install vercel CLI in CI for E2E web server
- docs(config): add release & deploy workflow to copilot instructions
- docs(config): add unused variable cleanup rules to typescript instructions
- fix(config): resolve ci lint warnings and e2e env config
- chore(config): extract build.sh for vercel git integration auto-deploy
- fix(config): widen eslint ignore glob for nested config files

## [1.0.225] - 2026-02-16

- docs: update collaboration rules to prioritize community practices
- refactor(game-engine): normalize actions/pendingRevealAcks at boundary — make required
- fix(services): apply fail-fast policy — remove defensive fallbacks
- fix: ensure viewedRole is called only when animation is needed
- docs: consolidate instruction files from 14 to 7
- fix(tests): update logging rules to prohibit console.\* in Jest and E2E specs
- refactor(e2e): remove all console.log from specs, helpers, and pages
- fix(playwright): update trace collection to 'retain-on-failure' for better debugging
- refactor(diagnostics): remove quietConsole option and adjust logging behavior refactor(multi-player): eliminate quietConsole option from game setup functions test(e2e): remove quietConsole flag from night role tests for consistency
- perf(services): replace Supabase REST with direct Postgres via Supavisor
- fix(game-engine): pre-compile workspace package for Vercel serverless
- fix(services): deploy from project root with consolidated night API routes
- fix(e2e): increase viewRole retry budget and fix stale screen selector
- feat(e2e): add night-roles tests and fix night-driver infrastructure
- feat(game): add role-aware game setup and night verification tests
- refactor(package): update test and quality scripts for improved execution
- refactor(utils): consolidate id/random/shuffle into game-engine, remove expo-crypto
- test(game-engine): co-locate 48 test files with source in game-engine package
- refactor(services): remove duplicate resolver files and empty protocol dir
- refactor(models): remove models/protocol/resolver proxy re-export stubs (B2+B3)
- refactor(services): remove engine/resolver proxy re-export stubs (B1)
- refactor(models): remove zero-consumer proxy re-export stubs
- feat: refactor room management methods to unify host and player join logic
- feat: add double-click protection and new action types for game state management
- chore: remove diagnostic logs and obsolete docs
- feat: implement REST-based broadcasting for game state updates and notifications
- feat: implement action submission handling for host and seat dialogs
- feat: enhance seat interaction and game progression handling
- chore: update scripts and instructions
- fix(e2e): replace .isVisible({ timeout }) and waitForTimeout anti-patterns
- feat(services): add three-layer retry for server-authoritative actions
- docs: update instructions and migration doc for phases 5-7 completion
- refactor(services): remove redundant client-side isHost guards
- refactor(services): delete client-side progression, use audio-ack + postProgression
- refactor(server): inline progression in all night APIs
- feat(game-engine): add AudioEffect + pendingAudioEffects + runInlineProgression
- refactor(services)!: remove HostStateCache, unify rejoin to DB
- refactor(services)!: unify client state reception
- refactor(docs): update architecture to unify client roles and eliminate Host/Player code divergence
- feat(services): atomic game_state in createRoom + buildInitialGameState DRY
- chore(services): cleanup stale comments and dead code
- refactor(services): migrate remaining night ops to HTTP
- refactor(services): migrate night action + wolf-vote to HTTP
- feat(api): add night flow API routes
- refactor(services): migrate game control to HTTP
- feat(api): add game control API routes
- test(services): update seat tests for HTTP API migration
- refactor(services): migrate seat ops to HTTP API
- feat(api): add seat API route + gameStateManager
- test(services): add seatActions + messageRouter pre-migration tests
- docs: update instructions for game-engine monorepo
- refactor(services): move engine to game-engine
- refactor(services): move protocol + resolvers to game-engine
- refactor(models): move models to game-engine with proxy re-exports
- chore: scaffold @werewolf/game-engine package
- docs: update migration plan with detailed commit strategies for game engine transition
- docs: rewrite server-authoritative migration plan with full phase details
- feat(seating): update seating logic to require manual seat selection for host
- feat(audio): update audio files and enhance TTS volume control fix(audio): improve BGM handling for web and native environments
- feat(ui): update prompts to include '不使用技能' option for player actions

## [1.0.222] - 2026-02-13

- test(e2e): add DB state recovery after network interruption

## [1.0.221] - 2026-02-13

- test(services): add RoomService unit tests (30 cases)

## [1.0.220] - 2026-02-13

- fix(room): prevent infinite alert loop when joining non-existent room
- feat(services): add DB-backed state persistence for reliable Player sync
- feat(state-sync): implement DB-backed state persistence for reliable synchronization

## [1.0.219] - 2026-02-13

- feat(services): add DB-backed state persistence for reliable Player sync
- feat(state-sync): implement DB-backed state persistence for reliable synchronization

## [1.0.218] - 2026-02-13

- fix(reliability): add broadcast ack + faster player auto-heal
- feat(heartbeat): implement host heartbeat mechanism for state resynchronization

## [1.0.217] - 2026-02-13

- fix(audio): normalize BGM to prevent clipping on mobile speakers

## [1.0.216] - 2026-02-13

- fix(audio): boost TTS volume +50% for clearer role narration

## [1.0.215] - 2026-02-13

- fix(audio): lower BGM volume from 0.15 to 0.08
- fix(hooks): add auto-heal for missed broadcast messages
- test(utils): add tests for shuffle, logger, mobileDebug
- chore: remove scope-enum from commitlint
- docs(readme): fix role faction classification

## [1.0.214] - 2026-02-13

- docs: add community standard files

## [1.0.213] - 2026-02-13

- docs: generate complete CHANGELOG for all 209 versions
- fix(e2e): use existing SUPABASE_URL/ANON_KEY secrets in CI
- fix(e2e): gate CI e2e job behind E2E_ENABLED variable

## [1.0.212] - 2026-02-13

- chore: auto-update CHANGELOG on release + GitHub Release workflow

## [1.0.211] - 2026-02-13

- chore: add community-standard project configs

## [1.0.210] - 2026-02-13

- fix(components): add borderRadius prop to Avatar for proper photo clipping
- fix(auth): streamline button accessibility and loading states in EmailForm and LoginOptions
- refactor: overhaul authentication components and styles
- feat(theme): add spacer elements to ThemeSelector for better layout
- style(screens): move InstallMenuItem from menu to footer link
- fix(web): PWA install button visible on iOS Chrome + close guide without permanent dismiss

## [1.0.209] - 2026-02-13

- feat(web): add PWA install-to-homescreen menu item
- chore(web): remove wechat-specific compat code

## [1.0.208] - 2026-02-13

- feat(web): add wechat webview detection and browser redirect guide

## [1.0.207] - 2026-02-13

- docs: comprehensive content accuracy update across all docs and READMEs

## [1.0.206] - 2026-02-13

- docs: update test counts to 166 suites / 2643 tests

## [1.0.205] - 2026-02-13

- docs: add three-layer error handling and friendly message rules to instructions
- fix: add Sentry.captureException to all critical catch blocks
- fix: use friendly chinese error messages for all user-facing errors
- refactor(tests): remove unused waitForNightActive helper function
- fix(services): add missing error logging + user-friendly auth error messages

## [1.0.204] - 2026-02-13

- feat(room): show BoardInfoCard in all phases, collapsed during ongoing/ended

## [1.0.203] - 2026-02-13

- fix: repo-wide bug fixes from audit

## [1.0.202] - 2026-02-13

- fix(room): prefer share sheet on mobile, clipboard on desktop

## [1.0.200] - 2026-02-13

- fix(room): prefer clipboard over navigator.share on web

## [1.0.198] - 2026-02-13

- fix(room): discriminate share result type and add readLastRoom catch
- fix(HomeScreen): improve last room number loading on focus

## [1.0.197] - 2026-02-13

- feat(navigation): add URL linking for page restore on refresh

## [1.0.196] - 2026-02-13

- fix(services): reset abort flag on rejoin and handle audio errors gracefully

## [1.0.195] - 2026-02-13

- feat(services): host rejoin recovery with audio resume and wolf timer rebuild

## [1.0.194] - 2026-02-13

- style(web): fix prettier formatting

## [1.0.193] - 2026-02-13

- fix(web): improve mobile viewport height for WeChat and other browsers

## [1.0.192] - 2026-02-12

- fix(chat): refresh quick questions after AI reply and auto-scroll on send
- fix(e2e): replace flaky collectSeatState reads with polling after seatAt

## [1.0.191] - 2026-02-12

- refactor: enforce single source of truth for medium-risk patterns
- refactor(services): enforce single source of truth for high-risk patterns
- refactor: enhance compile-time exhaustiveness guard in normalizeState function
- refactor: update voter role handling in handleSubmitWolfVote for clarity and accuracy
- refactor: replace seatIndex with seat in interaction policies and related functions
- refactor: rename targetIndex to targetSeat in action intents and related functions
- refactor(resolvers): introduce witchState context and streamline gameState handling
- refactor(facade): enforce required dependencies in GameFacade constructor
- refactor(services): remove all getInstance() singleton remnants
- refactor(hooks): split useGameRoom god hook into sub-hooks
- refactor(services): unify DI — eliminate getInstance() singletons
- chore: migrate from npm to pnpm
- fix(ci): remove packageManager and corepack — npm does not need them
- docs: add CI badge, remove stale version badge
- fix(ci): enable corepack before npm ci for packageManager compatibility

## [1.0.190] - 2026-02-12

- chore: pre-push hook run tsc only, full validation via CI

## [1.0.189] - 2026-02-12

- fix(test): remove unnecessary act() wrappers around fireEvent calls
- chore: add GitHub Actions CI, remove redundant format check from quality

## [1.0.188] - 2026-02-12

- chore: add pre-push hook to run full quality before push
- docs: clarify verification pipeline vs lint-staged
- chore: add husky + lint-staged, packageManager, engines >=22

## [1.0.187] - 2026-02-12

- chore: make quality script auto-fix before checking

## [1.0.186] - 2026-02-12

- style: format all files with prettier, update verification pipeline docs

## [1.0.185] - 2026-02-12

- Version bump

## [1.0.184] - 2026-02-12

- chore(lint): fix all 134 ESLint errors, add verification pipeline rule

## [1.0.183] - 2026-02-12

- fix(hooks): stabilize useCallback deps — read guards from facade, not state

## [1.0.182] - 2026-02-12

- chore(diag): add subscribe timing diagnostics to BroadcastService

## [1.0.181] - 2026-02-12

- Version bump

## [1.0.180] - 2026-02-12

- fix(logging): add error context to initializeHostRoom failure logs

## [1.0.179] - 2026-02-12

- fix(web): useNativeDriver=false on web, migrate channel.send to httpSend

## [1.0.178] - 2026-02-12

- fix(web): replace deprecated apple-mobile-web-app-capable meta tag

## [1.0.177] - 2026-02-12

- docs: add Edge Function section to supabase/README
- fix: restore react-native-web as dependency (required for Expo web builds)

## [1.0.176] - 2026-02-12

- feat: community best practices - sentry, expo-image, splash-screen, edge function proxy

## [1.0.175] - 2026-02-12

- chore: community-standard config audit fixes

## [1.0.174] - 2026-02-12

- refactor(deploy): community-standard env + split release/deploy
- feat: add deploy script and release management; update package.json

## [1.0.172] - 2026-02-12

- refactor: unified styles across screens for consistency

## [1.0.171] - 2026-02-12

- feat: add mobile debug and logger utilities

## [1.0.170] - 2026-02-12

- feat: implement room screen hooks and dialogs
- chore: update expo version and jest-expo dependency; add ErrorBoundary component for global error handling

## [1.0.169] - 2026-02-11

- feat: add RoleRevealAnimation types and gameReducer updates

## [1.0.168] - 2026-02-11

- feat: add responsive styles to ConfigScreen components

## [1.0.167] - 2026-02-11

- feat: Implement role reveal effects and chat message improvements

## [1.0.166] - 2026-02-11

- feat: add config screen styles and tests

## [1.0.165] - 2026-02-11

- feat: added role reveal effects components

## [1.0.164] - 2026-02-11

- feat: Implement role reveal effects components

## [1.0.163] - 2026-02-11

- feat: added role reveal effects components

## [1.0.162] - 2026-02-11

- feat: Implement new role reveal effects components
- feat: add cabinet fade-out and revealed card cross-fade animations in EnhancedRoulette

## [1.0.161] - 2026-02-11

- feat: implement role reveal effects components
- feat: migrate TarotDraw and GlowBorder components to Reanimated 4

## [1.0.160] - 2026-02-11

- feat: added role reveal effects components and tests
- feat: Update package dependencies and improve Jest configuration for better compatibility

## [1.0.159] - 2026-02-11

- feat: Implement AI chat message filtering logic

## [1.0.158] - 2026-02-11

- feat: Implement AI chat message loading and caching logic

## [1.0.157] - 2026-02-11

- feat: implement AI chat feature with new components and services
- feat: Refactor AIChatService and enhance chat bubble components

## [1.0.156] - 2026-02-11

- feat: improve room state handling and cancel path tests
- refactor: remove custom memo comparators from components to enforce default shallow comparison
- feat: add SettingsSheet and TemplatePicker components for enhanced configuration options in ConfigScreen
- Refactor RoomScreen by creating useRoomScreenState hook to manage state and side effects, improving modularity and readability. Update delegationSeatIdentity tests to reflect changes in file structure.

## [1.0.155] - 2026-02-10

- Add comprehensive UI tests for various game scenarios

## [1.0.154] - 2026-02-10

- feat: add restart game button for host with danger style

## [1.0.153] - 2026-02-10

- refactor: update interface definitions and enforce non-null assertions for UI properties

## [1.0.152] - 2026-02-10

- refactor: update action dialogs to enforce schema-driven behavior and improve message handling
- feat: add schema-driven prompts and dialogs for witch and wolf actions
- fix(e2e): prevent wolf vote re-confirm loop in NightFlowPage
- Refactor and clean up codebase
- chore: remove redundant eslint-disable comments for require imports
- chore: remove redundant react-in-jsx-scope rule (jsx-runtime preset covers it)
- chore: migrate ESLint 8 → 9 with flat config
- fix(lint): resolve 2 eslint errors from new plugins
- Refactor imports across multiple files for consistency and clarity
- chore: enforce import order with eslint-plugin-simple-import-sort
- chore: add eslint-plugin-react-native
- fix: stabilize GameFacade instance with useState lazy init

## [1.0.151] - 2026-02-10

- refactor: remove dead barrel re-exports
- refactor: un-export module-internal symbols
- refactor: remove dead code definitions (zero production consumers)

## [1.0.150] - 2026-02-09

- refactor(dialogs): remove dead witch/blocked dialog functions
- test(boards): 100% UI dialog coverage for all 10 boards + fix reveal title prefix
- test(boards): add comprehensive dialog coverage plan and identify dead functions
- refactor(hooks): inline createRoomRecord into ConfigScreen
- test(boards): update createGameRoomMock to include missing keys and improve return value structure
- test(boards): add mock shape contract and vertical slice integration UI test
- test(boards): add non-actioner UI test, intermediate state assertions, normalizeState round-trip
- test(boards): add progression integration test and kill OR assertions

## [1.0.149] - 2026-02-09

- refactor: internalize test-only exports, test through public APIs
- refactor: remove unnecessary export keywords from internal-only types
- refactor: delete dead code across models, theme, services, e2e, and components

## [1.0.148] - 2026-02-09

- refactor: update night flow UI texts and remove unused wolfRobot type guards and assertions
- refactor: remove unused game control and role action functions, update tests to use schema-driven text
- refactor: update hunter gate UI texts and improve test utility functions
- refactor: remove unused createRoom mocks from test files
- refactor: update test overrides to use gameStateOverrides for confirmStatus
- feat: add confirm status calculation for hunter and darkWolfKing roles

## [1.0.147] - 2026-02-08

- feat: implement wolf vote revote and withdraw functionality with countdown timer
- docs: fix outdated facts in 3 doc files
- docs(deploy): align DEPLOYMENT.md with actual deploy.sh behavior
- docs: add docs/README.md index with categorized document listing
- docs: update README and offline-sop with verified codebase facts
- docs: replace instruction self-check meta-rules with JSDoc coding standard
- docs: remove migration index table from copilot-instructions
- docs(instructions): restore 8 constraints lost during slim-down
- docs(instructions): slim copilot-instructions to ~200 lines, distribute detail to path-specific files
- docs: expand copilot instructions with project overview, tech stack, key directories, and common commands
- docs: add community convention guidelines to copilot instructions
- refactor: community convention audit — 9 fixes across 30+ files
- refactor: update styles across components to use theme tokens for consistency
- fix: update overlay colors in createSeatTileStyles for better theming support
- feat: enhance buildSeatViewModels to display wolf vote progress and update ready badge logic
- refactor: rename ambiguous StateListener and unify RoleId import paths
- fix(services): remove duplicate ConnectionStatus type definition
- chore: remove 18 zero-consumer barrel files and dead GameStateListener export
- refactor: restructure imports and remove obsolete files for improved clarity
- refactor: remove Player model and related tests, update imports accordingly
- refactor: remove Room model and update imports to GameStatus
- refactor: update copilot instructions and remove obsolete Room tests
- refactor: rename currentActionerIndex to currentStepIndex across the codebase
- fix: reorder alert button labels for consistency across dialogs

## [1.0.146] - 2026-02-08

- Version bump

## [1.0.145] - 2026-02-08

- feat: implement AI chat functionality and game facade improvements

## [1.0.144] - 2026-02-08

- feat: add terminal output guidelines to ensure complete test results and proper reporting
- refactor: update fixed question text for role skills in AI chat
- feat: enhance ensureAnonLogin to handle auto-sign-in and improve modal interaction
- refactor: replace useContext with use for context consumption in Auth, GameFacade, Network, and Theme providers
- feat: refactor GameFacade to support dependency injection and update related tests
- feat: implement dependency injection in GameFacade and update related tests
- refactor: reorganize services into feature and infra layers
- Refactor type imports and restructure type definitions
- Refactor import paths to use absolute imports for better readability and maintainability across the project. Updated all relevant test files, resolver files, and utility files to reflect the new import structure. Additionally, modified tsconfig.json to set up baseUrl and paths for absolute imports.
- feat: update fixed question for role skills in AI chat
- feat: enhance AIChatBubble styles and optimize question prompts for brevity

## [1.0.143] - 2026-02-08

- feat: added support for MCP configuration in .vscode/mcp.json

## [1.0.142] - 2026-02-08

- feat: add logic for room seat dialog handling

## [1.0.141] - 2026-02-08

- feat: Add seat selection functionality to SeatTile component

## [1.0.140] - 2026-02-08

- feat: update SeatTile badge dimensions to use componentSizes for consistency
- feat: update SeatTile styles to use badge for seat number display and improve layout
- feat: add ready badge to seat tiles and remove WaitingViewRoleList component

## [1.0.139] - 2026-02-07

- feat: update cache expiration to 24 hours for alignment with room deletion policy and enhance loading messages for better user experience
- refactor: simplify leaveRoom logic by removing room deletion for hosts
- feat: add font path fix for Vercel deployment and optimize asset handling

## [1.0.138] - 2026-02-07

- refactor: remove deprecated button press methods and related tests for cleaner API

## [1.0.137] - 2026-02-07

- feat: added metro.config.js for React Native project configuration
- feat: reorder alert button definitions for consistent button placement in dialogs
- feat: implement dynamic chat height calculation and add SimpleMarkdown component for enhanced message rendering
- feat: enhance AIChat functionality by introducing new request ID generation and updating styles for improved consistency
- refactor: consolidate component exports and remove unused components to streamline imports
- feat: enhance random utilities and update usage across components to improve randomness and consistency
- feat: Update comments and documentation across various components and utilities
- docs: update comments across multiple files for improved clarity and consistency in responsibilities and constraints
- docs: add JSDoc standards for class and module documentation to improve code clarity and consistency
- docs: update guidelines across multiple instruction files for improved clarity and consistency
- docs: add standards for instruction files and checks for file modifications
- docs: update copilot instructions for clarity and sequential thinking requirement
- feat: refactor room creation logic to use createRoomRecord and initializeHostRoom for improved consistency and error handling
- chore: remove unused expo-apple-authentication and expo-auth-session dependencies
- refactor: move getNight1ActionRoles function to nightSteps module and update exports
- docs: update guidelines for single responsibility principle and code splitting criteria

## [1.0.136] - 2026-02-07

- feat: add AIChatBubble component with styles and logic for chat interactions
- Refactor useGameRoom: Extract sub-hooks for connection, BGM, night phase, and debug mode management
- Refactor GameStatus handling: Move enum to its own file and update imports
- chore: update ConfigPage and RoomPage to use consistent locator strategies and improve test reliability
- chore: add Playwright reporter requirement to testing instructions for proper output handling
- chore: update testing instructions to enforce complete terminal output and add delivery and access guidelines
- chore: clean up project structure by removing unused files and updating imports
- chore: Remove test output file to clean up project structure
- chore: Remove coverage summary file to streamline project structure
- Add integration tests for action handler, wolf vote resolution, and AI chat service; implement audio and authentication services with comprehensive unit tests
- feat: Replace mobileDebug logging with audioLog for consistency and improved logging structure
- Refactor RoomScreen components to use pre-created styles and memoization for performance improvements
- Refactor documentation for consistency and clarity across various instruction files
- feat: Add comprehensive guidelines for Git commit conventions and instruction file synchronization
- feat: Remove add-role prompt file as part of role implementation cleanup
- feat: Refactor RoomScreen by extracting hooks and components for improved modularity and maintainability
- Refactor RoomScreen: Split RoomScreen into modular hooks
- feat: Add comprehensive guidelines for UI components, models, screens, services, tests, and role prompts

## [1.0.135] - 2026-02-07

- feat: Implement BottomActionBar component with dropdowns for template, animation, and BGM selection
- feat: Replace text with Ionicons in ConfigScreen, Dropdown, RoomScreen, and SettingsScreen for improved UI consistency
- feat: Replace back button text with Ionicons in multiple screens and update related tests
- feat: Add contract tests for effectiveSeat usage in action submissions and gate handling
- Refactor RoomScreen tests to integrate coverage chain drivers for UI interactions

## [1.0.134] - 2026-02-06

- feat: Enhance E2E test stability with improved presence checks and logging; add testID support for dropdown components
- feat: Implement RoomPage and associated E2E tests for seating and game flow
- Refactor test files and components for improved readability and consistency
- Remove story files for PlayerGrid, RevealResult, RoleCard, SeatConfirmModal, WaitingViewRoleList, and WitchDialog components to streamline the codebase and eliminate unused stories.
- feat(FactionTabs): Simplify active tab styles and update tab badge text color for consistency
- feat(NumPad): Update button font weight for improved typography consistency
- feat(CopilotInstructions): Update guidelines for theme token usage and UI consistency across screens
- feat(ControlledSeatBanner): Enhance styles for improved UI consistency and add shadows
- feat(RoomScreen): Refactor styles across components to enhance UI consistency and utilize shadows
- feat(ConfigScreen): Refactor styles for header and tab bar to improve layout and consistency
- feat(ConfigScreen): Update styles for buttons and backgrounds to enhance UI consistency
- feat: Update styles across components to improve consistency and utilize fixed design tokens
- feat(ConfigScreen): Enhance UI with settings and template dropdowns, refactor styles and remove BottomActionBar
- feat(ConfigScreen): Update styles for section titles and chips to improve UI consistency
- feat(ConfigScreen): Refactor to use FactionTabs for faction selection and implement BottomActionBar for settings
- feat(ConfigScreen): Remove unused FactionStatsBar, TemplateCarousel, and TemplatePills components
- feat(ConfigScreen): Add accent color support to RoleChip and RoleStepper components
- feat: Implement unique avatar indexing and enhance avatar selection logic
- feat(ConfigScreen): Enhance role selection UI with new components and styles
- feat: Refactor action handling to use actorRole and actorSeatNumber for improved clarity and support debug bot takeover
- feat: Enhance role handling in RoomInteractionPolicy for delegating hosts
- feat: Add BottomActionPanel component for unified action message and buttons
- feat(tests): enhance RoomScreen tests with chain interaction helpers
- feat: Ensure consistent wolf participation checks in getSkipIntent and getActionIntent
- feat: Enhance idempotency key handling in auto-trigger logic to include actor seat dimension
- feat: Implement effective seat handling for action submissions and UI decisions in delegation mode

## [1.0.133] - 2026-02-06

- Version bump

## [1.0.132] - 2026-02-06

- feat: Implement room joining and leaving functionality.

## [1.0.131] - 2026-02-06

- feat: Add anti-drift contract tests for actor identity and night steps validation
- feat: Enhance game room functionality with improved role viewing logic and delegation state validation
- feat: Update actor identity handling and enforce consistency checks in delegation logic
- feat: Introduce actor identity management for UI actions
- feat: Add 'ui' field to BroadcastGameState and update normalizeState documentation
- feat: Implement UI hint system for game state to provide real-time feedback on player actions
- feat: Enhance RoomScreen with reactive game room mock and nightmare block handling
- feat: Refactor debug mode handling in useGameRoom and related tests

## [1.0.130] - 2026-02-05

- feat: Implement audio playback functionality in AudioService

## [1.0.129] - 2026-02-05

- feat: Implement audio playback functionality in AudioService

## [1.0.128] - 2026-02-05

- feat: added night bgm audio asset

## [1.0.127] - 2026-02-05

- feat: Added night-themed audio assets
- feat: Adjust BGM volume for clearer TTS narration and implement audio pause/resume on visibility change
- feat: Add mobile debug panel for enhanced logging and debugging in iOS Safari

## [1.0.126] - 2026-02-05

- Version bump

## [1.0.125] - 2026-02-05

- feat: Refactor shadow styles to use boxShadow syntax and improve audio cleanup on room leave
- feat: Update ControlledSeatBanner styles and button text for improved clarity
- feat: Enhance room leave functionality with audio cleanup and confirmation dialog
- feat: Refactor ControlledSeatBanner to unify bot mode hint and controlled seat display
- feat: Implement Host Menu Dropdown for host actions and update game room logic
- feat(debug-bots): Implement debug mode features for bot management
- feat: add comprehensive debug bots documentation and functionality outline

## [1.0.124] - 2026-02-05

- feat: add night ambiance audio and edge tts generation script

## [1.0.123] - 2026-02-05

- feat: Add night audio asset and related audio service functionality

## [1.0.122] - 2026-02-04

- feat: Implement Role Reveal Effects component suite
- feat: update TarotDraw component with new spinning card selection animation and Chinese localization
- Refactor RoleRevealEffects components and tests for improved readability and consistency
- refactor: update AuthService to ensure initPromise is readonly and clarify async operation in constructor
- feat: add quality script for type checking, linting, formatting, and testing feat: implement stable bulb identifiers and random bulb pattern generation in EnhancedRoulette feat: refactor TarotDraw to use a dedicated function for fading out stardust particles feat: modularize reveal handling for Seer, Psychic, Gargoyle, and WolfRobot in actionHandler fix: simplify wolfVotesBySeat updates in wolfKillResolver
- refactor: remove unused sound volume configuration and validation methods from SettingsService
- refactor: remove deprecated functions and update role reveal animations

## [1.0.121] - 2026-02-04

- feat: Implement Scratch Reveal effect configuration

## [1.0.120] - 2026-02-04

- feat: Added FragmentAssemble and ScratchReveal effects for role reveal

## [1.0.119] - 2026-02-04

- feat: added fog reveal effect animation
- feat: Update card dimensions and improve calculations for role reveal effects

## [1.0.118] - 2026-02-04

- feat: Implement role reveal effects with Enhanced Roulette, Flip Reveal,

## [1.0.117] - 2026-02-04

- feat: implement role reveal effects components

## [1.0.116] - 2026-02-03

- feat: Deprecate useRandomEffectType hook and update documentation for random animation handling
- feat: Enhance role reveal animation handling with random resolution and new nonce generation
- feat: Refactor role reveal animation handling to support new animation types
- feat: Update minimum players requirement for template validation
- feat: Add RoleRevealEffects components and utilities
- feat: Add join/leave animations to SeatTile component
- feat: Update Section component documentation and simplify memoization

## [1.0.115] - 2026-02-02

- feat: Implement player grid layout in RoomScreen

## [1.0.114] - 2026-02-02

- feat: Add dynamic avatar component with customizable size

## [1.0.113] - 2026-02-02

- feat: improved player grid layout and responsiveness

## [1.0.112] - 2026-02-02

- feat: implement AuthProvider for global authentication state management

## [1.0.111] - 2026-02-02

- feat: add deploy hook for useAuth functionality

## [1.0.110] - 2026-02-02

- feat: update dependencies and HomeScreen component

## [1.0.109] - 2026-02-02

- chore: update package-lock.json
- feat: Refine logging guidelines and enforce structured logging practices
- feat: Enhance copilot instructions with detailed collaboration rules and architecture boundaries
- feat: Add memoized components for HomeScreen and SettingsScreen
- feat: optimize SeatTile styles handling for improved performance

## [1.0.108] - 2026-02-02

- feat: update dependencies and deploy script

## [1.0.107] - 2026-02-02

- docs: update documentation for v1.0.107

## [1.0.106] - 2026-02-02

- chore: update dependencies to v1.0.106
- feat: implement memoized SeatTile component for optimized rendering in PlayerGrid
- feat: replace BGM toggle switch with dropdown in ConfigScreen
- fix: update button and touchable opacity handling for loading and disabled states across components
- feat: implement BGM toggle in ConfigScreen and remove from HostControlButtons

## [1.0.105] - 2026-02-01

- chore: update dependencies and config

## [1.0.104] - 2026-02-01

- chore: bump version to v1.0.104

## [1.0.103] - 2026-02-01

- fix(e2e): update tests for v1.0.103 release
- fix(P0): Remove RN disabled prop from components to enforce Policy single source of truth
- chore: PR5 cleanup - update dispatchInteraction docs and mark refactor complete
- feat: Integrate REVEAL_ACK and WOLF_ROBOT_HUNTER_STATUS_VIEWED events into RoomInteractionPolicy and RoomScreen
- feat: Refactor RoomScreen interaction architecture with unified RoomInteractionPolicy
- refactor: Update PlayerGrid to ensure it always delegates tap events to the caller, clarifying the role of SeatTapPolicy in handling interaction logic
- feat: Implement SeatTapPolicy for seat tap decision making

## [1.0.102] - 2026-02-01

- chore: bump version to v1.0.102
- test: add contract tests for host authority import boundary and useRoomSeatDialogs hook
- refactor: memoize components to prevent unnecessary re-renders

## [1.0.101] - 2026-02-01

- chore: update dependencies to v1.0.101

## [1.0.100] - 2026-02-01

- chore: bump version to v1.0.100

## [1.0.99] - 2026-02-01

- fix: v1.0.99 release candidate updates

## [1.0.98] - 2026-02-01

- chore: bump version to v1.0.98
- feat: enhance RoomScreen and BoardInfoCard with collapsible functionality and improved styling

## [1.0.97] - 2026-02-01

- chore: update dependencies to v1.0.97

## [1.0.96] - 2026-02-01

- chore: bump version to v1.0.96
- feat: add dropdown selectors for template and animation settings in ConfigScreen
- Refactor styling tokens and components for consistency and responsiveness

## [1.0.95] - 2026-01-31

- (chore): Bump version to v1.0.95
- feat: update audio assets for enhanced gameplay experience
- feat: implement role reveal animation settings and functionality
- feat: add role reveal animation settings and modals

## [1.0.94] - 2026-01-31

- chore: update dependencies to v1.0.94
- fix: improve role card modal animations and handle web compatibility
- feat: enhance theme options and implement night progression evaluator
- fix: add defensive check for wolfRobot targetSeat and improve message handling

## [1.0.93] - 2026-01-31

- chore: update dependencies to v1.0.93

## [1.0.92] - 2026-01-31

- chore: bump version to v1.0.92

## [1.0.91] - 2026-01-30

- chore: update package files for v1.0.91

## [1.0.90] - 2026-01-30

- chore: bump version to v1.0.90

## [1.0.89] - 2026-01-30

- chore: update dependencies and tests

## [1.0.88] - 2026-01-30

- chore: bump version to v1.0.88

## [1.0.87] - 2026-01-30

- "chore: update package files for v1.0.87"

## [1.0.86] - 2026-01-30

- chore: bump version to v1.0.86

## [1.0.85] - 2026-01-30

- "chore: update dependencies and files for v1.0.85"

## [1.0.84] - 2026-01-30

- chore: update dependencies and scripts for v1.0.84

## [1.0.83] - 2026-01-30

- Version bump

## [1.0.82] - 2026-01-30

- Add forest and snow themes to theme configuration

## [1.0.81] - 2026-01-30

- Version bump

## [1.0.80] - 2026-01-30

- Version bump

## [1.0.79] - 2026-01-30

- Version bump

## [1.0.78] - 2026-01-30

- Version bump

## [1.0.77] - 2026-01-30

- Version bump

## [1.0.76] - 2026-01-30

- Version bump

## [1.0.75] - 2026-01-30

- Version bump

## [1.0.74] - 2026-01-30

- Version bump

## [1.0.73] - 2026-01-30

- Version bump

## [1.0.72] - 2026-01-30

- Version bump

## [1.0.71] - 2026-01-30

- Version bump

## [1.0.70] - 2026-01-30

- Version bump

## [1.0.69] - 2026-01-30

- Version bump

## [1.0.68] - 2026-01-30

- Version bump

## [1.0.67] - 2026-01-30

- Version bump

## [1.0.66] - 2026-01-30

- Version bump

## [1.0.65] - 2026-01-30

- Version bump

## [1.0.64] - 2026-01-30

- Version bump

## [1.0.63] - 2026-01-30

- Version bump

## [1.0.62] - 2026-01-30

- Version bump

## [1.0.61] - 2026-01-27

- Version bump

## [1.0.60] - 2026-01-27

- Version bump

## [1.0.59] - 2026-01-27

- Version bump

## [1.0.58] - 2026-01-27

- Version bump

## [1.0.57] - 2026-01-27

- Version bump

## [1.0.56] - 2026-01-27

- Version bump

## [1.0.55] - 2026-01-27

- Version bump

## [1.0.54] - 2026-01-27

- Version bump

## [1.0.53] - 2026-01-27

- Version bump

## [1.0.52] - 2026-01-27

- Version bump

## [1.0.51] - 2026-01-27

- Version bump

## [1.0.50] - 2026-01-27

- Version bump

## [1.0.49] - 2026-01-27

- Version bump

## [1.0.48] - 2026-01-27

- Version bump

## [1.0.47] - 2026-01-27

- Version bump

## [1.0.46] - 2026-01-27

- Version bump

## [1.0.45] - 2026-01-27

- Version bump

## [1.0.44] - 2026-01-27

- Version bump

## [1.0.43] - 2026-01-27

- Version bump

## [1.0.42] - 2026-01-27

- Version bump

## [1.0.41] - 2026-01-27

- Version bump

## [1.0.40] - 2026-01-27

- Version bump

## [1.0.39] - 2026-01-27

- Version bump

## [1.0.38] - 2026-01-27

- Version bump

## [1.0.37] - 2026-01-27

- Version bump

## [1.0.36] - 2026-01-27

- Version bump

## [1.0.35] - 2026-01-27

- Version bump

## [1.0.34] - 2026-01-27

- Version bump

## [1.0.33] - 2026-01-27

- Version bump

## [1.0.32] - 2026-01-27

- Version bump

## [1.0.31] - 2026-01-26

- Version bump

## [1.0.30] - 2026-01-26

- Version bump

## [1.0.29] - 2026-01-26

- Version bump

## [1.0.28] - 2026-01-26

- Version bump

## [1.0.27] - 2026-01-26

- Version bump

## [1.0.26] - 2026-01-26

- docs: 更新README添加AI助手和主题功能说明

## [1.0.25] - 2026-01-26

- Version bump

## [1.0.24] - 2026-01-26

- Version bump

## [1.0.23] - 2026-01-26

- Version bump

## [1.0.22] - 2026-01-26

- Version bump

## [1.0.21] - 2026-01-26

- Version bump

## [1.0.20] - 2026-01-26

- Version bump

## [1.0.19] - 2026-01-26

- Version bump

## [1.0.18] - 2026-01-26

- Version bump

## [1.0.17] - 2026-01-26

- refactor: simplify AIChatBubble - use Keyboard API, remove token settings UI
- refactor: simplify AIChatBubble - use Keyboard API, remove token settings

## [1.0.16] - 2026-01-26

- fix: lock chat window height on open to prevent keyboard resize

## [1.0.15] - 2026-01-26

- fix: AI chat bubble - add desktop click support, fix chat window centering

## [1.0.14] - 2026-01-26

- fix: Use fixed pixel dimensions for chat window to prevent keyboard resize

## [1.0.13] - 2026-01-26

- fix: Center chat window and remove keyboard handling for Web

## [1.0.12] - 2026-01-26

- fix: Prevent chat window resize on keyboard open (Web)

## [1.0.11] - 2026-01-26

- fix: Prevent page scroll during bubble drag & inject GitHub token at build time

## [1.0.10] - 2026-01-26

- fix: Use native touch events for bubble drag (better mobile support)

## [1.0.9] - 2026-01-26

- feat: Auto-sync EXPO_PUBLIC_GITHUB_TOKEN to Vercel on deploy
- feat: Make AI chat bubble draggable and lower position

## [1.0.8] - 2026-01-26

- feat: Auto-configure GitHub Token from environment variable
- feat: Add AI Chat bubble with GitHub Models (GPT-4o)

## [1.0.7] - 2026-01-26

- docs: Update README with bilingual (CN/EN) content

## [1.0.6] - 2026-01-26

- merge: feature/UI_test into main
- fix(RoomScreen): update wolfRobot hunter gate prompt to display correctly after learning
- fix(RoomScreen): update wolfRobot hunter gate prompt and prevent self-seat tap error after learning
- fix(RoomScreen): align hunter gate dialog title and update match conditions for dialog events
- fix(RoomScreen): update wolfRobot hunter gate button text and improve state handling
- feat: Add RoomScreen test harness and board dialog coverage utilities
- fix(RoomScreen): prevent duplicate submission of wolf robot hunter status and suppress auto-trigger for action prompts
- feat: Add getRoleDisplayName function for Chinese role display names and integrate into RoomScreen
- fix(ui): theme names to 2-char Chinese + player name ellipsis + fixed seat row height
- feat: Enhance integration tests with step-level coverage for NIGHT_STEPS and introduce fail-fast mechanisms
- docs: Update integration test requirements for NightFlow execution and failure handling
- Refactor night flow handling and introduce step-by-step execution for integration tests
- feat: Implement wolfRobot hunter status gate functionality
- Refactor NIGHT_STEPS order and update related tests for consistency

## [1.0.5] - 2026-01-24

- Version bump

## [1.0.4] - 2026-01-24

- Version bump

## [1.0.3] - 2026-01-24

- Version bump

## [1.0.2] - 2026-01-24

- Version bump

## [1.0.1] - 2026-01-24

- chore: update version for deploy
- chore: update version for deploy
- chore: update version for deploy
- chore: update version for deploy
- chore: update version for deploy
