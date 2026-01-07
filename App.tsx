import React, { useState, useEffect, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation';
import { colors } from './src/constants/theme';
import { AlertModal } from './src/components/AlertModal';
import { setAlertListener, AlertConfig } from './src/utils/alert';
import { NetworkProvider } from './src/contexts';

export default function App() {
  console.log('App rendering...');
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
    <NetworkProvider>
      <StatusBar style="dark" backgroundColor={colors.background} />
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
    </NetworkProvider>
  );
}
