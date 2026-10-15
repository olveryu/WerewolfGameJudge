/**
 * GameModePickerModal — full-screen game library picker.
 *
 * Backed by the exhaustive client game catalog. Main-tier games render as
 * full-width featured cards on their own theme gradient; mini-tier games
 * render as a two-column tile grid under the 小游戏 section.
 *
 * Presentation: AppModal (RN Modal) with a flex:1 page surface — the same
 * full-screen form as PictionaryDrawingImage's fullscreen preview. The page
 * owns its header (title + subtitle + close button) and a scrolling content
 * area padded by the safe-area insets; closing runs through the header
 * button and onRequestClose (Android back) only — there is no overlay.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Modal } from '@/components/AppModal';
import { CloseButton } from '@/components/CloseButton';
import { PressableScale } from '@/components/PressableScale';
import type { ClientGameModeOption } from '@/games/home';
import { TESTIDS } from '@/testids';
import {
  borderRadius,
  colors,
  componentSizes,
  shadows,
  spacing,
  typography,
  withAlpha,
} from '@/theme';

interface GameModePickerModalProps {
  readonly visible: boolean;
  readonly title: string;
  readonly subtitle: string;
  readonly options: readonly ClientGameModeOption[];
  readonly onClose: () => void;
  readonly onSelect: (option: ClientGameModeOption) => void;
}

function FeaturedGameCard({
  option,
  onSelect,
}: {
  readonly option: ClientGameModeOption;
  readonly onSelect: (option: ClientGameModeOption) => void;
}) {
  return (
    <PressableScale
      onPress={() => onSelect(option)}
      testID={TESTIDS.gameModePickerOption(option.gameType)}
    >
      <LinearGradient
        colors={[...option.gradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.featuredCard}
      >
        <Ionicons
          name={option.iconName}
          size={componentSizes.avatar.xl}
          color={withAlpha(colors.textInverse, 0.25)}
          style={styles.featuredWatermark}
        />
        <View style={styles.featuredPill}>
          <Text style={styles.featuredPillText}>主游戏</Text>
        </View>
        <View style={styles.featuredText}>
          <Text style={styles.featuredTitle}>{option.displayName}</Text>
          <Text style={styles.featuredSubtitle}>{option.subtitle}</Text>
        </View>
      </LinearGradient>
    </PressableScale>
  );
}

function MiniGameTile({
  option,
  onSelect,
}: {
  readonly option: ClientGameModeOption;
  readonly onSelect: (option: ClientGameModeOption) => void;
}) {
  return (
    <PressableScale
      style={styles.miniTile}
      onPress={() => onSelect(option)}
      testID={TESTIDS.gameModePickerOption(option.gameType)}
    >
      <View style={[styles.miniIconWrap, { backgroundColor: option.gradient[1] }]}>
        <Ionicons name={option.iconName} size={componentSizes.icon.md} color={colors.textInverse} />
      </View>
      <Text style={styles.miniTitle}>{option.displayName}</Text>
      <Text style={styles.miniSubtitle} numberOfLines={2}>
        {option.subtitle}
      </Text>
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
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.page} testID={TESTIDS.gameModePickerModal}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>
          <CloseButton onPress={onClose} style={styles.closeButton} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.featuredSection}>
            {mainOptions.map((option) => (
              <FeaturedGameCard key={option.gameType} option={option} onSelect={onSelect} />
            ))}
          </View>

          {miniOptions.length > 0 && (
            <View style={styles.miniSection}>
              <Text style={styles.miniSectionLabel} testID={TESTIDS.gameModePickerMiniSection}>
                小游戏
              </Text>
              <View style={styles.miniGrid}>
                {miniOptions.map((option) => (
                  <MiniGameTile key={option.gameType} option={option} onSelect={onSelect} />
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.medium,
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.large,
    paddingBottom: spacing.medium,
  },
  headerText: {
    flex: 1,
    gap: spacing.tight,
  },
  closeButton: {
    position: 'relative',
    top: 0,
    right: 0,
  },
  title: {
    fontSize: typography.title,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.secondary,
    color: colors.textMuted,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.screenH,
    paddingBottom: spacing.xlarge,
    gap: spacing.large,
  },
  featuredSection: {
    gap: spacing.medium,
  },
  featuredCard: {
    minHeight: 112,
    justifyContent: 'flex-end',
    borderRadius: borderRadius.large,
    padding: spacing.medium,
    overflow: 'hidden',
  },
  featuredWatermark: {
    position: 'absolute',
    right: -spacing.small,
    bottom: -spacing.small,
  },
  featuredPill: {
    position: 'absolute',
    top: spacing.medium,
    left: spacing.medium,
    borderRadius: borderRadius.full,
    backgroundColor: withAlpha(colors.textInverse, 0.25),
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.tight,
  },
  featuredPillText: {
    fontSize: typography.caption,
    fontWeight: typography.weights.semibold,
    color: colors.textInverse,
  },
  featuredText: {
    gap: spacing.tight,
    paddingRight: componentSizes.avatar.xl,
  },
  featuredTitle: {
    fontSize: typography.title,
    fontWeight: typography.weights.semibold,
    color: colors.textInverse,
  },
  featuredSubtitle: {
    fontSize: typography.caption,
    color: withAlpha(colors.textInverse, 0.85),
  },
  miniSection: {
    gap: spacing.small,
  },
  miniSectionLabel: {
    fontSize: typography.caption,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
  },
  miniGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.medium,
  },
  miniTile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.large,
    padding: spacing.medium,
    gap: spacing.small,
    ...shadows.sm,
  },
  miniIconWrap: {
    width: componentSizes.avatar.md,
    height: componentSizes.avatar.md,
    borderRadius: borderRadius.medium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniTitle: {
    fontSize: typography.secondary,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
  miniSubtitle: {
    fontSize: typography.caption,
    color: colors.textMuted,
  },
});
