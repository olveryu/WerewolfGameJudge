/** Environment-owned Fib word provider selection policy. */

import type { Env } from '../../../env';
import { createLogger } from '../../../platform/observability/logger';
import { createGeminiFibWordProvider } from './gemini';
import { createLocalFibWordProvider } from './local';
import { FibWordProviderError, isFibWordProviderFallbackEligible } from './providerError';
import type { FibWordProvider } from './types';
import { createWorkersAiFibWordProvider } from './workersAi';

export type { FibWordCandidate, FibWordProvider, FibWordRequest } from './types';

const GEMINI_PRIMARY_BUDGET_MS = 4_000;
const log = createLogger('fib-word-provider');

function createBoundedProviderSignal(
  requestSignal: AbortSignal,
  generationDeadlineAt: number,
  maximumDurationMs: number,
): AbortSignal {
  const remainingDurationMs = generationDeadlineAt - Date.now();
  if (requestSignal.aborted || remainingDurationMs <= 0) {
    throw new FibWordProviderError('Fib word generation deadline expired', 'timedOut');
  }
  return AbortSignal.any([
    requestSignal,
    AbortSignal.timeout(Math.min(remainingDurationMs, maximumDurationMs)),
  ]);
}

export function createGeminiPrimaryFibWordProvider(
  geminiProvider: FibWordProvider,
  workersAiProvider: FibWordProvider,
): FibWordProvider {
  return {
    async generate(request) {
      const geminiSignal = createBoundedProviderSignal(
        request.signal,
        request.generationDeadlineAt,
        GEMINI_PRIMARY_BUDGET_MS,
      );
      try {
        return await geminiProvider.generate({ ...request, signal: geminiSignal });
      } catch (error) {
        if (!(error instanceof FibWordProviderError)) {
          log.error('Gemini Fib word provider threw an unexpected error', {
            provider: 'gemini',
            error,
            errorMessage: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }
        if (!isFibWordProviderFallbackEligible(error)) {
          log.error('Gemini Fib word provider failed without fallback', {
            provider: 'gemini',
            failureKind: error.failureKind,
            error,
            errorMessage: error.message,
          });
          throw error;
        }
        log.warn('Gemini Fib word provider failed; falling back to Workers AI', {
          provider: 'gemini',
          failureKind: error.failureKind,
          errorMessage: error.message,
        });
      }

      const remainingDurationMs = request.generationDeadlineAt - Date.now();
      const workersAiSignal = createBoundedProviderSignal(
        request.signal,
        request.generationDeadlineAt,
        remainingDurationMs,
      );
      try {
        const candidate = await workersAiProvider.generate({ ...request, signal: workersAiSignal });
        log.info('Workers AI Fib word fallback succeeded', { provider: 'workers-ai' });
        return candidate;
      } catch (error) {
        log.error('Workers AI Fib word fallback failed', {
          provider: 'workers-ai',
          failureKind:
            error instanceof FibWordProviderError ? error.failureKind : 'unexpectedError',
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    },
  };
}

export function createConfiguredFibWordProvider(bindings: Env): FibWordProvider {
  const configuredSource = bindings.FIB_WORD_PROVIDER;
  if (configuredSource === 'local') {
    return createLocalFibWordProvider();
  }
  if (configuredSource !== 'gemini') {
    throw new Error(`Unknown FIB_WORD_PROVIDER: ${configuredSource}`);
  }
  return createGeminiPrimaryFibWordProvider(
    createGeminiFibWordProvider(bindings.GEMINI_API_KEY),
    createWorkersAiFibWordProvider((model, input, options) =>
      bindings.AI.run(model, input, options),
    ),
  );
}
