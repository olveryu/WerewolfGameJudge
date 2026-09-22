/** Responsive elimination confirmation; accepts only public player identity and reports intent. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import type { RoomSeatPlayer } from '@/features/room/model/RoomSeatDataSource';
import { usesRoomSideInspector } from '@/features/room/model/roomShellLayout';
import { colors, spacing } from '@/theme';
import { componentSizes } from '@/theme/tokens';

import { undercoverStyles as styles } from '../../undercover.styles';

interface UndercoverRevealModalProps {
  readonly seat: number;
  readonly player: RoomSeatPlayer;
  readonly isSubmitting: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

/** Keep confirmation adjacent to the selected player without revealing hidden game information. */
export function UndercoverRevealModal({
  seat,
  player,
  isSubmitting,
  onClose,
  onConfirm,
}: UndercoverRevealModalProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWideLayout = usesRoomSideInspector(width);
  return (
    <Modal
      visible
      transparent
      animationType={isWideLayout ? 'fade' : 'slide'}
      onRequestClose={onClose}
    >
      <View style={[styles.revealOverlay, isWideLayout && styles.revealOverlayWide]}>
        <View
          style={[
            styles.revealPanel,
            isWideLayout && styles.revealPanelWide,
            { paddingBottom: Math.max(spacing.large, insets.bottom) },
          ]}
          accessibilityViewIsModal
          accessibilityLabel="确认玩家出局"
          testID="undercover-reveal-modal"
        >
          <ScrollView contentContainerStyle={styles.section}>
            <Text style={styles.title} accessibilityRole="header">
              确认出局？
            </Text>
            <View style={styles.revealIdentity}>
              <Avatar
                value={player.userId}
                avatarUrl={player.avatarUrl}
                size={componentSizes.avatar.lg}
              />
              <View style={styles.revealName}>
                <Text style={styles.title}>{seat + 1} 号</Text>
                <Text style={styles.text} testID="undercover-reveal-player">
                  {player.displayName}
                </Text>
              </View>
            </View>
            <Text style={styles.muted}>确认后将揭晓身份，该玩家立即出局。此操作不可撤销。</Text>
          </ScrollView>
          <View style={styles.revealActions}>
            <Button
              variant="secondary"
              size="lg"
              onPress={onClose}
              disabled={isSubmitting}
              style={styles.revealAction}
              testID="undercover-reveal-cancel"
            >
              取消
            </Button>
            <Button
              variant="danger"
              size="lg"
              onPress={onConfirm}
              loading={isSubmitting}
              style={styles.revealAction}
              icon={
                <Ionicons
                  name="person-remove-outline"
                  size={componentSizes.icon.sm}
                  color={colors.textInverse}
                />
              }
              testID="undercover-reveal"
            >
              确认出局
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}
