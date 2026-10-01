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

function GameOptionRow({
  option,
  onSelect,
}: {
  readonly option: ClientGameModeOption;
  readonly onSelect: (option: ClientGameModeOption) => void;
}) {
  return (
    <PressableScale
      style={styles.miniOption}
      onPress={() => onSelect(option)}
      testID={TESTIDS.gameModePickerOption(option.gameType)}
    >
      <View style={styles.miniIconWrap}>
        <Ionicons name={option.iconName} size={componentSizes.icon.md} color={colors.primary} />
      </View>
      <View style={styles.optionText}>
        <Text style={styles.miniOptionTitle}>{option.displayName}</Text>
        <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={componentSizes.icon.sm} color={colors.textMuted} />
    </PressableScale>
  );
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
  const mainOptions = options.filter((option) => option.tier === 'main');
  if (mainOptions.length === 0) {
    throw new Error('[FAIL-FAST] GameModePickerModal requires at least one main-tier option');
  }
  const miniOptions = options.filter((option) => option.tier === 'mini');

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

      <View style={styles.heroSection}>
        {mainOptions.map((option) => (
          <PressableScale
            key={option.gameType}
            style={styles.heroOption}
            onPress={() => onSelect(option)}
            testID={TESTIDS.gameModePickerOption(option.gameType)}
          >
            <View style={styles.heroIconWrap}>
              <Ionicons
                name={option.iconName}
                size={componentSizes.icon.xl}
                color={colors.textInverse}
              />
            </View>
            <View style={styles.optionText}>
              <Text style={styles.heroTitle}>{option.displayName}</Text>
              <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
            </View>
            <Ionicons name="chevron-forward" size={componentSizes.icon.md} color={colors.primary} />
          </PressableScale>
        ))}
      </View>

      {miniOptions.length > 0 && (
        <View style={styles.miniSection}>
          <Text style={styles.miniSectionLabel} testID={TESTIDS.gameModePickerMiniSection}>
            小游戏
          </Text>
          <View style={styles.miniOptions}>
            {miniOptions.map((option) => (
              <GameOptionRow key={option.gameType} option={option} onSelect={onSelect} />
            ))}
          </View>
        </View>
      )}
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
  heroSection: {
    gap: spacing.small,
  },
  heroOption: {
    minHeight: 96,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.medium,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.medium,
  },
  heroIconWrap: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: typography.title,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  miniSection: {
    gap: spacing.small,
  },
  miniSectionLabel: {
    fontSize: typography.caption,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
    marginTop: spacing.small,
  },
  miniOptions: {
    gap: spacing.small,
  },
  miniOption: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.medium,
    backgroundColor: colors.background,
    borderRadius: borderRadius.large,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.small,
  },
  miniIconWrap: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniOptionTitle: {
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  optionText: {
    flex: 1,
    gap: spacing.micro,
  },
  optionSubtitle: {
    fontSize: typography.caption,
    color: colors.textMuted,
  },
});
