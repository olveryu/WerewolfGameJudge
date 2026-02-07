/**
 * Mobile Debug Panel - shows logs on-screen for iOS Safari debugging
 * where console.log is not easily accessible.
 *
 * Usage:
 *   import { mobileDebug } from '@/utils/mobileDebug';
 *   mobileDebug.log('message');
 *   mobileDebug.show(); // Show the debug panel
 *   mobileDebug.hide(); // Hide the debug panel
 */

import { Platform } from 'react-native';

interface LogEntry {
  timestamp: Date;
  message: string;
  level: 'log' | 'warn' | 'error' | 'debug';
}

const MAX_LOGS = 100;
let logs: LogEntry[] = [];
let panelElement: HTMLDivElement | null = null;
let isVisible = false;

function getTimestamp(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

function createPanel(): HTMLDivElement {
  if (panelElement) return panelElement;

  const panel = document.createElement('div');
  panel.id = 'mobile-debug-panel';
  panel.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: 200px;
    background: rgba(0, 0, 0, 0.9);
    color: #00ff00;
    font-family: monospace;
    font-size: 10px;
    overflow-y: auto;
    z-index: 99999;
    padding: 8px;
    box-sizing: border-box;
    pointer-events: auto;
  `;

  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ Close';
  closeBtn.style.cssText = `
    position: absolute;
    top: 4px;
    right: 4px;
    background: #333;
    color: #fff;
    border: none;
    padding: 4px 8px;
    font-size: 10px;
    cursor: pointer;
    z-index: 100000;
  `;
  closeBtn.onclick = () => mobileDebug.hide();
  panel.appendChild(closeBtn);

  // Add clear button
  const clearBtn = document.createElement('button');
  clearBtn.textContent = 'Clear';
  clearBtn.style.cssText = `
    position: absolute;
    top: 4px;
    right: 60px;
    background: #333;
    color: #fff;
    border: none;
    padding: 4px 8px;
    font-size: 10px;
    cursor: pointer;
    z-index: 100000;
  `;
  clearBtn.onclick = () => mobileDebug.clear();
  panel.appendChild(clearBtn);

  // Add log container
  const logContainer = document.createElement('div');
  logContainer.id = 'mobile-debug-logs';
  logContainer.style.cssText = `
    margin-top: 24px;
    white-space: pre-wrap;
    word-break: break-all;
  `;
  panel.appendChild(logContainer);

  document.body.appendChild(panel);
  panelElement = panel;
  return panel;
}

function updatePanel(): void {
  if (!panelElement || !isVisible) return;

  const logContainer = panelElement.querySelector('#mobile-debug-logs');
  if (!logContainer) return;

  const html = logs
    .map((entry) => {
      const color =
        entry.level === 'error'
          ? '#ff4444'
          : entry.level === 'warn'
            ? '#ffaa00'
            : entry.level === 'debug'
              ? '#888888'
              : '#00ff00';
      return `<div style="color: ${color}">[${getTimestamp(entry.timestamp)}] ${entry.message}</div>`;
    })
    .join('');

  logContainer.innerHTML = html;

  // Auto-scroll to bottom
  panelElement.scrollTop = panelElement.scrollHeight;
}

function addLog(message: string, level: LogEntry['level'] = 'log', silent = false): void {
  const entry: LogEntry = {
    timestamp: new Date(),
    message: String(message),
    level,
  };

  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs = logs.slice(-MAX_LOGS);
  }

  // Also log to console (skip when called from logger transport to avoid double-logging)
  if (!silent) {
    console[level === 'debug' ? 'log' : level]('[MobileDebug]', message);
  }

  updatePanel();
}

/**
 * react-native-logs transport that forwards all logger output to the mobile debug panel.
 * This allows every logger extension (Audio, Host, NightFlow, etc.) to appear in the
 * on-screen debug panel automatically, without manual mobileDebug.log() calls.
 *
 * Skips console output (silent=true) because consoleTransport already handles that.
 */
export const mobileDebugTransport = (props: {
  msg: string;
  rawMsg: unknown;
  level: { severity: number; text: string };
  extension?: string | null;
}): void => {
  if (Platform.OS !== 'web') return;

  const levelMap: Record<string, LogEntry['level']> = {
    debug: 'debug',
    info: 'log',
    warn: 'warn',
    error: 'error',
  };
  const level = levelMap[props.level.text] ?? 'log';
  const prefix = props.extension ? `[${props.extension}] ` : '';
  const message = `${prefix}${props.msg}`;

  addLog(message, level, true);
};

export const mobileDebug = {
  log: (message: string) => {
    if (Platform.OS !== 'web') return;
    addLog(message, 'log');
  },

  warn: (message: string) => {
    if (Platform.OS !== 'web') return;
    addLog(message, 'warn');
  },

  error: (message: string) => {
    if (Platform.OS !== 'web') return;
    addLog(message, 'error');
  },

  debug: (message: string) => {
    if (Platform.OS !== 'web') return;
    addLog(message, 'debug');
  },

  show: () => {
    if (Platform.OS !== 'web') return;
    isVisible = true;
    createPanel();
    if (panelElement) {
      panelElement.style.display = 'block';
    }
    updatePanel();
  },

  hide: () => {
    if (Platform.OS !== 'web') return;
    isVisible = false;
    if (panelElement) {
      panelElement.style.display = 'none';
    }
  },

  toggle: () => {
    if (isVisible) {
      mobileDebug.hide();
    } else {
      mobileDebug.show();
    }
  },

  clear: () => {
    logs = [];
    updatePanel();
  },

  isVisible: () => isVisible,
};

export default mobileDebug;
