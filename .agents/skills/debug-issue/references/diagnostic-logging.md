# Diagnostic logging

## Rules

- Use the project logger only (`src/utils/logger.ts`): `console.*` fails the `no-console` rule in `eslint.config.mjs`; diagnostic logs use `log.extend('DIAG')` with the `[DIAG]` prefix so `e2e/helpers/diagnostics.ts` forwards them.
- Add diagnostic logs only when static analysis cannot decide the root cause. Record key variable values, the branch taken, and timing information.
- Every diagnostic log added during debugging must be removed after the fix. Search for the diagnostic prefix before finishing and confirm zero residuals.
- In end-to-end specs and helpers, use test steps and test attachments for evidence, and the diagnostics helper for forwarded logs: `console.*` fails the `no-console` rule in `eslint.config.mjs`, exempted only in `e2e/helpers/diagnostics.ts`.

## Example shape

```typescript
import { log } from '@/utils/logger';

const diagLog = log.extend('DIAG');
diagLog.info('[DIAG] snapshot applied', { phase, playerCount });
```

The example above shows the logger shape only. The field names are illustrative; log the values that decide the branch under investigation, not a fixed field list.

## Error handling during a fix

Route errors through `handleError` in `src/utils/errorPipeline.ts`, which classifies errors and decides logging, reporting, and user feedback.

Deciding files: `src/utils/logger.ts`, `src/utils/errorPipeline.ts`, `src/utils/errorUtils.ts`, `src/utils/alert.ts`, `e2e/helpers/diagnostics.ts`.
