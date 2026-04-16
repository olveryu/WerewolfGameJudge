/**
 * BottomActionPanel - 底部浮动操作面板（Memoized）
 *
 * 三层布局：primary → secondary → ghost。
 * 接收 BottomLayout（声明式配置驱动），渲染 message + 三层按钮。
 * 纯展示组件，不 import service，不包含业务逻辑判断。
 */

import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';

import { Button } from '@/components/Button';
import type { ActionIntent } from '@/screens/RoomScreen/policy/types';
import { TESTIDS } from '@/testids';

import type { BottomLayout, ButtonConfig, StaticButtonId } from '../hooks/bottomLayoutConfig';
import { type BottomActionPanelStyles } from './styles';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

interface BottomActionPanelProps {
  /** Action message to display (e.g., "请选择要查验的玩家") */
  message?: string;
  /** Whether to show the message section */
  showMessage?: boolean;
  /** Three-tier button layout from useBottomLayout. */
  layout: BottomLayout;
  /** Callback for schema-driven button press (BOTTOM_ACTION intent). */
  onSchemaButtonPress: (intent: ActionIntent) => void;
  /** Callback for static button press (HOST_CONTROL / VIEW_ROLE / etc.). */
  onStaticButtonPress: (action: StaticButtonId) => void;
  /** Pre-created styles from parent */
  styles: BottomActionPanelStyles;
  /** Safe area bottom inset — applied as paddingBottom when > styles.container.paddingBottom */
  bottomInset?: number;
}

const BottomActionPanelComponent: React.FC<BottomActionPanelProps> = ({
  message,
  showMessage = false,
  layout,
  onSchemaButtonPress,
  onStaticButtonPress,
  styles,
  bottomInset = 0,
}) => {
  // C6: Fade-in + slide-up animation when message text changes (native only)
  // On web, RN Animated with useNativeDriver=false applies inline opacity:0 synchronously,
  // which makes the element invisible to Playwright's visibility checks during the 150ms window.
  const msgFadeAnim = useMemo(() => new Animated.Value(1), []);
  const msgSlideAnim = useMemo(() => new Animated.Value(0), []);
  const prevMessageRef = useRef(message);

  useEffect(() => {
    if (prevMessageRef.current !== message && message && USE_NATIVE_DRIVER) {
      msgFadeAnim.setValue(0);
      msgSlideAnim.setValue(4);
      Animated.parallel([
        Animated.timing(msgFadeAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(msgSlideAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]).start();
    }
    prevMessageRef.current = message;
  }, [message, msgFadeAnim, msgSlideAnim]);

  // Don't render if there's nothing to show
  const hasContent =
    layout.primary.length > 0 || layout.secondary.length > 0 || layout.ghost.length > 0;
  if (!hasContent && !showMessage) return null;

  const containerStyle =
    bottomInset > 0 ? [styles.container, { paddingBottom: bottomInset }] : styles.container;

  return (
    <View style={containerStyle} testID={TESTIDS.bottomActionPanel}>
      {/* Action Message — fades in + slides up on change */}
      {showMessage && message ? (
        <Animated.Text
          style={[
            styles.message,
            { opacity: msgFadeAnim, transform: [{ translateY: msgSlideAnim }] },
          ]}
          testID={TESTIDS.actionMessage}
        >
          {message}
        </Animated.Text>
      ) : null}

      {/* Primary + Secondary buttons — vertical full-width stack */}
      {(layout.primary.length > 0 || layout.secondary.length > 0) && (
        <View style={styles.buttonRow}>
          {layout.primary.map((btn) => (
            <LayoutButton
              key={btn.key}
              config={btn}
              onSchemaPress={onSchemaButtonPress}
              onStaticPress={onStaticButtonPress}
            />
          ))}
          {layout.secondary.map((btn) => (
            <LayoutButton
              key={btn.key}
              config={btn}
              onSchemaPress={onSchemaButtonPress}
              onStaticPress={onStaticButtonPress}
            />
          ))}
        </View>
      )}

      {/* Ghost row — horizontal centered text buttons */}
      {layout.ghost.length > 0 && (
        <View style={styles.ghostRow}>
          {layout.ghost.map((btn) => (
            <LayoutButton
              key={btn.key}
              config={btn}
              onSchemaPress={onSchemaButtonPress}
              onStaticPress={onStaticButtonPress}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// LayoutButton — renders a single ButtonConfig
// ─────────────────────────────────────────────────────────────────────────────

interface LayoutButtonProps {
  config: ButtonConfig;
  onSchemaPress: (intent: ActionIntent) => void;
  onStaticPress: (action: StaticButtonId) => void;
}

const LayoutButton: React.FC<LayoutButtonProps> = ({ config, onSchemaPress, onStaticPress }) => {
  const handlePress = config.intent
    ? (meta: { disabled: boolean }) => {
        if (config.fireWhenDisabled || !meta.disabled) {
          onSchemaPress(config.intent!);
        }
      }
    : config.action
      ? (meta: { disabled: boolean }) => {
          if (config.fireWhenDisabled || !meta.disabled) {
            onStaticPress(config.action!);
          }
        }
      : undefined;

  return (
    <Button
      variant={config.variant}
      size={config.size}
      disabled={config.disabled}
      fireWhenDisabled={config.fireWhenDisabled}
      buttonColor={config.buttonColor}
      textColor={config.textColor}
      testID={config.testID}
      onPress={handlePress}
    >
      {config.label}
    </Button>
  );
};

export const BottomActionPanel = memo(BottomActionPanelComponent);

BottomActionPanel.displayName = 'BottomActionPanel';
