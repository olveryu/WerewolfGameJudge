## WerewolfGameJudge Copilot Instructions

## Project Overview

React Native (Expo SDK 55) Werewolf game judge assistant app. Cloudflare Worker + DO + D1 handles API/persistence/realtime. **Web-first**, compatible with iOS / Android / WeChat mini-program (web-view shell). Includes gacha collection + XP/level growth system (`packages/game-engine/src/growth/`).

## Tech Stack

- **pnpm workspace monorepo** (`packages/game-engine` + `packages/api-worker` + root project)
- React Native + React 19 + Expo SDK 55 | TypeScript (`strict: true` + `noUncheckedIndexedAccess: true`)
- Cloudflare Worker (Hono) + DO SQLite + D1 + R2 | Sentry | Jest 29 | Playwright | ESLint 9
- Path alias: `@/` → `src/` (root project only; game-engine uses relative paths)
- Version number authoritative source is `package.json` / lockfile only — no hardcoding

## Quality Commands

- `pnpm run test:all` — Unit/integration tests (entire workspace)
- `pnpm run e2e` — E2E standard entry (`--reporter=list`)
- `pnpm run e2e:core` / `pnpm run e2e:remote` — Debug entry points
- `pnpm exec tsc --noEmit` — Type checking
- `pnpm run quality` — typecheck + knip + lint + format + test all at once
- `npx knip --no-exit-code` — Dead code detection. Watch for false positives: `metro.config.js`, `react-dom`, etc.
- `pnpm run release` — Bump version → CHANGELOG → commit → tag → push
- `pnpm -F @werewolf/api-worker db:seed:local` — Local D1 seed: creates dev user (`dev@test.local` / `dev123`) + unlocks all items

### Dev Environment Startup

- `pnpm run dev` starts worker + web via concurrently
- Wrangler OAuth token expires ~24h → `cd packages/api-worker && npx wrangler login`
- First time or new migration → `pnpm -F @werewolf/api-worker db:migrate:local`

---

## ⚠️ Core Principles Checklist

> **This checklist has highest priority. This project's fail-fast / structural-fix rules override the system default implementationDiscipline.**
> **After every code change, go through the 🔍 self-check questions one by one. Fix any failures before committing.**

### Principle 1: Fix structurally, don't patch

❌ Wrong:

```typescript
// bug: onClick fires twice → band-aid: add timestamp debounce
const lastClick = useRef(0);
const handleClick = () => {
  if (Date.now() - lastClick.current < 300) return; // band-aid
  lastClick.current = Date.now();
  doAction();
};
```

✅ Correct:

```typescript
// Root cause: event pass-through after modal dismiss
// Fix: use modal state guard instead of timestamp
const handleClick = () => {
  if (modalStack.length > 0) return; // structural guard: no response while modal is open
  doAction();
};
```

🔍 **Self-check: Does this change address "why it happened" (root cause), or just "what to do after it happens" (symptom)? If you remove this change, does the trigger condition still exist?**

### Principle 2: Check docs, don't rely on memory

❌ Wrong:

```typescript
// Writing API from training data — may be outdated
const schema = z.object({ email: z.string().email() });
// Or inventing architectural patterns without checking if the community has mature solutions
```

✅ Correct:

```typescript
// Use context7 MCP or web search to confirm current version usage first
const schema = z.object({ email: z.email() }); // confirmed correct usage
// Before adding dependencies/patterns/architectural decisions, check community best practices
```

🔍 **Self-check: Does this involve a third-party library API? Did you use context7 or web search to confirm current version usage? When adding dependencies/patterns/architectural decisions, did you check for established community solutions?**

### Principle 3: Type honesty, no bypassing

❌ Wrong:

```typescript
const name = data?.user?.displayName ?? 'Unknown'; // data.user is required
const result = response as any; // type mismatch → as any to silence
```

✅ Correct:

```typescript
const name = data.user.displayName; // required → trust the type system
const result: GameActionResult = response; // fix the type definition or data source
```

