# Diagnostic logging

## Rules

- Use the project logger only (`packages/web/src/utils/logger.ts` in the client): `console.*` fails the `no-console` rule in `eslint.config.mjs`. A logger made with `log.extend('DIAG')` prefixes every line with `[DIAG]`, which `e2e/helpers/diagnostics.ts` forwards.
- The web logger writes every level to the console in development but only `warn` and `error` in a production build, which is what CI E2E serves (`packages/web/dist`); diagnostic lines meant for a CI run use `warn`.
- Add diagnostic logs only when static analysis cannot decide the root cause. Record key variable values, the branch taken, and timing information.
- Every diagnostic log added during debugging must be removed after the fix. Search for the diagnostic prefix before finishing and confirm zero residuals.
- In end-to-end specs and helpers, use test steps and test attachments for evidence, and the diagnostics helper for forwarded logs: `console.*` fails the `no-console` rule in `eslint.config.mjs`, exempted only in `e2e/helpers/diagnostics.ts`.

## Example shape

```typescript
import { log } from '@/utils/logger';

const diagLog = log.extend('DIAG');
diagLog.warn('snapshot applied', { phase, playerCount });
```

The example above shows the logger shape only. The field names are illustrative; log the values that decide the branch under investigation, not a fixed field list.

## Error handling during a fix

Route client errors through `handleError` in `packages/web/src/utils/errorPipeline.ts`, which classifies errors and decides logging, reporting, and user feedback.

Deciding files: `packages/web/src/utils/logger.ts`, `packages/web/src/utils/errorPipeline.ts`, `packages/web/src/utils/errorUtils.ts`, `packages/web/src/utils/alert.ts`, `e2e/helpers/diagnostics.ts`.
