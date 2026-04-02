/**
 * HintWithWarning — 底部互斥提示/警告文字区域
 *
 * 所有揭示效果共用的底部文字 UI：当 autoTimeoutWarning 激活时替换 hintText。
 * 不 import service，不含业务逻辑。
 */
import React from 'react';
import { type StyleProp, StyleSheet, Text, type TextStyle, View } from 'react-native';

import { crossPlatformTextShadow } from '@/theme';

const WARNING_COLOR = 'rgba(255, 200, 50, 0.9)';
const DEFAULT_HINT_COLOR = 'rgba(255, 255, 255, 0.85)';

interface HintWithWarningProps {
  /** Current phase hint text; null = no hint to show */
  hintText: string | null;
  /** Auto-timeout warning active (from useAutoTimeout) */
  showWarning: boolean;
  /** Optional style override for hint text */
  hintTextStyle?: StyleProp<TextStyle>;
}

export const HintWithWarning: React.FC<HintWithWarningProps> = ({
  hintText,
  showWarning,
  hintTextStyle,
}) => {
  if (showWarning) {
    return (
      <View style={styles.container} pointerEvents="none">
        <Text style={styles.warningText}>⏳ 即将自动揭晓…</Text>
      </View>
    );
  }

  if (hintText) {
    return (
      <View style={styles.container} pointerEvents="none">
        <Text style={[styles.hintText, hintTextStyle]}>{hintText}</Text>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 80,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  hintText: {
    fontSize: 20,
    fontWeight: '700',
    color: DEFAULT_HINT_COLOR,
    textAlign: 'center',
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.6)', 0, 1, 4),
  },
  warningText: {
    fontSize: 18,
    fontWeight: '600',
    color: WARNING_COLOR,
    textAlign: 'center',
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.6)', 0, 1, 4),
  },
});
