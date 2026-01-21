import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation';
import { ThemeProvider, useTheme } from './src/theme';
import { AlertModal } from './src/components/AlertModal';
import { setAlertListener, AlertConfig } from './src/utils/alert';
import { GameFacadeProvider, NetworkProvider } from './src/contexts';
import { V2GameFacade } from './src/services/v2/facade/V2GameFacade';

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
    </>
  );
}

export default function App() {
  console.log('App rendering...');

  // Phase 0: 注入 v2 facade（Host/Player 模式由 facade 内部 initialize/join 决定）
  const facade = V2GameFacade.getInstance();

  return (
    <ThemeProvider>
      <NetworkProvider>
        <GameFacadeProvider facade={facade}>
          <AppContent />
        </GameFacadeProvider>
      </NetworkProvider>
    </ThemeProvider>
  );
}
