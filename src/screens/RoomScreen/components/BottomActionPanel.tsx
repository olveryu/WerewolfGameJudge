/**
 * BottomActionPanel - 底部浮动操作面板（Memoized）
 *
 * 卡片风格，组合 action message + action buttons。纯展示组件。
 *
 * ✅ 允许：渲染 UI（message + 按钮子组件）
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { memo } from 'react';
import { Text, View } from 'react-native';

import { TESTIDS } from '@/testids';

import { type BottomActionPanelStyles } from './styles';

interface BottomActionPanelProps {
  /** Action message to display (e.g., "请选择要查验的玩家") */
  message?: string;
  /** Whether to show the message section */
  showMessage?: boolean;
  /** Button elements (ActionButton, HostControlButtons, etc.) */
  children: React.ReactNode;
  /** Pre-created styles from parent */
  styles: BottomActionPanelStyles;
}

const BottomActionPanelComponent: React.FC<BottomActionPanelProps> = ({
  message,
  showMessage = false,
  children,
  styles,
}) => {
  // Don't render if there's nothing to show
  const hasButtons = React.Children.count(children) > 0;
  if (!hasButtons && !showMessage) return null;

  return (
    <View style={styles.container} testID={TESTIDS.bottomActionPanel}>
      {/* Action Message */}
      {showMessage && message ? (
        <Text style={styles.message} testID={TESTIDS.actionMessage}>
          {message}
        </Text>
      ) : null}

      {/* Button Row */}
      {hasButtons && <View style={styles.buttonRow}>{children}</View>}
    </View>
  );
};

export const BottomActionPanel = memo(BottomActionPanelComponent);

BottomActionPanel.displayName = 'BottomActionPanel';
