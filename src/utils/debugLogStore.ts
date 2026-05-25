/**
 * debugLogStore — External store for debug log entries
 *
 * Provides `useSyncExternalStore`-compatible subscribe/getSnapshot API.
 * Module-level state — works before React mounts (transport writes arrive early).
 * No React, no service, no game state imports.
 */

export interface DebugLogEntry {
  timestamp: Date;
  message: string;
  level: 'log' | 'warn' | 'error' | 'debug';
}

const MAX_LOGS = 500;

// ── Module state ────────────────────────────────────────────────────────────

let logs: readonly DebugLogEntry[] = [];
let visible = false;
let version = 0;

interface DebugLogSnapshot {
  logs: readonly DebugLogEntry[];
  visible: boolean;
  version: number;
}

let snapshot: DebugLogSnapshot = { logs, visible, version };

const listeners = new Set<() => void>();

function emitChange(): void {
  version += 1;
  snapshot = { logs, visible, version };
  for (const listener of listeners) {
    listener();
  }
}

// ── Public API ──────────────────────────────────────────────────────────────
/** Debug 日志外部 store，兼容 useSyncExternalStore 的 subscribe/getSnapshot API。 */ export const debugLogStore =
  {
    /** useSyncExternalStore subscribe */
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** useSyncExternalStore getSnapshot */
    getSnapshot(): DebugLogSnapshot {
      return snapshot;
    },

    addLog(message: string, level: DebugLogEntry['level']): void {
      const entry: DebugLogEntry = {
        timestamp: new Date(),
        message,
        level,
      };

      const next = [...logs, entry];
      logs = next.length > MAX_LOGS ? next.slice(-MAX_LOGS) : next;
      emitChange();
    },

    clear(): void {
      logs = [];
      emitChange();
    },

    setVisible(v: boolean): void {
      if (visible === v) return;
      visible = v;
      emitChange();
    },

    getVisible(): boolean {
      return visible;
    },
  } as const;
