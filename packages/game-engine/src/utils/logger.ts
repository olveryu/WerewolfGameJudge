/**
 * logger - Platform-agnostic logger abstraction for game-engine
 *
 * 提供最小化的 Logger 接口 + 注入函数。
 * 客户端注入 react-native-logs 实例；服务端注入 console wrapper。
 * 不 import 平台依赖（react-native-logs 等），仅定义接口与注入/获取方法。
 */

/**
 * 最小化 Logger 接口，与 react-native-logs createLogger 返回值兼容。
 * 只声明 engine 内实际使用的方法。
 */
export interface EngineLogger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  extend(name: string): EngineLogger;
}

/** 默认 noop logger — 不丢失日志也不崩溃 */
const noopFn = (): void => {};
const noopLogger: EngineLogger = {
  debug: noopFn,
  info: noopFn,
  warn: noopFn,
  error: noopFn,
  extend: () => noopLogger,
};

let _root: EngineLogger = noopLogger;

/**
 * 注入根 logger。App 启动 / 服务端初始化时调用一次。
 *
 * @example
 * // React Native 客户端
 * import { log } from '@/utils/logger';
 * import { setEngineLogger } from '@werewolf/game-engine';
 * setEngineLogger(log);
 *
 * // Vercel 服务端
 * setEngineLogger(consoleLogger);
 */
export function setEngineLogger(logger: EngineLogger): void {
  _root = logger;
}

/** 获取根 logger */
export function getEngineLogger(): EngineLogger {
  return _root;
}
