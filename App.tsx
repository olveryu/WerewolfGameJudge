import { StatusBar } from 'expo-status-bar';
import { useCallback,useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AIChatBubble } from '@/components/AIChatBubble';
import { AlertModal } from '@/components/AlertModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider,GameFacadeProvider, NetworkProvider } from '@/contexts';
import { AppNavigator } from '@/navigation';
import { GameFacade } from '@/services/facade/GameFacade';
import { ThemeProvider, useTheme } from '@/theme';
import { AlertConfig,setAlertListener } from '@/utils/alert';
import { log } from '@/utils/logger';

const appLog = log.extend('App');

function AppContent() {
  const { colors, isDark } = useTheme();
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);

  // Set up global alert listener
  useEffect(() => {
    setAlertListener((config) => {
      setAlertConfig(config);
    });
    return () => setAlertListener(null);
  }, []);

  const handleAlertClose = useCallback(() => {
    setAlertConfig(null);
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.background} />
      <AppNavigator />
      {alertConfig && (
        <AlertModal
          visible={true}
          title={alertConfig.title}
          message={alertConfig.message}
          buttons={alertConfig.buttons}
          onClose={handleAlertClose}
        />
      )}
      <AIChatBubble />
    </>
  );
}

export default function App() {
  appLog.debug('render');

  // Composition root: 创建 facade 实例并通过 Context 注入（useState lazy init 保证仅创建一次）
  const [facade] = useState(() => new GameFacade());

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <NetworkProvider>
              <GameFacadeProvider facade={facade}>
                <AppContent />
              </GameFacadeProvider>
            </NetworkProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
