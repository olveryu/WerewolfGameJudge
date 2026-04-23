import Ionicons from '@expo/vector-icons/Ionicons';
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
import { WxLoginFailedScreen } from '@/components/WxLoginFailedScreen';
import { APP_VERSION } from '@/config/version';
import { AuthProvider, GameFacadeProvider, ServiceProvider } from '@/contexts';
import { useGameFacade } from '@/contexts';
import { useAuthContext } from '@/contexts/AuthContext';
import { queryClient } from '@/lib/queryClient';
import { getSentryIntegrations } from '@/lib/sentryIntegrations';
import { AppNavigator } from '@/navigation';
import { createAllServices } from '@/services/registry';
import { colors } from '@/theme';
import { AlertConfig, setAlertListener } from '@/utils/alert';
import { signalAppReady } from '@/utils/appReady';
import { log } from '@/utils/logger';

// Initialize Sentry — DSN is a public client key, safe to commit.
// EXPO_PUBLIC_DEPLOY_ENV is set by build.sh from Cloudflare Pages' CF_PAGES_BRANCH.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  release: `werewolfjudge@${APP_VERSION}`,
  // Disable in development to avoid noise
  enabled: !__DEV__,
  environment: __DEV__ ? 'development' : (process.env.EXPO_PUBLIC_DEPLOY_ENV ?? 'production'),
  tracesSampleRate: 1.0, // TEMPORARY: 100% to diagnose missing performance data
  integrations: getSentryIntegrations(),
  // Enable session tracking for Release Health (unique users / sessions)
  enableAutoSessionTracking: true,
  // Enable structured logging (Sentry Logs beta)
  enableLogs: true,
});

// [DIAG] Temporary diagnostic — remove after verifying Sentry Performance works
if (Platform.OS === 'web') {
  const _client = Sentry.getClient();
  // eslint-disable-next-line no-console
  console.warn(
    '[DIAG] Sentry integrations:',
    _client
      ?.getOptions()
      .integrations?.map((i: { name: string }) => i.name)
      .join(', ') ?? 'NO CLIENT',
  );
}

// Keep splash screen visible while app initializes
void SplashScreen.preventAutoHideAsync();

// ─── Boot timing telemetry ──────────────────────────────────────────────
// performance.mark() in index.ts records timestamps before Sentry.init().
// Here we reconstruct the boot waterfall as a Sentry trace with child spans.
// This appears in Sentry Performance as a "web.boot" transaction.
function reportBootTiming() {
  if (Platform.OS !== 'web') return;
  try {
    const marks = performance.getEntriesByType('mark') as PerformanceMark[];
    const getMs = (name: string) => marks.find((m) => m.name === name)?.startTime;
    const bootStart = getMs('boot:start');
    if (bootStart == null) return;

    // Resource timing — WASM and large JS bundles
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const wasmRes = resources.find((r) => r.name.includes('canvaskit.wasm'));
    const jsChunks = resources.filter((r) => r.name.includes('.js') && r.transferSize > 50000);

    Sentry.startSpan(
      { name: 'web.boot', op: 'boot', startTime: (performance.timeOrigin + bootStart) / 1000 },
      (rootSpan) => {
        // Child span for each boot phase
        const phases: [string, string, string][] = [
          ['skia.import', 'skia:import-start', 'skia:import-end'],
          ['skia.wasm', 'skia:wasm-start', 'skia:wasm-end'],
          ['skia.viewapi', 'skia:viewapi-start', 'skia:viewapi-end'],
          ['app.import', 'app:import-start', 'app:import-end'],
        ];
        for (const [opName, startMark, endMark] of phases) {
          const s = getMs(startMark);
          const e = getMs(endMark);
          if (s != null && e != null) {
            const child = Sentry.startInactiveSpan({
              name: opName,
              op: 'boot',
              startTime: (performance.timeOrigin + s) / 1000,
            });
            child.end((performance.timeOrigin + e) / 1000);
          }
        }

        // Resource breadcrumbs for WASM + JS
        if (wasmRes) {
          rootSpan.setAttribute('wasm.duration_ms', Math.round(wasmRes.duration));
          rootSpan.setAttribute('wasm.transfer_kb', Math.round(wasmRes.transferSize / 1024));
          rootSpan.setAttribute('wasm.decoded_kb', Math.round(wasmRes.decodedBodySize / 1024));
        }
        for (const js of jsChunks) {
          Sentry.addBreadcrumb({
            category: 'boot.resource',
            message: js.name.split('/').pop() ?? js.name,
            level: 'info',
            data: {
              durationMs: Math.round(js.duration),
              transferKB: Math.round(js.transferSize / 1024),
              startMs: Math.round(js.startTime),
            },
          });
        }

        // End root span at app:registered mark
        const registered = getMs('app:registered');
        if (registered != null) {
          rootSpan.end((performance.timeOrigin + registered) / 1000);
        }
      },
    );
  } catch {
    // performance API unavailable — ignore silently
  }
}
reportBootTiming();

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
  const { loading: authLoading, wechatLoginFailed } = useAuthContext();

  useEffect(() => {
    if (authLoading) return;

    void SplashScreen.hideAsync(); // native only; web is no-op
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

  // 小程序微信登录失败 → 全屏错误页（替代正常 UI）
  if (wechatLoginFailed) {
    return (
      <>
        <StatusBar style="dark" backgroundColor={colors.background} />
        <WxLoginFailedScreen />
      </>
    );
  }

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
