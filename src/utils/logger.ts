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

import { logger, consoleTransport } from 'react-native-logs';
import { mobileDebugTransport } from './mobileDebug';

const config = {
  transport: [consoleTransport, mobileDebugTransport],
  severity: __DEV__ ? 'debug' : ('warn' as const),
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
