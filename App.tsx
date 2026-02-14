import * as Sentry from '@sentry/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AIChatBubble } from '@/components/AIChatBubble';
import { AlertModal } from '@/components/AlertModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { AuthProvider, GameFacadeProvider, NetworkProvider, ServiceProvider } from '@/contexts';
import type { ServiceContextValue } from '@/contexts/ServiceContext';
import { AppNavigator } from '@/navigation';
import { GameStore } from '@/services/engine/store';
import { GameFacade } from '@/services/facade/GameFacade';
import { AvatarUploadService } from '@/services/feature/AvatarUploadService';
import { SettingsService } from '@/services/feature/SettingsService';
import { AudioService } from '@/services/infra/AudioService';
import { AuthService } from '@/services/infra/AuthService';
import { HostStateCache } from '@/services/infra/HostStateCache';
import { RoomService } from '@/services/infra/RoomService';
import { BroadcastService } from '@/services/transport/BroadcastService';
import { ThemeProvider, useTheme } from '@/theme';
import { AlertConfig, setAlertListener } from '@/utils/alert';
import { log } from '@/utils/logger';

// Initialize Sentry — DSN is public (like Supabase anon key), safe to commit.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  // Disable in development to avoid noise
  enabled: !__DEV__,
  tracesSampleRate: 0.2,
});

// Keep splash screen visible while app initializes
SplashScreen.preventAutoHideAsync();

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

  // Hide splash screen once app content is ready
  useEffect(() => {
    SplashScreen.hideAsync();
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

  // Composition root: 创建所有 service 实例（useState lazy init 保证仅创建一次）
  const [services] = useState<ServiceContextValue>(() => {
    const authService = new AuthService();
    const roomService = new RoomService();
    const settingsService = new SettingsService();
    const audioService = new AudioService();
    const avatarUploadService = new AvatarUploadService(authService);
    return { authService, roomService, settingsService, audioService, avatarUploadService };
  });

  const [facade] = useState(
    () =>
      new GameFacade({
        store: new GameStore(),
        broadcastService: new BroadcastService(),
        audioService: services.audioService,
        hostStateCache: new HostStateCache(),
        roomService: services.roomService,
      }),
  );

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ServiceProvider services={services}>
          <ThemeProvider>
            <AuthProvider>
              <NetworkProvider>
                <GameFacadeProvider facade={facade}>
                  <AppContent />
                </GameFacadeProvider>
              </NetworkProvider>
            </AuthProvider>
          </ThemeProvider>
        </ServiceProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
