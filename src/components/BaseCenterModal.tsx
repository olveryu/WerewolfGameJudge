/**
 * BaseCenterModal — base centered modal component
 *
 * Provides a generic shell with an overlay (dark backdrop) + centered content box.
 * Consumers fill custom content via children and override size/radius/shadow via contentStyle.
 * No business logic, no service imports.
 *
 * Overlay dismiss uses a sibling layout (Pressable absoluteFill placed below content),
 * not the parent-wrapping pattern. This way content children touch events are not intercepted by the overlay,
 * compatible with web (DOM click bubble) and native (responder system).
 * See RN official Modal docs example.
 */
import type React from 'react';
import { Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { Modal } from '@/components/AppModal';
import { borderRadius, colors, spacing } from '@/theme';

interface BaseCenterModalProps {
  visible: boolean;
  onClose: () => void;
  /** Whether tapping the overlay closes the modal (default: false) */
  dismissOnOverlayPress?: boolean;
  animationType?: 'fade' | 'slide' | 'none';
  /** Content style overrides (width / maxHeight / borderRadius / padding / shadow, etc.) */
  contentStyle?: StyleProp<ViewStyle>;
  /** Content testID */
  testID?: string;
  children: React.ReactNode;
}

export const BaseCenterModal: React.FC<BaseCenterModalProps> = ({
  visible,
  onClose,
  dismissOnOverlayPress = false,
  animationType = 'fade',
  contentStyle,
  testID,
  children,
}) => {
  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Sibling Pressable behind content — only rendered when dismiss is enabled */}
        {dismissOnOverlayPress && <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />}
        <View style={[styles.contentBox, contentStyle]} testID={testID}>
          {children}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentBox: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    padding: spacing.large,
  },
});
