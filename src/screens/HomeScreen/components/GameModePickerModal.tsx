/** Centered game selector backed by the exhaustive client game catalog. */

import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';

import { BaseCenterModal } from '@/components/BaseCenterModal';
import { PressableScale } from '@/components/PressableScale';
import type { ClientGameModeOption } from '@/games/home';
import { TESTIDS } from '@/testids';
import { borderRadius, colors, componentSizes, spacing, typography } from '@/theme';
import { gameBanners } from '@/utils/gameBanners';

interface GameModePickerModalProps {
  readonly visible: boolean;
  readonly title: string;
  readonly subtitle: string;
  readonly options: readonly ClientGameModeOption[];
  readonly onClose: () => void;
  readonly onSelect: (option: ClientGameModeOption) => void;
}

function decisionInfo(option: ClientGameModeOption): string {
  const parts = [option.playerLabel, option.durationLabel].filter(
    (part): part is string => part !== undefined,
  );
  return parts.length > 0 ? parts.join(' · ') : option.subtitle;
}

function HeroCard({
  option,
  onSelect,
}: {
  readonly option: ClientGameModeOption;
  readonly onSelect: (option: ClientGameModeOption) => void;
}) {
  const banner = gameBanners[option.gameType];
  const content = (
    <>
      <View style={styles.rowText}>
        <Text style={styles.heroTitle}>{option.displayName}</Text>
        <Text style={styles.heroSubtitle}>{decisionInfo(option)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={componentSizes.icon.md} color={colors.textInverse} />
    </>
  );

  return (
    <PressableScale
      onPress={() => onSelect(option)}
      testID={TESTIDS.gameModePickerOption(option.gameType)}
    >
      {banner !== undefined ? (
        <ImageBackground
          source={banner}
          style={styles.heroImage}
          imageStyle={styles.heroImageRadius}
          resizeMode="cover"
        >
          <LinearGradient
            colors={[colors.overlay, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.65, y: 0 }}
            style={styles.heroScrim}
          />
          <View style={styles.heroContent}>{content}</View>
        </ImageBackground>
      ) : (
        <LinearGradient
          colors={[colors.primaryLight, colors.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          {content}
        </LinearGradient>
      )}
    </PressableScale>
  );
}

function MiniGameRow({
  option,
  isLast,
  onSelect,
}: {
  readonly option: ClientGameModeOption;
  readonly isLast: boolean;
  readonly onSelect: (option: ClientGameModeOption) => void;
}) {
  return (
    <PressableScale
      style={[styles.miniRow, !isLast && styles.miniRowDivider]}
      onPress={() => onSelect(option)}
      testID={TESTIDS.gameModePickerOption(option.gameType)}
    >
      <View style={styles.miniIconWrap}>
        <Ionicons name={option.iconName} size={componentSizes.icon.md} color={colors.primary} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.miniTitle}>{option.displayName}</Text>
        <Text style={styles.rowSubtitle}>{option.subtitle}</Text>
      </View>
      {option.playerLabel !== undefined && (
        <View style={styles.playerTag}>
          <Text style={styles.playerTagText}>{option.playerLabel}</Text>
        </View>
      )}
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
          <HeroCard key={option.gameType} option={option} onSelect={onSelect} />
        ))}
      </View>

      {miniOptions.length > 0 && (
        <View style={styles.miniSection}>
          <Text style={styles.miniSectionLabel} testID={TESTIDS.gameModePickerMiniSection}>
            小游戏
          </Text>
          <View>
            {miniOptions.map((option, index) => (
              <MiniGameRow
                key={option.gameType}
                option={option}
                isLast={index === miniOptions.length - 1}
                onSelect={onSelect}
              />
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
  heroGradient: {
    minHeight: 84,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.medium,
    borderRadius: borderRadius.large,
    padding: spacing.medium,
  },
  heroImage: {
    minHeight: 112,
    borderRadius: borderRadius.large,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  heroImageRadius: {
    borderRadius: borderRadius.large,
  },
  heroScrim: {
    ...StyleSheet.absoluteFill,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.medium,
    padding: spacing.medium,
  },
  heroTitle: {
    fontSize: typography.title,
    fontWeight: typography.weights.semibold,
    color: colors.textInverse,
  },
  heroSubtitle: {
    fontSize: typography.caption,
    color: colors.textInverse,
  },
  miniSection: {
    gap: spacing.small,
  },
  miniSectionLabel: {
    fontSize: typography.caption,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
  },
  miniRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
    paddingVertical: spacing.small,
  },
  miniRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  miniIconWrap: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTitle: {
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  playerTag: {
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceHover,
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.micro,
  },
  playerTagText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
  },
  rowText: {
    flex: 1,
    gap: spacing.micro,
  },
  rowSubtitle: {
    fontSize: typography.caption,
    color: colors.textMuted,
  },
});
