# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Conventional Commits](https://www.conventionalcommits.org/).

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
