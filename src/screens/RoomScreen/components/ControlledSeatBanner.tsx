/**
 * ControlledSeatBanner.tsx - Debug mode banner showing currently controlled bot seat
 *
 * Shows a banner at the top of the screen when Host is controlling a bot seat.
 * Also shows a hint banner when no bot is controlled but bots are present.
 * Allows quick release of control.
 *
 * Performance: Memoized, receives pre-created styles from parent.
 * Only imports types, styles, and UI components. Does not import Service singletons or showAlert.
 */
import React, { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { type ControlledSeatBannerStyles } from './styles';

interface ControlledSeatBannerProps {
  /** Mode: 'hint' shows takeover hint, 'controlled' shows controlled bot */
  mode: 'hint' | 'controlled';
  /** The seat number being controlled (0-indexed, display as 1-indexed) - required when mode='controlled' */
  controlledSeat?: number;
  /** Display name of the bot being controlled - required when mode='controlled' */
  botDisplayName?: string;
  /** Callback when user wants to release control - required when mode='controlled' */
  onRelease?: () => void;
  /** Pre-created styles from parent */
  styles: ControlledSeatBannerStyles;
}

const ControlledSeatBannerComponent: React.FC<ControlledSeatBannerProps> = ({
  mode,
  controlledSeat,
  botDisplayName,
  onRelease,
  styles,
}) => {
  if (mode === 'hint') {
    return (
      <View style={styles.hintContainer}>
        <Text style={styles.hintText}>💡 长按座位可接管机器人</Text>
      </View>
    );
  }

  // mode='controlled': controlledSeat must be a valid number (caller guarantees this)
  // Fail-fast: if controlledSeat is undefined, don't render garbage
  if (controlledSeat === undefined) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        🎮 正在操控 {controlledSeat + 1} 号位（{botDisplayName}）
      </Text>
      <TouchableOpacity style={styles.releaseButton} onPress={onRelease}>
        <Text style={styles.releaseButtonText}>退出</Text>
      </TouchableOpacity>
    </View>
  );
};

export const ControlledSeatBanner = memo(ControlledSeatBannerComponent);

ControlledSeatBanner.displayName = 'ControlledSeatBanner';
