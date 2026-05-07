/**
 * DebugPanel — On-screen debug log viewer (React Native Modal)
 *
 * Replaces the DOM-based mobileDebug panel with a proper RN component.
 * Subscribes to debugLogStore via useSyncExternalStore.
 * Dark theme overlay — visually distinct from game UI.
 *
 * Features:
 * - Level filter (ALL / ERR / WRN / DBG)
 * - Text search across log messages
 * - Copy all logs to clipboard
 * - Clear logs
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { memo, useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';

import { Modal } from '@/components/AppModal';
import { PressableScale } from '@/components/PressableScale';
import { borderRadius, spacing, typography } from '@/theme';
import { type DebugLogEntry, debugLogStore } from '@/utils/debugLogStore';

// ── Dark theme palette (intentionally separate from app theme) ──────────────

const dk = {
  overlay: 'rgba(0, 0, 0, 0.6)',
  cardBg: 'rgba(22, 22, 26, 0.98)',
  toolbarBg: 'rgba(255, 255, 255, 0.04)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderSubtle: 'rgba(255, 255, 255, 0.03)',
  chipBg: 'rgba(255, 255, 255, 0.08)',
  btnBg: 'rgba(255, 255, 255, 0.12)',
  inputBg: 'rgba(255, 255, 255, 0.06)',
  textPrimary: '#e0e0e0',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  textDim: '#4b5563',
  textIcon: '#ccc',
  textIconDim: '#999',
  textWhite: '#fff',
  logDefault: '#a5f3fc',
  logError: '#f87171',
  logWarn: '#fbbf24',
  logDebug: '#6b7280',
  badgeErrBg: '#7f1d1d',
  badgeErrFg: '#fca5a5',
  badgeWarnBg: '#78350f',
  badgeWarnFg: '#fde68a',
  badgeDbgBg: '#1f2937',
  badgeDbgFg: '#9ca3af',
} as const;

// ── Constants ───────────────────────────────────────────────────────────────

type LevelFilter = 'all' | 'error' | 'warn' | 'debug';

const LEVEL_FILTERS: ReadonlyArray<{ key: LevelFilter; label: string; color: string }> = [
  { key: 'all', label: 'ALL', color: dk.textSecondary },
  { key: 'error', label: 'ERR', color: dk.logError },
  { key: 'warn', label: 'WRN', color: dk.logWarn },
  { key: 'debug', label: 'DBG', color: dk.logDebug },
] as const;

const LEVEL_COLORS: Record<DebugLogEntry['level'], string> = {
  error: dk.logError,
  warn: dk.logWarn,
  debug: dk.logDebug,
  log: dk.logDefault,
};

const BADGE_STYLES: Partial<Record<DebugLogEntry['level'], { bg: string; fg: string }>> = {
  error: { bg: dk.badgeErrBg, fg: dk.badgeErrFg },
  warn: { bg: dk.badgeWarnBg, fg: dk.badgeWarnFg },
  debug: { bg: dk.badgeDbgBg, fg: dk.badgeDbgFg },
};

// ── Store selectors (arrow wrappers avoid unbound-method lint) ──────────────

const subscribe = (cb: () => void) => debugLogStore.subscribe(cb);
const getSnapshot = () => debugLogStore.getSnapshot();

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  const s = date.getSeconds().toString().padStart(2, '0');
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

// ── Log row ─────────────────────────────────────────────────────────────────

interface LogRowProps {
  entry: DebugLogEntry;
}

const LogRow: React.FC<LogRowProps> = memo(({ entry }) => {
  const badge = BADGE_STYLES[entry.level];
  return (
    <View style={styles.logRow}>
      <Text style={styles.timestamp}>{formatTimestamp(entry.timestamp)}</Text>
      {badge && (
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.fg }]}>
            {entry.level === 'error' ? 'ERR' : entry.level === 'warn' ? 'WRN' : 'DBG'}
          </Text>
        </View>
      )}
      <Text style={[styles.logMessage, { color: LEVEL_COLORS[entry.level] }]}>{entry.message}</Text>
    </View>
  );
});
LogRow.displayName = 'LogRow';

// ── Main component ─────────────────────────────────────────────────────────

const DebugPanelComponent: React.FC = () => {
  const { logs, visible } = useSyncExternalStore(subscribe, getSnapshot);

  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [searchText, setSearchText] = useState('');
  const [copyFeedback, setCopyFeedback] = useState(false);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (levelFilter !== 'all') {
      result = result.filter((entry) => entry.level === levelFilter);
    }
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter((entry) => entry.message.toLowerCase().includes(lower));
    }
    return result;
  }, [logs, levelFilter, searchText]);

  const handleClose = useCallback(() => {
    debugLogStore.setVisible(false);
  }, []);

  const handleClear = useCallback(() => {
    debugLogStore.clear();
  }, []);

  const handleCopy = useCallback(async () => {
    const text = logs
      .map((e) => `[${formatTimestamp(e.timestamp)}] [${e.level.toUpperCase()}] ${e.message}`)
      .join('\n');
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    }
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 1200);
  }, [logs]);

  const renderItem = useCallback(
    ({ item }: { item: DebugLogEntry }) => <LogRow entry={item} />,
    [],
  );

  const keyExtractor = useCallback((_: DebugLogEntry, index: number) => String(index), []);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <PressableScale style={styles.overlay} onPress={handleClose}>
        <PressableScale
          style={styles.card}
          onPress={() => {
            /* prevent close on card tap */
          }}
        >
          {/* Toolbar */}
          <View style={styles.toolbar}>
            <Text style={styles.title}>Debug Console</Text>
            <PressableScale style={styles.toolBtn} onPress={() => void handleCopy()}>
              <Ionicons
                name={copyFeedback ? 'checkmark-circle' : 'copy-outline'}
                size={14}
                color={dk.textIcon}
              />
            </PressableScale>
            <PressableScale style={styles.toolBtn} onPress={handleClear}>
              <Ionicons name="trash-outline" size={14} color={dk.textIcon} />
            </PressableScale>
            <PressableScale style={styles.toolBtn} onPress={handleClose}>
              <Ionicons name="close" size={16} color={dk.textIconDim} />
            </PressableScale>
          </View>

          {/* Level filter chips */}
          <View style={styles.filterRow}>
            {LEVEL_FILTERS.map((f) => (
              <PressableScale
                key={f.key}
                style={[styles.filterChip, levelFilter === f.key && { backgroundColor: f.color }]}
                onPress={() => setLevelFilter(f.key)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    levelFilter === f.key && styles.filterChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </PressableScale>
            ))}
          </View>

          {/* Search */}
          <TextInput
            style={styles.searchInput}
            placeholder="搜索日志..."
            placeholderTextColor={dk.textMuted}
            value={searchText}
            onChangeText={setSearchText}
          />

          {/* Log list */}
          <FlatList
            data={filteredLogs}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            style={styles.logList}
            contentContainerStyle={styles.logListContent}
            inverted={false}
            initialNumToRender={50}
            maxToRenderPerBatch={30}
          />

          {/* Footer count */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {filteredLogs.length} / {logs.length} 条
            </Text>
          </View>
        </PressableScale>
      </PressableScale>
    </Modal>
  );
};