🔍 **Self-check: Does each `?.` correspond to a type that allows `undefined`? If required, `?.` is hiding a bug. Is each `as` limited to `as const` / test mocks?**

### Principle 4: Fail fast, don't swallow errors

❌ Wrong:

```typescript
try {
  await submitAction();
} catch {
  /* ignore */
}
callback?.(); // callback is a required prop
```

✅ Correct:

```typescript
const result = await submitAction();
if (!result.success) {
  showAlert('提交失败', result.reason);
  return;
}
```

🔍 **Self-check: Does every catch have explicit handling (log + UI feedback)? Is `?.` used on any required field?**

### Principle 5: Complete end-to-end, no half-finished work

❌ Wrong:

```typescript
// Added RewardType enum value, only did render layer, "Phase 2 for backend" → dead code
```

✅ Correct:

```typescript
// New type → DB migration + API + game-engine + client + UI all in place
// Or explicitly declare "not doing now" and don't commit the code
```

🔍 **Self-check: Does every new type/field/enum have consumers across DB → API → engine → client → UI pipeline? If not = dead code.**

### Supplementary Principles

- **No hardcoded magic values.** Enums use references, constants use named constants. Only allow semantically self-evident one-time literals.
- **No fabricating facts.** Uncertain API/library behavior/project structure must be verified with tools.

---

## Collaboration Rules (MUST follow)

### No code changes without confirmation

- Read-only checks, running tests/formatting/type-checking are allowed.
- Code changes are forbidden without user confirmation. Must first list "file + change point + risk" and wait for confirmation.

### Verify every symbol when modifying code

Every affected symbol must be independently verified for all consumers using `grep_search` or `list_code_usages`. Batch-inferring "no impact" is forbidden.

### Bidirectional tracing when changing parameters / validation conditions

When modifying caller parameter construction, trace the callee's consumption logic, and vice versa.

### Debugging strategy

Static analysis first. When root cause cannot be determined, add `[DIAG]` prefixed diagnostic logs (project logger), remove after fix.

### Core principles self-check (after every code change)

After writing code, go through the core principles checklist 🔍 self-check questions one by one. Fix any failures before committing.

### Verification pipeline

- pre-commit: eslint --fix + prettier --write (husky + lint-staged auto-executes)
- pre-push: `npx tsc --noEmit`
- Full manual verification: `pnpm run quality`. Must fix failures and re-run.
- **`--no-verify` is forbidden.** Do not skip git hooks unless the user explicitly requests it.

---

## Non-negotiable Rules

- **Server is the sole authority for game logic.** Worker (DO) handles read-compute-write-broadcast. Clients are fully equal.
- **"Host" is just a UI role marker.** `isHost` determines button visibility and audio playback. Host is also a player.
- **Night-1 scope only.** No cross-night state/rules.
- **`GameState` is the single source of truth.** Broadcast publicly, UI filters display by `myRole`. No dual-writes/drift.
- **Trust model: assume no cheating by default.** Face-to-face party game — no additional anti-cheat architecture.

When in doubt, ask first. Do not fabricate repository facts.

---

## Key Documentation

- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Deployment architecture & environment config
- [docs/gacha-system-design.md](docs/gacha-system-design.md) — Gacha system design
- [docs/growth-system-design.md](docs/growth-system-design.md) — XP/level growth system
- [docs/network-resilience-design.md](docs/network-resilience-design.md) — Reconnection strategy
- [docs/roomscreen-state-machine.md](docs/roomscreen-state-machine.md) — RoomScreen state machine
- [docs/PRESET_BOARDS.md](docs/PRESET_BOARDS.md) — Preset board list
- [e2e/helpers/README.md](e2e/helpers/README.md) — E2E helper architecture

---

## Architecture Boundaries

