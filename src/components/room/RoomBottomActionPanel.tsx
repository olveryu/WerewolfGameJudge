/**
 * RoomBottomActionPanel - Floating bottom action panel (Memoized)
 *
 * Three-tier layout: primary → secondary → ghost.
 * Accepts BottomLayout (declarative config-driven), renders message + three-tier buttons.
 * Pure display component, no service imports, no business logic.
 */

import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Platform, View } from 'react-native';

import { Button } from '@/components/Button';
import { TESTIDS } from '@/testids';

import type { BottomActionPanelStyles } from './roomComponentStyles';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export interface RoomButtonConfig<TIntent = never, TStaticAction extends string = string> {
  key: string;
  label: string;
  variant: 'primary' | 'secondary' | 'ghost';
  size: 'lg' | 'md';
  /** Schema-driven action intent, resolved by the current game adapter. */
  intent?: TIntent;
  /** Static action identifier, resolved by the current game adapter. */
  action?: TStaticAction;
  /** Direct callback for room-like games that do not need action orchestration. */
  onPress?: () => void;
  testID?: string;
  disabled?: boolean;
  fireWhenDisabled?: boolean;
  /** Text color override (e.g. danger-colored ghost button). */
  textColor?: string;
  /** Background color override (e.g. info-colored settings button). */
  buttonColor?: string;
}

export interface RoomBottomLayout<TIntent = never, TStaticAction extends string = string> {
  primary: readonly RoomButtonConfig<TIntent, TStaticAction>[];
  secondary: readonly RoomButtonConfig<TIntent, TStaticAction>[];
  ghost: readonly RoomButtonConfig<TIntent, TStaticAction>[];
}

export interface RoomBottomActionPanelProps<
  TIntent = never,
  TStaticAction extends string = string,
> {
  /** Action message to display (e.g., "请选择要查验的玩家") */
  message?: string;
  /** Whether to show the message section */
  showMessage?: boolean;
  /** Three-tier button layout from useBottomLayout. */
  layout: RoomBottomLayout<TIntent, TStaticAction>;
  /** Callback for schema-driven button press (BOTTOM_ACTION intent). */
  onSchemaButtonPress: (intent: TIntent) => void;
  /** Callback for static button press (HOST_CONTROL / VIEW_ROLE / etc.). */
  onStaticButtonPress: (action: TStaticAction) => void;
  /** Pre-created styles from parent */
  styles: BottomActionPanelStyles;
  /** Safe area bottom inset — applied as paddingBottom when > styles.container.paddingBottom */
  bottomInset?: number;
}

const RoomBottomActionPanelComponent = <TIntent, TStaticAction extends string>({
  message,
  showMessage = false,
  layout,
  onSchemaButtonPress,
  onStaticButtonPress,
  styles,
  bottomInset = 0,
}: RoomBottomActionPanelProps<TIntent, TStaticAction>) => {
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

interface LayoutButtonProps<TIntent = never, TStaticAction extends string = string> {
  config: RoomButtonConfig<TIntent, TStaticAction>;
  onSchemaPress: (intent: TIntent) => void;
  onStaticPress: (action: TStaticAction) => void;
}

const LayoutButton = <TIntent, TStaticAction extends string>({
  config,
  onSchemaPress,
  onStaticPress,
}: LayoutButtonProps<TIntent, TStaticAction>) => {
  const intent = config.intent;
  const action = config.action;
  const handlePress =
    intent !== undefined
      ? (meta: { disabled: boolean }) => {
          if (config.fireWhenDisabled || !meta.disabled) {
            onSchemaPress(intent);
          }
        }
      : action !== undefined
        ? (meta: { disabled: boolean }) => {
            if (config.fireWhenDisabled || !meta.disabled) {
              onStaticPress(action);
            }
          }
        : config.onPress
          ? (meta: { disabled: boolean }) => {
              if (config.fireWhenDisabled || !meta.disabled) {
                config.onPress?.();
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

const MemoizedRoomBottomActionPanel = memo(RoomBottomActionPanelComponent);

MemoizedRoomBottomActionPanel.displayName = 'RoomBottomActionPanel';

export const RoomBottomActionPanel =
  MemoizedRoomBottomActionPanel as typeof RoomBottomActionPanelComponent;
