/** Concealed-by-unmounting word card; receives only the viewer's allowed card. */
import type { UndercoverWordCard } from '@game-judge/game-engine/games/undercover/public';
import { Text, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { Button } from '@/components/Button';

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
    <BaseCenterModal
      visible
      onClose={onClose}
      dismissOnOverlayPress
      contentStyle={styles.modal}
      testID="undercover-word-modal"
    >
      <View style={styles.section}>
        <Text style={styles.title}>
          {isControlled ? '正在接管 · ' : ''}
          {card.seat + 1}号词卡
        </Text>
        <Text style={styles.word} testID="undercover-word">
          {card.kind === 'blank' ? '你是白板' : card.word}
        </Text>
        {shouldConfirm && (
          <Button
            variant="primary"
            onPress={onConfirm}
            loading={isSubmitting}
            testID="undercover-confirm"
          >
            我已记住
          </Button>
        )}
        <Button variant="secondary" onPress={onClose}>
          隐藏词卡
        </Button>
      </View>
    </BaseCenterModal>
  );
}
