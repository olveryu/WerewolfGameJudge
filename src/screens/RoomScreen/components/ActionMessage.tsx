/**
 * ActionMessage - 行动提示文本（Memoized）
 *
 * 显示当前行动阶段的提示信息。
 *
 * ✅ 允许：渲染文本 UI
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { memo } from 'react';
import { Text } from 'react-native';
import { TESTIDS } from '@/testids';
import { type ActionMessageStyles } from './styles';

export interface ActionMessageProps {
  /** The message to display */
  message: string;
  /** Pre-created styles from parent */
  styles: ActionMessageStyles;
}

function arePropsEqual(prev: ActionMessageProps, next: ActionMessageProps): boolean {
  return prev.message === next.message && prev.styles === next.styles;
}

const ActionMessageComponent: React.FC<ActionMessageProps> = ({ message, styles }) => {
  return (
    <Text style={styles.actionMessage} testID={TESTIDS.actionMessage}>
      {message}
    </Text>
  );
};

export const ActionMessage = memo(ActionMessageComponent, arePropsEqual);

ActionMessage.displayName = 'ActionMessage';
