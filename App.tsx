import * as Sentry from '@sentry/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toaster } from 'sonner-native';

import { AIChatBubble } from '@/components/AIChatBubble';
import { AlertModal } from '@/components/AlertModal';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { WxLoginFailedScreen } from '@/components/WxLoginFailedScreen';
import { APP_VERSION } from '@/config/version';
import { AuthProvider, GameFacadeProvider, ServiceProvider } from '@/contexts';
import { useGameFacade } from '@/contexts';
import { useAuthContext } from '@/contexts/AuthContext';
import { useBootProgress } from '@/hooks/useBootProgress';
import { queryClient } from '@/lib/queryClient';
import { getSentryIntegrations } from '@/lib/sentryIntegrations';
import { AppNavigator } from '@/navigation';
import { createAllServices } from '@/services/registry';
import { colors } from '@/theme';
import { type AlertConfig, setAlertListener } from '@/utils/alert';
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
  tracesSampleRate: 0.5,
  integrations: getSentryIntegrations(),
  // Enable session tracking for Release Health (unique users / sessions)
  enableAutoSessionTracking: true,
  // Enable structured logging (Sentry Logs beta)
  enableLogs: true,
});

// Keep splash screen visible while app initializes
void SplashScreen.preventAutoHideAsync();

// Configure splash → JS transition: 400ms cross-fade
SplashScreen.setOptions({ duration: 400, fade: true });

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

/** Send per-resource load timing to our Analytics Engine via beacon. */
function reportLoadTiming() {
  if (Platform.OS !== 'web') return;
  try {
    const marks = performance.getEntriesByType('mark') as PerformanceMark[];
    const getMs = (name: string) => marks.find((m) => m.name === name)?.startTime;
    const bootStart = getMs('boot:start');
    const registered = getMs('app:registered');
    const totalMs = bootStart != null && registered != null ? registered - bootStart : 0;

    // HTML document TTFB
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const htmlTtfb =
      navEntries.length > 0
        ? Math.round(navEntries[0]!.responseStart - navEntries[0]!.startTime)
        : 0;

    // Collect significant resources (JS, WASM, fonts — skip tiny icons)
    // Include cache hits (transferSize=0) for duration diagnostics
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const significant = resources.filter(
      (r) => r.transferSize > 1024 || r.name.includes('.wasm') || r.name.includes('.js'),
    );

    const entries = significant.slice(0, 50).map((r) => ({
      name: r.name,
      duration: Math.round(r.duration),
      transferSize: Math.round(r.transferSize),
      decodedBodySize: Math.round(r.decodedBodySize),
      dns: Math.round(r.domainLookupEnd - r.domainLookupStart),
      tcp: Math.round(r.connectEnd - r.connectStart),
      tls: r.secureConnectionStart > 0 ? Math.round(r.connectEnd - r.secureConnectionStart) : 0,
      ttfb: Math.round(r.responseStart - r.requestStart),
      download: Math.round(r.responseEnd - r.responseStart),
    }));

    if (entries.length === 0) return;

    const payload = JSON.stringify({
      totalMs: Math.round(totalMs),
      htmlTtfb,
      resources: entries,
      ua: navigator.userAgent,
    });

    const url = `${process.env.EXPO_PUBLIC_CF_API_URL ?? 'https://api.werewolfjudge.eu.org'}/telemetry/load-timing`;
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, payload);
    } else {
      void fetch(url, {
        method: 'POST',
        body: payload,
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } catch {
    // telemetry is best-effort — never block app
  }
}
// Delay to next macrotask so app:registered mark is available
setTimeout(reportLoadTiming, 0);

const appLog = log.extend('App');

/** Remove the HTML splash overlay on web (defined in web/index.html). */
function dismissWebSplash() {
  if (Platform.OS !== 'web') return;
  const splash = document.getElementById('splash-screen');
  if (!splash) return;
  const pctEl = document.getElementById('splash-pct');
  const bar = splash.querySelector<HTMLElement>('.progress-bar');
  if (bar) bar.style.width = '100%';
  if (pctEl) pctEl.textContent = '100%';

  // 切换 body 背景到主题色（splash 是 z-index:9999 全覆盖，切换时用户看不到）
  const themeBg = document.documentElement.style.getPropertyValue('--theme-bg') || '#F2F2F7';
  document.documentElement.style.backgroundColor = themeBg;
  document.body.style.backgroundColor = themeBg;

  // 等一帧让浏览器完成背景渲染，再淡出 splash，避免闪色
  requestAnimationFrame(() => {
    setTimeout(() => {
      splash.classList.add('hidden');
      setTimeout(() => splash.remove(), 300); // match CSS transition duration
    }, 200);
  });
}

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

  // Set up global alert listener
  useEffect(() => {
    setAlertListener((config) => {
      setAlertConfig(config);
    });
    return () => setAlertListener(null);
  }, []);

  // ── Boot readiness ────────────────────────────────────────────────────
  // Expo standard pattern: keep splash visible, render nothing until ready.
  // Web: HTML splash (z-index:9999) covers everything; native: expo-splash-screen.
  const { wechatLoginFailed } = useAuthContext();
  const bootProgress = useBootProgress();

  // Native: dismiss static splash once ready (expo-splash-screen is no-op on web)
  useEffect(() => {
    if (bootProgress.isReady && Platform.OS !== 'web') {
      void SplashScreen.hideAsync();
    }
  }, [bootProgress.isReady]);

  // Web: NavigationContainer onReady → first screen has laid out.
  // At this point Ionicons are in the DOM, so document.fonts.ready correctly
  // waits for the icon font file to finish downloading & rendering.
  // (document.fonts.ready only works when the font is actually used by DOM elements;
  // calling it earlier — e.g. right after Font.loadAsync — would resolve immediately
  // because the browser hasn't queued the font for loading yet.)
  const handleNavReady = useCallback(() => {
    if (Platform.OS === 'web') {
      void document.fonts.ready.then(() => {
        dismissWebSplash();
        signalAppReady();
      });
      return;
    }
    signalAppReady();
  }, []);

  // Web: sync HTML theme-color meta and body background with current theme.
  // Skip body background while splash is showing — dismissWebSplash handles the transition.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', colors.surface);
    if (!document.getElementById('splash-screen')) {
      document.body.style.backgroundColor = colors.background;
      document.documentElement.style.backgroundColor = colors.background;
    }
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

  // Not ready → render nothing; splash (HTML on web / native) stays visible.
  if (!bootProgress.isReady) {
    return null;
  }

  return (
    <>
      <StatusBar style="dark" backgroundColor={colors.background} />
      <AppNavigator onReady={handleNavReady} />
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
