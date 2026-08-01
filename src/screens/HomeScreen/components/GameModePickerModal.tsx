/** Centered game selector backed by the exhaustive client game catalog. */

import Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { PressableScale } from '@/components/PressableScale';
import type { ClientGameModeOption } from '@/games/home';
import { TESTIDS } from '@/testids';
import { borderRadius, colors, componentSizes, spacing, typography } from '@/theme';

interface GameModePickerModalProps {
  readonly visible: boolean;
  readonly title: string;
  readonly subtitle: string;
  readonly options: readonly ClientGameModeOption[];
  readonly onClose: () => void;
  readonly onSelect: (option: ClientGameModeOption) => void;
}

export const GameModePickerModal: React.FC<GameModePickerModalProps> = ({
  visible,
  title,
  subtitle,
  options,
  onClose,
  onSelect,
}) => {
  if (options.length === 0) {
    throw new Error('[FAIL-FAST] GameModePickerModal requires at least one option');
  }

  return (
    <BaseCenterModal
      visible={visible}
      onClose={onClose}
      dismissOnOverlayPress
      contentStyle={styles.modal}
      testID={TESTIDS.gameModePickerModal}
    >
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.options}>
        {options.map((option) => (
          <PressableScale
            key={option.gameType}
            style={styles.option}
            onPress={() => onSelect(option)}
            testID={TESTIDS.gameModePickerOption(option.gameType)}
          >
            <View style={styles.iconWrap}>
              <Ionicons
                name={option.iconName}
                size={componentSizes.icon.lg}
                color={colors.primary}
              />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.optionTitle}>{option.displayName}</Text>
              <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={componentSizes.icon.sm}
              color={colors.textMuted}
            />
          </PressableScale>
        ))}
      </View>
    </BaseCenterModal>
  );
};

const styles = StyleSheet.create({
  modal: {
    width: '88%',
    maxWidth: 420,
    padding: spacing.large,
    gap: spacing.medium,
  },
  title: {
    fontSize: typography.subtitle,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.secondary,
    color: colors.textMuted,
    textAlign: 'center',
  },
  options: {
    gap: spacing.small,
  },
  option: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.medium,
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.medium,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    gap: spacing.micro,
  },
  optionTitle: {
    fontSize: typography.subtitle,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  optionSubtitle: {
    fontSize: typography.caption,
    color: colors.textMuted,
  },
});
