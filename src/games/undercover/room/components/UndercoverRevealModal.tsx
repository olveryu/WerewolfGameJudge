/** Responsive elimination confirmation; accepts only public player identity and reports intent. */
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import type { RoomSeatPlayer } from '@/features/room/model/RoomSeatDataSource';
import { colors } from '@/theme';
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
  return (
    <RoomDialog
      title="确认出局？"
      subtitle={`${seat + 1}号 · ${player.displayName}`}
      onClose={onClose}
      testID="undercover-reveal-modal"
      footer={
        <>
          <Button
            variant="secondary"
            size="lg"
            onPress={onClose}
            disabled={isSubmitting}
            testID="undercover-reveal-cancel"
          >
            取消
          </Button>
          <Button
            variant="danger"
            size="lg"
            onPress={onConfirm}
            loading={isSubmitting}
            testID="undercover-reveal"
            icon={
              <Ionicons
                name="person-remove-outline"
                size={componentSizes.icon.sm}
                color={colors.textInverse}
              />
            }
          >
            确认出局
          </Button>
        </>
      }
    >
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
    </RoomDialog>
  );
}
