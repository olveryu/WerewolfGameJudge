/** Fixed room-dialog heading and actions with scrollable game-owned details. */
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { Button } from '@/components/Button';
import { colors, spacing } from '@/theme';
import { componentSizes } from '@/theme/tokens';

import { roomSurfaceStyles as styles } from './RoomSurface.styles';

/** Does not own visibility, permissions or confirmation state. */
export function RoomDialog({
  title,
  subtitle,
  titleTestID,
  testID,
  onClose,
  children,
  footer,
}: {
  readonly title: string;
  readonly subtitle?: string;
  readonly titleTestID?: string;
  readonly testID?: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly footer: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <BaseCenterModal
      visible
      onClose={onClose}
      dismissOnOverlayPress
      contentStyle={styles.dialog}
      testID={testID}
    >
      <View style={styles.header}>
        <View style={styles.heading}>
          {subtitle !== undefined && <Text style={styles.status}>{subtitle}</Text>}
          <Text style={styles.title} accessibilityRole="header" testID={titleTestID}>
            {title}
          </Text>
        </View>
        <Button variant="icon" size="sm" onPress={onClose} accessibilityLabel="关闭详情">
          <Ionicons name="close" size={componentSizes.icon.md} color={colors.textSecondary} />
        </Button>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(spacing.large, insets.bottom) }]}>
        {footer}
      </View>
    </BaseCenterModal>
  );
}
