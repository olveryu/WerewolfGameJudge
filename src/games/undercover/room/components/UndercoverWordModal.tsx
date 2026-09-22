/** Concealed-by-unmounting word card; receives only the viewer's allowed card. */
import type { UndercoverWordCard } from '@game-judge/game-engine/games/undercover/public';
import { Text } from 'react-native';

import { Button } from '@/components/Button';
import { RoomDialog } from '@/features/room/components/RoomDialog';

import { undercoverStyles as styles } from '../../undercover.styles';

interface UndercoverWordModalProps {
  readonly card: UndercoverWordCard;
  readonly isControlled: boolean;
  readonly shouldConfirm: boolean;
  readonly isSubmitting: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}

export function UndercoverWordModal({
  card,
  isControlled,
  shouldConfirm,
  isSubmitting,
  onClose,
  onConfirm,
}: UndercoverWordModalProps) {
  return (
    <RoomDialog
      title={`${card.seat + 1}号词卡`}
      subtitle={isControlled ? '正在接管' : '你的词卡'}
      onClose={onClose}
      testID="undercover-word-modal"
      footer={
        <>
          {shouldConfirm && (
            <Button
              variant="primary"
              size="lg"
              onPress={onConfirm}
              loading={isSubmitting}
              testID="undercover-confirm"
            >
              我已记住
            </Button>
          )}
          <Button variant={shouldConfirm ? 'secondary' : 'primary'} size="lg" onPress={onClose}>
            隐藏词卡
          </Button>
        </>
      }
    >
      <Text style={styles.word} testID="undercover-word">
        {card.kind === 'blank' ? '你是白板' : card.word}
      </Text>
    </RoomDialog>
  );
}
