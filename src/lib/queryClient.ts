import * as Sentry from '@sentry/react-native';
import { MutationCache, QueryClient } from '@tanstack/react-query';

import { isAbortError, isExpectedError, isNetworkError } from '@/utils/errorUtils';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000, // 2 min — stats/profile don't change rapidly
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
    },
    mutations: {
      retry: 0, // mutation 默认不重试，由各 mutation 自行声明
    },
  },
  mutationCache: new MutationCache({
    onError: (error, _variables, _onMutateResult, mutation) => {
      // 全局 mutation 错误日志（不含 UI 反馈，UI 在各 mutation 的 onError 里）
      // 跳过可预期错误：网络错误（已重试过）、用户取消、auth/validation 错误
      if (isNetworkError(error) || isAbortError(error) || isExpectedError(error)) {
        return;
      }
      Sentry.captureException(error, {
        tags: { mutationKey: String(mutation.options.mutationKey ?? 'unknown') },
      });
    },
  }),
});
