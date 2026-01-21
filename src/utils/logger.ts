/**
 * Unified logger using react-native-logs
 *
 * Usage:
 *   import { log } from '../utils/logger';
 *   log.info('Host', 'Seat action', { seat: 1 });
 *
 * Or with extensions:
 *   const hostLog = log.extend('Host');
 *   hostLog.info('Seat action', { seat: 1 });
 */

import { logger, consoleTransport } from 'react-native-logs';

const config = {
  transport: consoleTransport,
  severity: __DEV__ ? 'debug' : 'warn',
  transportOptions: {
    colors: {
      debug: 'white',
      info: 'blueBright',
      warn: 'yellowBright',
      error: 'redBright',
    } as const,
  },
} as const;

export const log = logger.createLogger(config);

// Pre-configured extensions for common modules
export const hostLog = log.extend('Host');
export const playerLog = log.extend('Player');
export const nightFlowLog = log.extend('NightFlow');
export const broadcastLog = log.extend('Broadcast');
export const audioLog = log.extend('Audio');
export const authLog = log.extend('Auth');
export const roomLog = log.extend('Room');
export const gameRoomLog = log.extend('GameRoom');
export const configLog = log.extend('Config');
export const roomScreenLog = log.extend('RoomScreen');
export const homeLog = log.extend('Home');
export const v2FacadeLog = log.extend('V2Facade');
