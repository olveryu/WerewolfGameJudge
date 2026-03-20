import * as Sentry from '@sentry/react-native';
import { GameStore } from '@werewolf/game-engine/engine/store';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AIChatBubble } from '@/components/AIChatBubble';
import { AlertModal } from '@/components/AlertModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemedToast } from '@/components/ThemedToast';
import { AuthProvider, GameFacadeProvider, NetworkProvider, ServiceProvider } from '@/contexts';
import type { ServiceContextValue } from '@/contexts/ServiceContext';
import { AppNavigator } from '@/navigation';
import { GameFacade } from '@/services/facade/GameFacade';
import { AvatarUploadService } from '@/services/feature/AvatarUploadService';
import { SettingsService } from '@/services/feature/SettingsService';
import { AudioService } from '@/services/infra/AudioService';
import { AuthService } from '@/services/infra/AuthService';
import { RoomService } from '@/services/infra/RoomService';
import { RealtimeService } from '@/services/transport/RealtimeService';
import { ThemeProvider, useTheme } from '@/theme';
import { AlertConfig, setAlertListener } from '@/utils/alert';
import { signalAppReady } from '@/utils/appReady';
import { log } from '@/utils/logger';
import { preloadCanvasKit } from '@/utils/preloadCanvasKit';

// Initialize Sentry — DSN is public (like Supabase anon key), safe to commit.
// EXPO_PUBLIC_DEPLOY_ENV is set by build.sh from Vercel's VERCEL_ENV system var.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  // Disable in development to avoid noise
  enabled: !__DEV__,
  environment: __DEV__ ? 'development' : (process.env.EXPO_PUBLIC_DEPLOY_ENV ?? 'production'),
  tracesSampleRate: 0.5,
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

  // Preload CanvasKit WASM (web only) during splash, then hide splash screen
  useEffect(() => {
    preloadCanvasKit().finally(() => {
      SplashScreen.hideAsync(); // native only; web is no-op
      // Web: remove the HTML splash overlay defined in web/index.html
      if (Platform.OS === 'web') {
        const splash = document.getElementById('splash-screen');
        if (splash) {
          splash.classList.add('hidden');
          setTimeout(() => splash.remove(), 300); // match CSS transition duration
        }
      }
      signalAppReady();
    });
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
      <ThemedToast />
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
        realtimeService: new RealtimeService(),
        audioService: services.audioService,
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
