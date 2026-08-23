/**
 * ConnectionStatusBar - disconnect banner + indeterminate progress bar / manual reconnect button (memoized)
 *
 * Shows "连接断开，正在重连…" with a sliding bottom progress bar when not in Live state.
 * Failed state (auto-retry exhausted) shows "连接失败" + "点击重连" button.
 * Community-standard approach: indeterminate progress bar (similar to Slack/Discord) indicates ongoing reconnect.
 */
import type React from 'react';
import { memo, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import type { RoomConnectionStatus } from '@/features/room/model/RoomConnection';
import { TESTIDS } from '@/testids';

import { type ConnectionStatusBarStyles } from './styles';

interface ConnectionStatusBarProps {
  /** Current connection state */
  status: RoomConnectionStatus;
  /** Confirmed commands retained until the Worker returns a final decision. */
  pendingCommandCount: number;
  /** Trigger manual reconnect through the shared room entry controller. */
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
 * Uses `onLayout` to measure container width, then loops a Reanimated timing
 * translateX from off-screen left to off-screen right. The container's
 * `overflow: 'hidden'` clips the bar at rounded corners.
 * Returns null when connection is Live.
 */
const ConnectionStatusBarComponent: React.FC<ConnectionStatusBarProps> = ({
  status,
  pendingCommandCount,
  onManualReconnect,
  styles,
}) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const progressValue = useSharedValue(0);

  const isDisconnected = status !== 'live';
  const isFailed = status === 'failed';
  const hasPendingCommand = pendingCommandCount > 0;
  const shouldShowStatus = isDisconnected || hasPendingCommand;

  // Start / stop the sliding animation based on connection status
  // Skip animation for Failed state (no auto-retry happening)
  useEffect(() => {
    if (containerWidth === 0 || !shouldShowStatus || isFailed) {
      cancelAnimation(progressValue);
      progressValue.value = 0;
      return;
    }
    progressValue.value = 0;
    progressValue.value = withRepeat(withTiming(1, { duration: ANIMATION_DURATION_MS }), -1);
    return () => cancelAnimation(progressValue);
  }, [progressValue, containerWidth, shouldShowStatus, isFailed]);

  const barPixelWidth = containerWidth * BAR_WIDTH_RATIO;

  const progressBarStyle = useAnimatedStyle(() => ({
    width: barPixelWidth,
    transform: [
      {
        translateX: interpolate(progressValue.value, [0, 1], [-barPixelWidth, containerWidth]),
      },
    ],
  }));

  if (!shouldShowStatus) return null;

  // Failed state: manual reconnect button (auto-retry exhausted)
  if (isFailed) {
    return (
      <View style={styles.container} testID={TESTIDS.connectionStatusContainer}>
        <View style={styles.failedRow}>
          <Text style={styles.text}>
            {hasPendingCommand ? '行动已保存，重连后继续确认' : '连接失败'}
          </Text>
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
      <Text style={styles.text}>
        {hasPendingCommand
          ? isDisconnected
            ? '行动已保存，重连后将自动确认'
            : '正在确认提交结果'
          : '连接断开，正在重连'}
      </Text>
      <View style={styles.progressBarTrack}>
        <Animated.View style={[styles.progressBar, progressBarStyle]} />
      </View>
    </View>
  );
};

export const ConnectionStatusBar = memo(ConnectionStatusBarComponent);

ConnectionStatusBar.displayName = 'ConnectionStatusBar';
