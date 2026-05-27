/**
 * logger - Platform-agnostic logger abstraction for game-engine
 *
 * Provides a minimal Logger interface and injection functions.
 * Client injects a react-native-logs instance; server injects a console wrapper.
 * No platform imports (react-native-logs, etc.); only defines the interface and inject/get methods.
 */

/**
 * Minimal Logger interface, compatible with the return value of react-native-logs createLogger.
 * Declares only the methods actually used within the engine.
 */
export interface EngineLogger {
  debug(...args: unknown[]): void;
  info(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
  extend(name: string): EngineLogger;
}

/** Default noop logger — neither drops logs nor throws */
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
 * Inject the root logger. Call once at app startup or server initialization.
 *
 * @example
 * // React Native client
 * import { log } from '@/utils/logger';
 * import { setEngineLogger } from '@werewolf/game-engine';
 * setEngineLogger(log);
 *
 * // Cloudflare Worker server
 * setEngineLogger(consoleLogger);
 */
export function setEngineLogger(logger: EngineLogger): void {
  _root = logger;
}

/** Get the root logger */
export function getEngineLogger(): EngineLogger {
  return _root;
}
