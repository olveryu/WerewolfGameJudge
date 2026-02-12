/**
 * logger - Unified logging module using react-native-logs
 *
 * 全项目统一日志入口，提供命名 logger 实例。
 *
 * Usage:
 *   import { log } from '@/utils/logger';
 *   log.info('Host', 'Seat action', { seat: 1 });
 *
 * Or with extensions:
 *   const hostLog = log.extend('Host');
 *   hostLog.info('Seat action', { seat: 1 });
 *
 * ✅ 允许：创建命名 logger、配置 transport/severity
 * ❌ 禁止：import React / service / 游戏状态
 */

import { consoleTransport, logger } from 'react-native-logs';

import { mobileDebugTransport } from './mobileDebug';

/**
 * Wraps a transport so it only receives messages at or above `minSeverity`.
 * react-native-logs applies severity globally before transports, so we set
 * global severity to 'debug' and use this wrapper to keep consoleTransport
 * quiet in production while mobileDebugTransport sees everything.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const withMinSeverity = <T extends (...args: any[]) => any>(minSeverity: number, inner: T): T => {
  return ((props: { level: { severity: number } }) => {
    if (props.level.severity >= minSeverity) {
      inner(props);
    }
  }) as unknown as T;
};

// severity levels: debug=0, info=1, warn=2, error=3
const WARN_SEVERITY = 2;

const config = {
  transport: [
    // In dev: console shows everything; in prod: console shows warn+ only
    __DEV__ ? consoleTransport : withMinSeverity(WARN_SEVERITY, consoleTransport),
    // Debug panel always receives all levels
    mobileDebugTransport,
  ],
  // Global minimum = debug so mobileDebugTransport can receive everything
  severity: 'debug' as const,
  transportOptions: {
    colors: {
      debug: 'white',
      info: 'blueBright',
      warn: 'yellowBright',
      error: 'redBright',
    } as const,
  },
};

export const log = logger.createLogger(config);

// Pre-configured extensions for common modules
export const nightFlowLog = log.extend('NightFlow');
export const broadcastLog = log.extend('Broadcast');
export const audioLog = log.extend('Audio');
export const authLog = log.extend('Auth');
export const roomLog = log.extend('Room');
export const gameRoomLog = log.extend('GameRoom');
export const configLog = log.extend('Config');
export const roomScreenLog = log.extend('RoomScreen');
export const homeLog = log.extend('Home');
export const facadeLog = log.extend('Facade');
