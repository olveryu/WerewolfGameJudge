/** react-native-logs transport that writes to the on-screen debug log store. */

import type { ConsoleTransportOptions, transportFunctionType } from 'react-native-logs';

import { type DebugLogEntry, debugLogStore } from './debugLogStore';

function parseDebugLogLevel(level: string): DebugLogEntry['level'] {
  switch (level) {
    case 'debug':
      return 'debug';
    case 'info':
      return 'log';
    case 'warn':
      return 'warn';
    case 'error':
      return 'error';
    default:
      throw new Error(`[FAIL-FAST] Unsupported logger level: ${level}`);
  }
}

export const debugLogTransport: transportFunctionType<ConsoleTransportOptions> = (props) => {
  const prefix = props.extension ? `[${props.extension}] ` : '';
  debugLogStore.addLog(`${prefix}${props.msg}`, parseDebugLogLevel(props.level.text));
};
