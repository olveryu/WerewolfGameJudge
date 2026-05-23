/**
 * ConnectionStatusBar - 断线横幅 + indeterminate 进度条 / 手动重连按钮（Memoized）
 *
 * 非 Live 状态时显示 "连接断开，正在重连…" 及底部滑动进度条。
 * Failed 状态（自动重试耗尽）显示 "连接失败" + "点击重连" 按钮。
 * 社区标准做法：indeterminate progress bar（类似 Slack/Discord）表示持续重连中。
 */
import type React from 'react';
import { memo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { registerKeyframes } from '@/components/seatAnimations/cssAnimations';
import { ConnectionStatus } from '@/services/types/IGameFacade';
import { TESTIDS } from '@/testids';

import { type ConnectionStatusBarStyles } from './styles';

registerKeyframes(
  'indeterminateSlide',
  'from{transform:translateX(-100%)}to{transform:translateX(333%)}',
);

interface ConnectionStatusBarProps {
  /** Current connection state */
  status: ConnectionStatus;
  /** Trigger manual reconnect (from facade) */
  onManualReconnect: () => void;
  /** Pre-created styles from parent */
  styles: ConnectionStatusBarStyles;
}

/** Width of the sliding bar relative to container width */
const BAR_WIDTH_RATIO = 0.3;
/** Full cycle duration for the sliding animation */
const ANIMATION_DURATION_MS = 1_500;

/**
 * Disconnection banner with indeterminate progress bar or manual reconnect.
 *
 * Uses `onLayout` to measure container width, then applies a CSS keyframe
 * animation to slide the bar from off-screen left to off-screen right.
 * The container's `overflow: 'hidden'` clips the bar at rounded corners.
 * Returns null when connection is Live.
 */
const ConnectionStatusBarComponent: React.FC<ConnectionStatusBarProps> = ({
  status,
  onManualReconnect,
  styles,
}) => {
  const [containerWidth, setContainerWidth] = useState(0);

  const isDisconnected = status !== ConnectionStatus.Live;
  const isFailed = status === ConnectionStatus.Failed;

  const barPixelWidth = containerWidth * BAR_WIDTH_RATIO;

  const progressBarStyle =
    containerWidth > 0 && isDisconnected && !isFailed
      ? {
          width: barPixelWidth,
          animationName: 'indeterminateSlide',
          animationDuration: `${ANIMATION_DURATION_MS}ms`,
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
        }
      : { width: barPixelWidth };

  if (!isDisconnected) return null;

  // Failed state: manual reconnect button (auto-retry exhausted)
  if (isFailed) {
    return (
      <View style={styles.container} testID={TESTIDS.connectionStatusContainer}>
        <View style={styles.failedRow}>
          <Text style={styles.text}>连接失败</Text>
          <Pressable onPress={onManualReconnect} style={styles.reconnectButton}>
            <Text style={styles.reconnectText}>点击重连</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // Reconnecting state: progress bar animation
  return (
    <View
      style={styles.container}
      testID={TESTIDS.connectionStatusContainer}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Text style={styles.text}>连接断开，正在重连</Text>
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBar, progressBarStyle]} />
      </View>
    </View>
  );
};

export const ConnectionStatusBar = memo(ConnectionStatusBarComponent);

ConnectionStatusBar.displayName = 'ConnectionStatusBar';
