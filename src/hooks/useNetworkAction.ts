import { useCallback, useEffect, useRef, useState } from 'react';
import { showAlert } from '../utils/alert';

/**
 * Hook for executing network actions with automatic error handling and retry support.
 * Shows a user-friendly dialog when network errors occur, allowing retry.
 */
export function useNetworkAction() {
  const [isLoading, setIsLoading] = useState(false);

  // Keep a stable way to call the latest execute implementation (for retry callbacks)
  const executeRef = useRef<
    (<T>(action: () => Promise<T>, actionName?: string) => Promise<T | null>) | null
  >(null);

  /**
   * Execute an async action with network error handling.
   * If the action fails, shows a retry dialog to the user.
   *
   * @param action - The async function to execute
   * @param actionName - A user-friendly name for the action (e.g., "查看身份")
   * @returns The result of the action, or null if cancelled
   */
  const execute = useCallback(
    async <T>(action: () => Promise<T>, actionName: string = '操作'): Promise<T | null> => {
      setIsLoading(true);

      try {
        const result = await action();
        setIsLoading(false);
        return result;
      } catch (error) {
        setIsLoading(false);
        const errorMessage = error instanceof Error ? error.message : '未知错误';

        return new Promise((resolve) => {
          showAlert('网络错误', `${actionName}失败：${errorMessage}`, [
            {
              text: '重试',
              onPress: () => {
                // Restart the whole execute flow
                executeRef.current?.(action, actionName).then(resolve);
              },
            },
            {
              text: '取消',
              style: 'cancel',
              onPress: () => resolve(null),
            },
          ]);
        });
      }
    },
    [],
  );

  useEffect(() => {
    executeRef.current = execute;
  }, [execute]);

  return { execute, isLoading };
}

/**
 * Simple wrapper to execute an action with retry dialog on error.
 * Use this when you don't need the loading state.
 */
export async function executeWithRetry<T>(
  action: () => Promise<T>,
  actionName: string = '操作',
): Promise<T | null> {
  try {
    return await action();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';

    return new Promise((resolve) => {
      showAlert('网络错误', `${actionName}失败：${errorMessage}`, [
        {
          text: '重试',
          onPress: () => {
            executeWithRetry(action, actionName).then(resolve);
          },
        },
        {
          text: '取消',
          style: 'cancel',
          onPress: () => resolve(null),
        },
      ]);
    });
  }
}
