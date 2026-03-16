/**
 * FortuneWheelLoader — Web CanvasKit 异步加载包装器
 *
 * Web 端 @shopify/react-native-skia 依赖全局 CanvasKit WASM 运行时。
 * 此 Loader 使用 React.lazy + Suspense 确保 FortuneWheel 模块仅在
 * LoadSkiaWeb() 设置好 global.CanvasKit 之后才被 import 和执行。
 * Native 端 Skia 使用原生绑定，无需异步加载。
 * 加载失败时 fallback 跳过动画以免阻塞游戏流程。
 */
import React, { Suspense, useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { log } from '@/utils/logger';

import type { RoleData, RoleRevealEffectProps } from '../types';

interface FortuneWheelLoaderProps extends RoleRevealEffectProps {
  allRoles?: RoleData[];
}

/**
 * Must match the installed `canvaskit-wasm` transitive dependency version.
 * Verify: node -p "require('canvaskit-wasm/package.json').version"
 */
const CANVASKIT_VERSION = '0.40.0';

const CANVASKIT_CDN = `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${CANVASKIT_VERSION}/bin/full`;

/**
 * Fallback component when CanvasKit fails to load.
 * Calls onComplete immediately to skip animation and unblock game flow.
 */
const FortuneWheelFallback: React.FC<RoleRevealEffectProps> = ({ onComplete }) => {
  useEffect(() => {
    onComplete();
  }, [onComplete]);
  return null;
};

const FortuneWheelLazy = React.lazy(async () => {
  try {
    if (Platform.OS === 'web') {
      const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');

      await LoadSkiaWeb({
        locateFile: (file: string) => `${CANVASKIT_CDN}/${file}`,
      });

      log.info('[FortuneWheel] CanvasKit WASM loaded from CDN');
    }

    const mod = await import('./FortuneWheel');
    return { default: mod.FortuneWheel };
  } catch (err) {
    log.error('[FortuneWheel] Failed to load CanvasKit WASM:', err);
    return { default: FortuneWheelFallback };
  }
});

const LoadingFallback = () => (
  <View style={styles.loading}>
    <ActivityIndicator size="large" color={LOADING_COLOR} />
  </View>
);

/**
 * FortuneWheel wrapper — uses React.lazy + Suspense to ensure CanvasKit WASM
 * is loaded before the Skia-dependent FortuneWheel module is evaluated on web.
 */
export const FortuneWheel: React.FC<FortuneWheelLoaderProps> = (props) => (
  <Suspense fallback={<LoadingFallback />}>
    <FortuneWheelLazy {...props} />
  </Suspense>
);

// ─── Internal constants ────────────────────────────────────────────────
const LOADING_COLOR = '#7A7A8A';

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
