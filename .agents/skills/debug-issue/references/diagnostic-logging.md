# Diagnostic logging

## Rules

- Use the project logger only. Console output in production code is forbidden by the lint configuration. Diagnostic logs use a named logger extended for diagnostics, with the diagnostic prefix on every message, so the end-to-end diagnostics forwarder can pick them up.
- Add diagnostic logs only when static analysis cannot decide the root cause. Record key variable values, the branch taken, and timing information. Do not log secrets, tokens, or full user data.
- Every diagnostic log added during debugging must be removed after the fix. Search for the diagnostic prefix before finishing and confirm zero residuals. Diagnostic output must never be committed.
- In end-to-end specs and helpers, do not add ad-hoc console output. Use test steps and test attachments for evidence, and the diagnostics helper for forwarded logs.

## Example shape

```typescript
import { log } from '@/utils/logger';

const diagLog = log.extend('DIAG');
diagLog.info('[DIAG] snapshot applied', { phase, playerCount });
```

The example above shows the logger shape only. The field names are illustrative; log the values that decide the branch under investigation, not a fixed field list.

## Error handling during a fix

Route errors through the project's error-handling entry point, `handleError` in `src/utils/errorPipeline.ts`. It classifies errors and decides logging, reporting, and user feedback. Do not hand-roll a separate logging-plus-reporting-plus-alert sequence in each catch block, and do not swallow errors. Expected errors (for example authentication failures, user cancellation, and aborts) are handled through the same entry point with a lower severity path; do not invent a per-catch severity scheme. The exact expected-error list and the three-layer wording from the previous version of the global rules were not verified as a universal enforced rule; this skill therefore names the entry point and forbids swallowing, and states nothing stronger. See `SOURCES.md`.

Deciding files: `src/utils/logger.ts`, `src/utils/errorPipeline.ts`, `src/utils/errorUtils.ts`, `src/utils/alert.ts`, `e2e/helpers/diagnostics.ts`.
