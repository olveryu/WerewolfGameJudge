/**
 * mobileDebug - Mobile Debug Panel for on-screen logging
 *
 * Shows logs on-screen for iOS Safari debugging
 * where console.log is not easily accessible.
 *
 * Usage:
 *   import { mobileDebug } from '@/utils/mobileDebug';
 *   mobileDebug.log('message');
 *   mobileDebug.show(); // Show the debug panel
 *   mobileDebug.hide(); // Hide the debug panel
 *
 * ✅ 允许：on-screen 日志显示、transport 接口
 * ❌ 禁止：import React 组件 / service / 游戏状态
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

const TOOLBAR_BTN = `
  background: rgba(255,255,255,0.12);
  color: #ccc;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 4px;
  padding: 3px 10px;
  font-size: 11px;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  cursor: pointer;
  line-height: 1.4;
`;

function createPanel(): HTMLDivElement {
  if (panelElement) return panelElement;

  // ── Full-screen modal overlay ──
  const panel = document.createElement('div');
  panel.id = 'mobile-debug-panel';
  panel.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
  `;

  // Click backdrop to close
  panel.addEventListener('click', (e) => {
    if (e.target === panel) mobileDebug.hide();
  });

  // ── Modal card ──
  const card = document.createElement('div');
  card.style.cssText = `
    width: 92%;
    max-width: 600px;
    height: 80%;
    max-height: 700px;
    background: rgba(22, 22, 26, 0.98);
    border-radius: 12px;
    color: #e0e0e0;
    font-family: 'SF Mono', 'Menlo', 'Consolas', monospace;
    font-size: 11px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0,0,0,0.5);
    border: 1px solid rgba(255,255,255,0.1);
  `;
  panel.appendChild(card);

  // ── Toolbar ──
  const toolbar = document.createElement('div');
  toolbar.style.cssText = `
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    background: rgba(255,255,255,0.04);
    border-bottom: 1px solid rgba(255,255,255,0.08);
    flex-shrink: 0;
  `;

  // Title
  const title = document.createElement('span');
  title.textContent = '🔍 Debug Console';
  title.style.cssText = `
    font-size: 13px;
    font-weight: 600;
    color: #9ca3af;
    font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    margin-right: auto;
  `;
  toolbar.appendChild(title);

  // Copy button
  const copyBtn = document.createElement('button');
  copyBtn.textContent = '📋 Copy';
  copyBtn.style.cssText = TOOLBAR_BTN;
  copyBtn.onclick = () => {
    const text = logs
      .map((e) => `[${getTimestamp(e.timestamp)}] [${e.level.toUpperCase()}] ${e.message}`)
      .join('\n');
    navigator.clipboard.writeText(text).then(
      () => {
        copyBtn.textContent = '✅ Copied';
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy';
        }, 1200);
      },
      () => {
        // Fallback for environments where clipboard API is not available
        copyBtn.textContent = '❌ Failed';
        setTimeout(() => {
          copyBtn.textContent = '📋 Copy';
        }, 1200);
      },
    );
  };
  toolbar.appendChild(copyBtn);

  // Clear button
  const clearBtn = document.createElement('button');
  clearBtn.textContent = '🗑 Clear';
  clearBtn.style.cssText = TOOLBAR_BTN;
  clearBtn.onclick = () => mobileDebug.clear();
  toolbar.appendChild(clearBtn);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = `
    ${TOOLBAR_BTN}
    color: #999;
    padding: 3px 7px;
    font-size: 14px;
  `;
  closeBtn.onclick = () => mobileDebug.hide();
  toolbar.appendChild(closeBtn);

  card.appendChild(toolbar);

  // ── Log container (scrollable — native overflow inside modal) ──
  const logContainer = document.createElement('div');
  logContainer.id = 'mobile-debug-logs';
  logContainer.style.cssText = `
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px 14px;
    white-space: pre-wrap;
    word-break: break-all;
    -webkit-overflow-scrolling: touch;
  `;
  card.appendChild(logContainer);

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
          ? '#f87171'
          : entry.level === 'warn'
            ? '#fbbf24'
            : entry.level === 'debug'
              ? '#6b7280'
              : '#a5f3fc';
      const badge =
        entry.level === 'error'
          ? '<span style="background:#7f1d1d;color:#fca5a5;padding:0 3px;border-radius:2px;font-size:9px;margin-right:4px">ERR</span>'
          : entry.level === 'warn'
            ? '<span style="background:#78350f;color:#fde68a;padding:0 3px;border-radius:2px;font-size:9px;margin-right:4px">WRN</span>'
            : entry.level === 'debug'
              ? '<span style="background:#1f2937;color:#9ca3af;padding:0 3px;border-radius:2px;font-size:9px;margin-right:4px">DBG</span>'
              : '';
      const ts = `<span style="color:#4b5563">${getTimestamp(entry.timestamp)}</span>`;
      return `<div style="color:${color};padding:1px 0;border-bottom:1px solid rgba(255,255,255,0.03)">${ts} ${badge}${entry.message}</div>`;
    })
    .join('');

  logContainer.innerHTML = html;

  // Auto-scroll to bottom — target the scrollable log container, not the panel
  logContainer.scrollTop = logContainer.scrollHeight;
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
      panelElement.style.display = 'flex';
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