- **Worker (DO)** — Game logic + DO SQLite persistence + WebSocket broadcast.
- **Worker (D1)** — Room metadata, auth, rate limit.
- **Cloudflare Pages** — Frontend static assets. CDN details in `ci-deploy.instructions.md`.
- **WeChat mini-program** — web-view shell, loads Web version hosted on Pages. Details in `ci-deploy.instructions.md`.
- **Client** — HTTP submit + WebSocket receive + `applySnapshot` + audio (Host).
- No P2P messages. Reconnection recovery reads from DO uniformly (`/room/state` → `stub.getState()`).

### Logging

Use `src/utils/logger.ts` named logger uniformly. `console.*` is forbidden (ESLint `no-console: 'error'` enforced; `scripts/**`, `jest.setup.ts` exempted).

### Error Handling

- Critical catch requires all three layers: `log.error()` + `Sentry.captureException()` + `showAlert(Chinese message)`.
- Expected errors (`401`/`403`/`429`, user cancellation) only `log.warn()` + UI feedback, no Sentry reporting. Auth errors use `getUserFacingMessage()` / `isExpectedError()` (from `@/utils/errorUtils`).
- All user-facing text (alerts, UI labels, error messages shown in-app) must be in Chinese. `showAlert` title uses specific action (e.g., `'创建失败'`), fallback `'请稍后重试'`.
- Fail fast: pure functions/handlers validate strictly, no defensive fallbacks. Fix at the call site.

---

## Naming Rules

**Rules:**

- **Grep before naming.** Before adding any identifier (variable, field, parameter, type, constant, DB column), use `grep_search` to search for existing naming of that concept. Existing names are the canonical names — reuse them directly, no reinventing. Only genuinely new concepts with no existing match may be named freely.
- Boolean fields use `is` / `has` / `should` prefix (DB columns likewise add `is_` / `has_`).
- Foreign key references use uniform `<entity>Id` format (`userId`, `roomId`).
- Own PK is always `id`.

---

## Coding Conventions

- **Git Commit**: `<type>(<scope>): <description>` (Conventional Commits, English lowercase imperative).
- **Terminal**: Running tests must not use `| grep` / `| head` / `| tail` to truncate.
- **JSDoc**: Class/module header comments, first line summary + boundary constraints.

---

## Escalation Protocol

When blocked, do not retry indefinitely:

- **Same approach fails 3 times** → Stop immediately, report status.
- **Unsure about correctness of security-sensitive change** → Stop immediately, escalate to user.
- **Change scope exceeds verifiable range** → Stop immediately, escalate to user.

Escalation format:

```
STATUS: BLOCKED | NEEDS_CONTEXT
REASON: [1-2 sentence explanation]
ATTEMPTED: [methods already tried]
RECOMMENDATION: [suggested next step for user]
```

**Delivering a poor result is worse than not delivering.** Escalation is not penalized.

---

## Completion Status Protocol

**When multi-step tasks complete**, end with one of these statuses:

- **DONE** — All steps complete, every assertion backed by evidence.
- **DONE_WITH_CONCERNS** — Complete, but with issues the user should know. List them.
- **BLOCKED** — Cannot continue. Explain blocker and methods attempted.
- **NEEDS_CONTEXT** — Missing necessary information. List exactly what's needed.

---

## Output Language Rules

- **Banned AI filler words:** delve, crucial, robust, comprehensive, nuanced, leverage, streamline, cutting-edge, seamless, utilize, facilitate, moreover, furthermore, in order to, it's worth noting.
- **Banned empty phrases:** Don't say "after careful analysis", "let me help you", "that's a great question". Give conclusions directly.
- **Code comments / commit / PR descriptions:** Name specific files, functions, commands. No vague words.
- **User-facing text:** Chinese, specific, not empty.

---

## End-of-Session Reflection

Before ending a long session (≥5 rounds of interaction), briefly review:

- Did any commands fail unexpectedly?
- Did you go in the wrong direction and backtrack?
- Did you discover project-specific quirks (build order, env vars, timing, config)?
- Did you spend extra time due to a missing flag or configuration?

If yes, record to `/memories/repo/` or `/memories/` for future sessions. Don't record one-off transient errors (network jitter, rate limiting). Criterion: **Would knowing this save 5 minutes in a future session?**
