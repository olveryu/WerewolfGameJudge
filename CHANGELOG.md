# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Conventional Commits](https://www.conventionalcommits.org/).

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
