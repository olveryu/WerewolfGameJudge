/**
 * preloadCanvasKit — App boot 阶段预加载 CanvasKit WASM
 *
 * Web 端 Skia 动画（SealBreak / ChainShatter / FortuneWheel / RoleHunt）
 * 依赖 CanvasKit WASM (~2.5MB)。各 Loader 会独立调用 LoadSkiaWeb()，
 * 但首次加载需下载 + 编译 WASM，用户会看到 loading spinner。
 *
 * 此模块在 App.tsx splash 阶段提前触发 LoadSkiaWeb()，使 WASM 在
 * 用户进入游戏前就已缓存到内存（LoadSkiaWeb 内部幂等，重复调用 no-op）。
 * 配合 index.html `<link rel="preload">` 和 SW cache-first 策略，
 * 首次访问后 WASM 即被 Service Worker 持久缓存。
 *
 * Native 端 Skia 使用原生绑定，此函数立即返回。
 * 不含业务逻辑，不 import service。
 */
import { Platform } from 'react-native';

import { log } from '@/utils/logger';

/**
 * Must match the installed `canvaskit-wasm` transitive dependency version
 * and the version used in all *Loader.tsx files.
 */
const CANVASKIT_VERSION = '0.40.0';
const CANVASKIT_CDN = `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${CANVASKIT_VERSION}/bin/full`;

const preloadLog = log.extend('preload');

/**
 * Preload CanvasKit WASM runtime at app boot (web only).
 * Non-fatal: if loading fails, individual Loaders will retry on demand.
 */
export async function preloadCanvasKit(): Promise<void> {
  if (Platform.OS !== 'web') return;

  try {
    const start = Date.now();
    const { LoadSkiaWeb } = await import('@shopify/react-native-skia/lib/module/web');
    await LoadSkiaWeb({
      locateFile: (file: string) => `${CANVASKIT_CDN}/${file}`,
    });
    preloadLog.info(`CanvasKit WASM preloaded in ${Date.now() - start}ms`);
  } catch (err) {
    // Non-fatal: individual Loaders will retry on demand
    preloadLog.warn('CanvasKit preload failed (non-fatal):', err);
  }
}
