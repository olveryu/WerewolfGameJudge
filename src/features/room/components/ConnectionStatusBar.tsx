/**
 * ConnectionStatusBar — banner for every non-live link status (memoized).
 *
 * - connecting / syncing: sliding indeterminate bar.
 * - waiting(backoff): countdown to the next attempt + 「立即重连」.
 * - waiting(offline | hidden): explains what the link is waiting for.
 * - closed: terminal reason copy (the entry boundary offers re-entry; this bar only informs).
 * - live with pending durable commands: 「正在确认提交结果」.
 * Returns null when live with nothing pending.
 */
import type React from 'react';
import { memo, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { IndeterminateProgressBar } from '@/components/IndeterminateProgressBar';
import { getLinkCloseMessage } from '@/features/room/model/linkCloseMessages';
import type { LinkStatus } from '@/platform/realtime/types';
import { TESTIDS } from '@/testids';

import { type ConnectionStatusBarStyles } from './styles';

interface ConnectionStatusBarProps {
  readonly status: LinkStatus;
  /** Durable commands retained until the Worker returns a decision. */
  readonly pendingDurableCount: number;
  /** Reconnect immediately; only meaningful while `status.kind === 'waiting'`. */
  readonly onRetryNow: () => void;
  readonly styles: ConnectionStatusBarStyles;
  /** Injected clock for deterministic countdown tests. */
  readonly now?: () => number;
}

const COUNTDOWN_TICK_MS = 250;

/** Seconds until `atMs`, never below 1 so the copy never reads 「0 秒后」. */
function secondsUntil(atMs: number, nowMs: number): number {
  return Math.max(1, Math.ceil((atMs - nowMs) / 1000));
}

function useCountdown(atMs: number | null, now: () => number): number | null {
  const [seconds, setSeconds] = useState<number | null>(
    atMs === null ? null : secondsUntil(atMs, now()),
  );
  useEffect(() => {
    if (atMs === null) {
      setSeconds(null);
      return;
    }
    setSeconds(secondsUntil(atMs, now()));
    const timer = setInterval(() => setSeconds(secondsUntil(atMs, now())), COUNTDOWN_TICK_MS);
    return () => clearInterval(timer);
  }, [atMs, now]);
  return seconds;
}

function describe(
  status: LinkStatus,
  pendingDurableCount: number,
  countdown: number | null,
): string {
  const hasPending = pendingDurableCount > 0;
  switch (status.kind) {
    case 'live':
      return '正在确认提交结果';
    case 'idle':
    case 'connecting':
    case 'syncing':
      return hasPending ? '行动已保存，连接后将自动确认' : '正在连接房间';
    case 'waiting':
      if (status.cause === 'offline') return '网络已断开，恢复后自动重连';
      if (status.cause === 'hidden') return '应用在后台，返回后自动重连';
      return countdown === null ? '连接断开，正在重连' : `连接断开，${countdown} 秒后重试`;
    case 'closed':
      return getLinkCloseMessage(status.reason);
  }
}

const ConnectionStatusBarComponent: React.FC<ConnectionStatusBarProps> = ({
  status,
  pendingDurableCount,
  onRetryNow,
  styles,
  now = Date.now,
}) => {
  const retryAtMs = status.kind === 'waiting' ? status.nextRetryAtMs : null;
  const countdown = useCountdown(retryAtMs, now);

  const isLive = status.kind === 'live';
  const shouldShow = !isLive || pendingDurableCount > 0;
  const isAnimating = status.kind === 'connecting' || status.kind === 'syncing' || isLive;

  if (!shouldShow) return null;

  if (status.kind === 'waiting') {
    return (
      <View style={styles.container} testID={TESTIDS.connectionStatusContainer}>
        <View style={styles.failedRow}>
          <Text style={styles.text}>{describe(status, pendingDurableCount, countdown)}</Text>
          <Pressable
            onPress={onRetryNow}
            style={styles.reconnectButton}
            testID={TESTIDS.connectionRetryNowButton}
          >
            <Text style={styles.reconnectText}>立即重连</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View
      style={styles.container}
      testID={isLive ? TESTIDS.connectionPendingContainer : TESTIDS.connectionStatusContainer}
    >
      <Text style={styles.text}>{describe(status, pendingDurableCount, countdown)}</Text>
      {isAnimating && (
        <IndeterminateProgressBar style={styles.progressBarTrack} barStyle={styles.progressBar} />
      )}
    </View>
  );
};

export const ConnectionStatusBar = memo(ConnectionStatusBarComponent);

ConnectionStatusBar.displayName = 'ConnectionStatusBar';
