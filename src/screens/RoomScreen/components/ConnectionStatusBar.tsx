/**
 * ConnectionStatusBar - 断线横幅 + indeterminate 进度条（Memoized）
 *
 * 仅在非 Live 状态时显示 "连接断开，正在重连..." 及底部滑动进度条。
 * Dead channel detector 会无限 5s 重试，无需手动重试按钮。
 * 社区标准做法：indeterminate progress bar（类似 Slack/Discord）表示持续重连中。
 */
import React, { memo, useEffect, useMemo, useState } from 'react';
import { Animated, Text, View } from 'react-native';

import { ConnectionStatus } from '@/services/types/IGameFacade';
import { TESTIDS } from '@/testids';

import { type ConnectionStatusBarStyles } from './styles';

interface ConnectionStatusBarProps {
  /** Current connection state */
  status: ConnectionStatus;
  /** Pre-created styles from parent */
  styles: ConnectionStatusBarStyles;
}

/** Width of the sliding bar relative to container width */
const BAR_WIDTH_RATIO = 0.3;
/** Full cycle duration for the sliding animation */
const ANIMATION_DURATION_MS = 1_500;

/**
 * Disconnection banner with indeterminate progress bar.
 *
 * Uses `onLayout` to measure container width, then loops an `Animated.timing`
 * translateX from off-screen left to off-screen right. The container's
 * `overflow: 'hidden'` clips the bar at rounded corners.
 * Returns null when connection is Live.
 */
const ConnectionStatusBarComponent: React.FC<ConnectionStatusBarProps> = ({ status, styles }) => {
  const [containerWidth, setContainerWidth] = useState(0);
  // Stable Animated.Value via lazy useState (avoids useRef.current in render — React 19 lint)
  const [progress] = useState(() => new Animated.Value(0));

  // Coalesce Disconnected/Connecting/Syncing into a single boolean so the
  // animation effect only re-runs on the Live ↔ non-Live edge, not on every
  // Disconnected↔Connecting flip during dead-channel retries.
  const isDisconnected = status !== ConnectionStatus.Live;

  // Start / stop the sliding animation based on connection status
  useEffect(() => {
    if (containerWidth === 0 || !isDisconnected) {
      progress.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: ANIMATION_DURATION_MS,
        useNativeDriver: true,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [progress, containerWidth, isDisconnected]);

  const barPixelWidth = containerWidth * BAR_WIDTH_RATIO;
  const translateX = useMemo(
    () =>
      progress.interpolate({
        inputRange: [0, 1],
        outputRange: [-barPixelWidth, containerWidth],
      }),
    [progress, barPixelWidth, containerWidth],
  );

  if (!isDisconnected) return null;

  return (
    <View
      style={styles.container}
      testID={TESTIDS.connectionStatusContainer}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Text style={styles.text}>连接断开，正在重连...</Text>
      <View style={styles.progressBarTrack}>
        <Animated.View
          style={[styles.progressBar, { width: barPixelWidth, transform: [{ translateX }] }]}
        />
      </View>
    </View>
  );
};

export const ConnectionStatusBar = memo(ConnectionStatusBarComponent);

ConnectionStatusBar.displayName = 'ConnectionStatusBar';
