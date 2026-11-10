import './CenterDialog.css';
import './DebugPanel.css';

import { Dialog } from '@ark-ui/react/dialog';
import { Portal } from '@ark-ui/react/portal';
import { useEffect, useState, useSyncExternalStore } from 'react';

import { type DebugLogEntry, debugLogStore } from '@/utils/debugLogStore';
import { handleError } from '@/utils/errorPipeline';
import { log } from '@/utils/logger';
import IconCheckmarkCircle from '~icons/ion/checkmark-circle';
import IconClose from '~icons/ion/close';
import IconCopyOutline from '~icons/ion/copy-outline';
import IconTrashOutline from '~icons/ion/trash-outline';

const debugPanelLog = log.extend('DebugPanel');

const COPY_FEEDBACK_MS = 1200;

type LevelFilter = 'all' | 'error' | 'warn' | 'debug';

const LEVEL_FILTERS: readonly { readonly key: LevelFilter; readonly label: string }[] = [
  { key: 'all', label: 'ALL' },
  { key: 'error', label: 'ERR' },
  { key: 'warn', label: 'WRN' },
  { key: 'debug', label: 'DBG' },
];

const LEVEL_BADGES: Partial<Record<DebugLogEntry['level'], string>> = {
  error: 'ERR',
  warn: 'WRN',
  debug: 'DBG',
};

function formatTimestamp(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  const milliseconds = date.getMilliseconds().toString().padStart(3, '0');
  return `${hours}:${minutes}:${seconds}.${milliseconds}`;
}

function filterLogs(
  logs: readonly DebugLogEntry[],
  levelFilter: LevelFilter,
  searchText: string,
): readonly DebugLogEntry[] {
  const query = searchText.toLowerCase();
  return logs.filter(
    (entry) =>
      (levelFilter === 'all' || entry.level === levelFilter) &&
      (query === '' || entry.message.toLowerCase().includes(query)),
  );
}

function LogRow({ entry }: { entry: DebugLogEntry }) {
  const badge = LEVEL_BADGES[entry.level];
  return (
    <li className="debug-panel-row">
      <span className="debug-panel-time">{formatTimestamp(entry.timestamp)}</span>
      {badge !== undefined && (
        <span className="debug-panel-badge" data-level={entry.level}>
          {badge}
        </span>
      )}
      <span className="debug-panel-message" data-level={entry.level}>
        {entry.message}
      </span>
    </li>
  );
}

/**
 * The on-screen debug log viewer, opened by the room title's admin long press: level filter,
 * text search, copy all and clear. Dark, so it reads apart from the game UI.
 */
export function DebugPanel() {
  const { logs, visible } = useSyncExternalStore(
    debugLogStore.subscribe,
    debugLogStore.getSnapshot,
  );
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [copied, setCopied] = useState(false);
  const filteredLogs = filterLogs(logs, levelFilter, searchText);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copyLogs = async () => {
    const text = logs
      .map(
        (entry) =>
          `[${formatTimestamp(entry.timestamp)}] [${entry.level.toUpperCase()}] ${entry.message}`,
      )
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (error: unknown) {
      handleError(error, { label: '复制日志', logger: debugPanelLog, feedback: 'toast' });
    }
  };

  return (
    <Dialog.Root
      open={visible}
      onOpenChange={(details) => {
        if (!details.open) debugLogStore.setVisible(false);
      }}
      lazyMount
      unmountOnExit
    >
      <Portal>
        <Dialog.Backdrop className="center-dialog-backdrop" />
        <Dialog.Positioner className="center-dialog-positioner">
          <Dialog.Content className="debug-panel">
            <div className="debug-panel-toolbar">
              <Dialog.Title className="debug-panel-title">Debug Console</Dialog.Title>
              <button
                type="button"
                className="debug-panel-tool"
                aria-label={copied ? '已复制日志' : '复制日志'}
                onClick={() => void copyLogs()}
              >
                {copied ? <IconCheckmarkCircle aria-hidden /> : <IconCopyOutline aria-hidden />}
              </button>
              <button
                type="button"
                className="debug-panel-tool"
                aria-label="清空日志"
                onClick={() => debugLogStore.clear()}
              >
                <IconTrashOutline aria-hidden />
              </button>
              <Dialog.CloseTrigger className="debug-panel-tool" aria-label="关闭">
                <IconClose aria-hidden />
              </Dialog.CloseTrigger>
            </div>
            <div className="debug-panel-filters" role="group" aria-label="日志级别">
              {LEVEL_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className="debug-panel-chip"
                  data-level={filter.key}
                  aria-pressed={levelFilter === filter.key}
                  onClick={() => setLevelFilter(filter.key)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <input
              type="search"
              className="debug-panel-search"
              placeholder="搜索日志..."
              aria-label="搜索日志"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
            <ol className="debug-panel-list">
              {filteredLogs.map((entry) => (
                <LogRow key={entry.id} entry={entry} />
              ))}
            </ol>
            <p className="debug-panel-footer">{`${filteredLogs.length} / ${logs.length} 条`}</p>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}
