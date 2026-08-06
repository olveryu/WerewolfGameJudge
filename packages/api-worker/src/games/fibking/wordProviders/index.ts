/** Environment-owned Fib word provider selection policy. */

import type { Env } from '../../../env';
import { createGeminiFibWordProvider } from './gemini';
import { createLocalFibWordProvider } from './local';
import { FibWordProviderError, isFibWordProviderFallbackEligible } from './providerError';
import type { FibWordProvider } from './types';
import { createWorkersAiFibWordProvider } from './workersAi';

export type { FibWordCandidate, FibWordProvider, FibWordRequest } from './types';

const GEMINI_PRIMARY_BUDGET_MS = 4_000;

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
        if (!(error instanceof FibWordProviderError) || !isFibWordProviderFallbackEligible(error)) {
          throw error;
        }
      }

      const remainingDurationMs = request.generationDeadlineAt - Date.now();
      const workersAiSignal = createBoundedProviderSignal(
        request.signal,
        request.generationDeadlineAt,
        remainingDurationMs,
      );
      return workersAiProvider.generate({ ...request, signal: workersAiSignal });
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
