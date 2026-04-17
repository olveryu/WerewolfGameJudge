import { Ionicons } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toaster } from 'sonner-native';

import { AIChatBubble } from '@/components/AIChatBubble';
import { AlertModal } from '@/components/AlertModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useSkiaShaderWarmup } from '@/components/SkiaShaderWarmup';
import { APP_VERSION } from '@/config/version';
import { AuthProvider, GameFacadeProvider, ServiceProvider } from '@/contexts';
import { useGameFacade } from '@/contexts';
import { useAuthContext } from '@/contexts/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { AppNavigator } from '@/navigation';
import { createAllServices } from '@/services/registry';
import { colors } from '@/theme';
import { AlertConfig, setAlertListener } from '@/utils/alert';
import { signalAppReady } from '@/utils/appReady';
import { log } from '@/utils/logger';

// Initialize Sentry — DSN is public (like Supabase anon key), safe to commit.
// EXPO_PUBLIC_DEPLOY_ENV is set by build.sh from Cloudflare Pages' CF_PAGES_BRANCH.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  release: `werewolfjudge@${APP_VERSION}`,
  // Disable in development to avoid noise
  enabled: !__DEV__,
  environment: __DEV__ ? 'development' : (process.env.EXPO_PUBLIC_DEPLOY_ENV ?? 'production'),
  tracesSampleRate: 0.5,
  // Enable session tracking for Release Health (unique users / sessions)
  enableAutoSessionTracking: true,
  // Enable structured logging (Sentry Logs beta)
  enableLogs: true,
});

// Keep splash screen visible while app initializes
SplashScreen.preventAutoHideAsync();

const appLog = log.extend('App');

function AppContent() {
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const facade = useGameFacade();

  // Compute triggerPulse: true when game has progressed past Unseated/Seated
  const [triggerPulse, setTriggerPulse] = useState(() => {
    const s = facade.getState();
    return s !== null && s.status !== GameStatus.Unseated && s.status !== GameStatus.Seated;
  });

  useEffect(() => {
    const unsubscribe = facade.addListener((state) => {
      const isAssigned =
        state !== null &&
        state.status !== GameStatus.Unseated &&
        state.status !== GameStatus.Seated;
      setTriggerPulse(isAssigned);
    });
    return unsubscribe;
  }, [facade]);

  // Preload icon font on web — catch timeout to prevent unhandled rejection
  // in WeChat WebView where font loading may be blocked (WEREWOLFJUDGE-15)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    Font.loadAsync(Ionicons.font).catch((err: Error) => {
      appLog.warn('Icon font load failed (graceful degradation)', err.message);
    });
  }, []);

  // Pre-compile Skia GPU shaders via offscreen texture (eliminates first-frame jank)
  useSkiaShaderWarmup();

  // Set up global alert listener
  useEffect(() => {
    setAlertListener((config) => {
      setAlertConfig(config);
    });
    return () => setAlertListener(null);
  }, []);

  // Hide splash screen and signal app ready — wait for auth to resolve first
  // so HomeScreen renders with final user state (no tips card flash).
  const { loading: authLoading } = useAuthContext();

  useEffect(() => {
    if (authLoading) return;

    SplashScreen.hideAsync(); // native only; web is no-op
    // Web: remove the HTML splash overlay defined in web/index.html
    if (Platform.OS === 'web') {
      const splash = document.getElementById('splash-screen');
      if (splash) {
        // Set progress to 100% before hiding
        const pctEl = document.getElementById('splash-pct');
        const bar = splash.querySelector<HTMLElement>('.progress-bar');
        if (bar) bar.style.width = '100%';
        if (pctEl) pctEl.textContent = '100%';
        setTimeout(() => {
          splash.classList.add('hidden');
          setTimeout(() => splash.remove(), 300); // match CSS transition duration
        }, 200);
      }
    }
    signalAppReady();
  }, [authLoading]);

  // Web: sync HTML theme-color meta and body background with current theme
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', colors.surface);
    document.body.style.backgroundColor = colors.background;
    document.documentElement.style.backgroundColor = colors.background;
  }, []);

  const handleAlertClose = useCallback(() => {
    setAlertConfig(null);
  }, []);

  return (
    <>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <AppNavigator />
      {alertConfig && (
        <AlertModal
          visible={true}
          title={alertConfig.title}
          message={alertConfig.message}
          buttons={alertConfig.buttons}
          input={alertConfig.input}
          onClose={handleAlertClose}
        />
      )}
      <AIChatBubble triggerPulse={triggerPulse} />
      <Toaster theme="light" richColors position="bottom-center" />
    </>
  );
}

export default function App() {
  appLog.debug('render');

  // Composition root: 通过 ServiceRegistry 创建所有 service 实例
  // useState lazy init 保证仅创建一次
  const [{ services, facade }] = useState(() => createAllServices());

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ServiceProvider services={services}>
            <AuthProvider>
              <GameFacadeProvider facade={facade}>
                <AppContent />
              </GameFacadeProvider>
            </AuthProvider>
          </ServiceProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
