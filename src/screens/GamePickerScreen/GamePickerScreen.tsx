/**
 * GamePickerScreen — full-screen game library picker page.
 *
 * A real stack route (not a modal) so the back affordance matches the
 * user's mental model: Home pushes this page with a `purpose` param,
 * selecting a game pushes GameConfig (create) or GameGuide (guide) on
 * top of it, and backing out of the config/guide lands here again to
 * pick a different game. Closing the page itself pops back to Home.
 *
 * Content comes from the exhaustive client game catalog: main-tier games
 * render as full-width featured cards — the game's key art under a
 * left-dark shade when it ships art, its own theme gradient otherwise;
 * mini-tier games render as a two-column tile grid under the 小游戏
 * section (art header, or a theme-gradient icon chip when the game
 * ships no art).
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CloseButton } from '@/components/CloseButton';
import { PressableScale } from '@/components/PressableScale';
import { useClientGameHome } from '@/games/ClientGameCatalogContext';
import type { ClientGameModeOption } from '@/games/home';
import type { GamePickerPurpose, RootStackParamList } from '@/navigation/types';
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

type Props = NativeStackScreenProps<RootStackParamList, 'GamePicker'>;

const PICKER_COPY: Record<
  GamePickerPurpose,
  { readonly title: string; readonly subtitle: string }
> = {
  create: { title: '创建游戏', subtitle: '选择本局要创建的游戏' },
  guide: { title: '选择游戏图鉴', subtitle: '选择要查看的游戏' },
};

/** Featured card height, matched to the approved library mock. */
const FEATURED_CARD_HEIGHT = 158;

/** Mini tile key-art header height, matched to the approved library mock. */
const MINI_ART_HEIGHT = 74;

/**
 * Left-dark shade over featured key art (stops matched to the approved
 * library mock): the art is composed with its subject on the right, so the
 * shade keeps the left text zone readable and fades out over the subject.
 */
const FEATURED_ART_SHADE_COLORS = [
  withAlpha(colors.text, 0.78),
  withAlpha(colors.text, 0.25),
  withAlpha(colors.text, 0),
] as const;
const FEATURED_ART_SHADE_LOCATIONS = [0.3, 0.62, 0.82] as const;

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
      <View style={styles.featuredCard}>
        {option.art ? (
          <>
            <Image source={option.art} style={styles.featuredArt} resizeMode="cover" />
            <LinearGradient
              colors={[...FEATURED_ART_SHADE_COLORS]}
              locations={[...FEATURED_ART_SHADE_LOCATIONS]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.featuredFill}
            />
          </>
        ) : (
          <>
            <LinearGradient
              colors={[...option.gradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.featuredFill}
            />
            <Ionicons
              name={option.iconName}
              size={componentSizes.avatar.xl}
              color={withAlpha(colors.textInverse, 0.25)}
              style={styles.featuredWatermark}
            />
          </>
        )}
        <View style={styles.featuredPill}>
          <Text style={styles.featuredPillText}>主游戏</Text>
        </View>
        <View style={styles.featuredText}>
          <Text style={styles.featuredTitle}>{option.displayName}</Text>
          <Text style={styles.featuredSubtitle}>{option.subtitle}</Text>
        </View>
      </View>
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
  if (option.art) {
    return (
      <PressableScale
        style={[styles.miniTile, styles.miniTileWithArt]}
        onPress={() => onSelect(option)}
        testID={TESTIDS.gameModePickerOption(option.gameType)}
      >
        <Image source={option.art} style={styles.miniArt} resizeMode="cover" />
        <View style={styles.miniTileText}>
          <Text style={styles.miniTitle}>{option.displayName}</Text>
          <Text style={styles.miniSubtitle} numberOfLines={2}>
            {option.subtitle}
          </Text>
        </View>
      </PressableScale>
    );
  }
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

export const GamePickerScreen: React.FC<Props> = ({ navigation, route }) => {
  const { purpose } = route.params;
  const clientGameHome = useClientGameHome();
  const options = purpose === 'create' ? clientGameHome.modeOptions : clientGameHome.guideOptions;
  if (options.length === 0) {
    throw new Error('[FAIL-FAST] GamePickerScreen requires at least one option');
  }
  const mainOptions = options.filter((option) => option.tier === 'main');
  if (mainOptions.length === 0) {
    throw new Error('[FAIL-FAST] GamePickerScreen requires at least one main-tier option');
  }
  const miniOptions = options.filter((option) => option.tier === 'mini');
  const copy = PICKER_COPY[purpose];

  const handleSelect = (option: ClientGameModeOption) => {
    if (purpose === 'create') {
      navigation.navigate('GameConfig', { gameType: option.gameType, mode: 'create' });
      return;
    }
    navigation.navigate('GameGuide', { gameType: option.gameType });
  };

  return (
    <SafeAreaView style={styles.page} testID={TESTIDS.gameModePickerModal}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
        </View>
        <CloseButton onPress={() => navigation.goBack()} style={styles.closeButton} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.featuredSection}>
          {mainOptions.map((option) => (
            <FeaturedGameCard key={option.gameType} option={option} onSelect={handleSelect} />
          ))}
        </View>

        {miniOptions.length > 0 && (
          <View style={styles.miniSection}>
            <Text style={styles.miniSectionLabel} testID={TESTIDS.gameModePickerMiniSection}>
              小游戏
            </Text>
            <View style={styles.miniGrid}>
              {miniOptions.map((option) => (
                <MiniGameTile key={option.gameType} option={option} onSelect={handleSelect} />
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
    height: FEATURED_CARD_HEIGHT,
    justifyContent: 'flex-end',
    borderRadius: borderRadius.large,
    padding: spacing.medium,
    overflow: 'hidden',
  },
  featuredFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  // Explicit 100% size is load-bearing, not redundant with the absolute
  // anchor: react-native-web injects the asset's intrinsic dimensions
  // (e.g. 1920x1280 for the key art) into the Image root style ahead of the
  // consumer style, so an inset-only fill keeps the intrinsic width/height
  // and CSS drops right/bottom as over-constrained — the card then clips a
  // natural-size top-left slice of the art instead of the cover crop.
  // Matches the repo rule that Image always carries an explicit size
  // (same shape as miniArt below).
  featuredArt: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
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
  miniTileWithArt: {
    padding: 0,
    gap: 0,
    overflow: 'hidden',
  },
  miniArt: {
    width: '100%',
    height: MINI_ART_HEIGHT,
  },
  miniTileText: {
    padding: spacing.medium,
    gap: spacing.small,
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