export const DebugPanel = memo(DebugPanelComponent);

// ── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: dk.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: '92%',
    maxWidth: 600,
    height: '80%',
    maxHeight: 700,
    backgroundColor: dk.cardBg,
    borderRadius: borderRadius.large,
    overflow: 'hidden',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.small,
    backgroundColor: dk.toolbarBg,
    borderBottomWidth: 1,
    borderBottomColor: dk.border,
  },
  title: {
    flex: 1,
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
    color: dk.textSecondary,
  },
  toolBtn: {
    padding: spacing.tight,
    borderRadius: borderRadius.small,
    backgroundColor: dk.btnBg,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.tight,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.tight,
  },
  filterChip: {
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
    borderRadius: borderRadius.full,
    backgroundColor: dk.chipBg,
  },
  filterChipText: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.semibold,
    color: dk.textSecondary,
  },
  filterChipTextActive: {
    color: dk.textWhite,
  },
  searchInput: {
    marginHorizontal: spacing.medium,
    marginBottom: spacing.tight,
    height: 32,
    borderRadius: borderRadius.small,
    backgroundColor: dk.inputBg,
    paddingHorizontal: spacing.small,
    fontSize: typography.captionSmall,
    color: dk.textPrimary,
  },
  logList: {
    flex: 1,
  },
  logListContent: {
    paddingHorizontal: spacing.medium,
    paddingBottom: spacing.small,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.micro,
    borderBottomWidth: 1,
    borderBottomColor: dk.borderSubtle,
    gap: spacing.tight,
  },
  timestamp: {
    fontSize: typography.captionSmall,
    color: dk.textDim,
    fontWeight: typography.weights.medium,
  },
  badge: {
    paddingHorizontal: 3,
    borderRadius: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
  },
  logMessage: {
    flex: 1,
    fontSize: typography.captionSmall,
  },
  footer: {
    paddingVertical: spacing.tight,
    paddingHorizontal: spacing.medium,
    borderTopWidth: 1,
    borderTopColor: dk.border,
  },
  footerText: {
    fontSize: typography.captionSmall,
    color: dk.textMuted,
    textAlign: 'right',
  },
});
