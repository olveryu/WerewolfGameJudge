import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import { log } from '../utils/logger';
import { showAlert } from '../utils/alert';

interface NetworkContextType {
  isConnecting: boolean;
  lastError: string | null;
  // Call this when a network request fails
  reportNetworkError: (error: Error, retryFn?: () => Promise<void>) => void;
  // Call this to retry the last failed operation
  retryLastOperation: () => Promise<void>;
  // Clear error state
  clearError: () => void;
}

const NetworkContext = createContext<NetworkContextType>({
  isConnecting: false,
  lastError: null,
  reportNetworkError: () => {},
  retryLastOperation: async () => {},
  clearError: () => {},
});

export const useNetwork = () => useContext(NetworkContext);

interface Props {
  children: React.ReactNode;
}

export const NetworkProvider: React.FC<Props> = ({ children }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const retryFnRef = useRef<(() => Promise<void>) | null>(null);
  const retryDialogShownRef = useRef(false);

  const clearError = useCallback(() => {
    setLastError(null);
    retryFnRef.current = null;
  }, []);

  const retryLastOperation = useCallback(async () => {
    if (!retryFnRef.current) {
      log.extend('Network').debug(' No operation to retry');
      return;
    }

    setIsConnecting(true);
    setLastError(null);

    try {
      log.extend('Network').debug(' Retrying operation...');
      await retryFnRef.current();
      log.extend('Network').debug(' Retry successful');
      retryFnRef.current = null;
    } catch (error) {
      log.extend('Network').error(' Retry failed:', error);
      // The operation itself should call reportNetworkError again if it fails
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const reportNetworkError = useCallback(
    (error: Error, retryFn?: () => Promise<void>) => {
      const errorMsg = error.message || '网络请求失败';
      log.extend('Network').error(' Error reported:', errorMsg);

      setLastError(errorMsg);
      if (retryFn) {
        retryFnRef.current = retryFn;
      }

      // Check if it's a timeout or network error
      const isTimeout =
        errorMsg.includes('timed out') || errorMsg.includes('timeout') || errorMsg.includes('超时');
      const isNetworkError =
        errorMsg.includes('network') ||
        errorMsg.includes('Network') ||
        errorMsg.includes('fetch') ||
        errorMsg.includes('网络');

      // Determine title and message
      let title = '操作失败';
      let message = errorMsg;
      if (isTimeout) {
        title = '请求超时';
        message = '服务器响应超时，可能是网络不稳定。';
      } else if (isNetworkError) {
        title = '网络错误';
        message = '网络连接不稳定，请检查网络设置。';
      }

      if (!retryDialogShownRef.current) {
        retryDialogShownRef.current = true;

        showAlert(
          title,
          message,
          retryFn
            ? [
                {
                  text: '重试',
                  onPress: () => {
                    retryDialogShownRef.current = false;
                    retryLastOperation();
                  },
                },
                {
                  text: '取消',
                  style: 'cancel',
                  onPress: () => {
                    retryDialogShownRef.current = false;
                    clearError();
                  },
                },
              ]
            : [
                {
                  text: '确定',
                  onPress: () => {
                    retryDialogShownRef.current = false;
                    clearError();
                  },
                },
              ],
        );
      }
    },
    [retryLastOperation, clearError],
  );

  const contextValue = useMemo(
    () => ({
      isConnecting,
      lastError,
      reportNetworkError,
      retryLastOperation,
      clearError,
    }),
    [isConnecting, lastError, reportNetworkError, retryLastOperation, clearError],
  );

  return <NetworkContext.Provider value={contextValue}>{children}</NetworkContext.Provider>;
};
