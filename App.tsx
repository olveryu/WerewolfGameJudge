import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation';
import { ThemeProvider, useTheme } from './src/theme';
import { AlertModal } from './src/components/AlertModal';
import { AIChatBubble } from './src/components/AIChatBubble/AIChatBubble';
import { setAlertListener, AlertConfig } from './src/utils/alert';
import { GameFacadeProvider, NetworkProvider } from './src/contexts';
import { GameFacade } from './src/services/facade/GameFacade';
import { log } from './src/utils/logger';

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
  log.extend('App').debug('render');

  // Phase 0: 注入 facade（Host/Player 模式由 facade 内部 initialize/join 决定）
  const facade = GameFacade.getInstance();

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <NetworkProvider>
          <GameFacadeProvider facade={facade}>
            <AppContent />
          </GameFacadeProvider>
        </NetworkProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
