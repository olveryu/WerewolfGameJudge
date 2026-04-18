/**
 * GachaScreen — 扭蛋抽奖主界面
 *
 * 上半区：Skia CapsuleMachine 动画（28 球物理 + 搅拌 + 掉落 + 碎裂）。
 * 下半区：券数状态 + 抽奖按钮。
 * 10 连抽完后弹出 TenResultOverlay。
 */

import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PITY_THRESHOLD, TOTAL_UNLOCKABLE_COUNT } from '@werewolf/game-engine';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { Button } from '@/components/Button';
import { useDrawMutation, useGachaStatusQuery } from '@/hooks/queries/useGachaQuery';
import type { DrawResultItem } from '@/services/feature/GachaService';
import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  layout,
  shadows,
  spacing,
  textStyles,
  typography,
  withAlpha,
} from '@/theme';

import type { RootStackParamList } from '../../navigation/types';
import { CapsuleMachine, type CapsuleMachineRef } from './components/CapsuleMachine';
import { getRewardDisplayName, RewardPreview } from './components/RewardPreview';
import { TenResultOverlay } from './components/TenResultOverlay';
import { PHASE } from './gachaConstants';

type Props = NativeStackScreenProps<RootStackParamList, 'Gacha'>;

export function GachaScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const { data: status, isLoading } = useGachaStatusQuery();
  const drawMutation = useDrawMutation();

  const machineRef = useRef<CapsuleMachineRef>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentDrawType, setCurrentDrawType] = useState<'normal' | 'golden'>('normal');
  const [lastResults, setLastResults] = useState<DrawResultItem[]>([]);
  const [showTenOverlay, setShowTenOverlay] = useState(false);
  const [showSingleResult, setShowSingleResult] = useState(false);
  const pendingCountRef = useRef(0);

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Home' as never);
    }
  }, [navigation]);

  // ── Phase change handler ──────────────────────────────────────────────
  const handlePhaseChange = useCallback((phase: number) => {
    if (phase === PHASE.DONE) {
      setIsAnimating(false);
      if (pendingCountRef.current > 1) {
        setShowTenOverlay(true);
      } else {
        setShowSingleResult(true);
      }
    }
  }, []);

  // ── Draw handler ──────────────────────────────────────────────────────
  const handleDraw = useCallback(
    (drawType: 'normal' | 'golden', count: number) => {
      if (isAnimating || drawMutation.isPending) return;

      setCurrentDrawType(drawType);
      setLastResults([]);
      setShowSingleResult(false);
      setShowTenOverlay(false);
      pendingCountRef.current = count;

      if (!reducedMotion) {
        setIsAnimating(true);
        machineRef.current?.startAnimation(drawType, count);
      }

      drawMutation.mutate(
        { drawType, count },
        {
          onSuccess: (data) => {
            setLastResults(data.results);
            const rarities = data.results.map((r) => r.rarity);
            if (!reducedMotion) {
              machineRef.current?.setResults(rarities);
            } else {
              // Reduced motion: skip animation, show results directly
              if (count > 1) {
                setShowTenOverlay(true);
              } else {
                setShowSingleResult(true);
              }
            }
          },
          onError: (error: Error) => {
            setIsAnimating(false);
            machineRef.current?.cancelAnimation();
            toast.error(error.message || '抽奖失败，请稍后重试');
          },
        },
      );
    },
    [isAnimating, drawMutation, reducedMotion],
  );

  const handleCloseTenOverlay = useCallback(() => {
    setShowTenOverlay(false);
  }, []);

  const handleDismissSingleResult = useCallback(() => {
    setShowSingleResult(false);
  }, []);

  // ── Layout ────────────────────────────────────────────────────────────
  const headerHeight = insets.top + layout.headerPaddingV + 44;
  const bottomPanelHeight = 200;
  const machineWidth = screenWidth;
  const machineHeight = screenHeight - headerHeight - bottomPanelHeight - insets.bottom;

  const normalDraws = status?.normalDraws ?? 0;
  const goldenDraws = status?.goldenDraws ?? 0;
  const normalPity = status?.normalPity ?? 0;
  const goldenPity = status?.goldenPity ?? 0;
  const unlockedCount = status?.unlockedCount ?? 0;
  const totalItems = TOTAL_UNLOCKABLE_COUNT;
  const busy = isAnimating || drawMutation.isPending;

  // ── Loading ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <View style={[styles.header, { paddingTop: insets.top + layout.headerPaddingV }]}>
          <Button variant="icon" onPress={handleGoBack} accessibilityLabel="返回">
            <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
          </Button>
          <Text style={styles.headerTitle}>扭蛋抽奖</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + layout.headerPaddingV }]}>
        <Button variant="icon" onPress={handleGoBack} accessibilityLabel="返回">
          <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
        </Button>
        <Text style={styles.headerTitle}>扭蛋抽奖</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Machine area */}
      <View style={styles.machineArea}>
        <CapsuleMachine
          ref={machineRef}
          width={machineWidth}
          height={machineHeight}
          drawType={currentDrawType}
          onPhaseChange={handlePhaseChange}
        />
        {/* Single result overlay */}
        {showSingleResult && lastResults.length > 0 && (
          <Pressable style={styles.singleResultOverlay} onPress={handleDismissSingleResult}>
            <SingleResultCard item={lastResults[0]} />
            <Text style={styles.tapHint}>点击关闭</Text>
          </Pressable>
        )}
      </View>

      {/* Bottom panel: status + buttons */}
      <View
        style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, spacing.medium) }]}
      >
        {/* Status row */}
        <View style={styles.statusRow}>
          <TicketBadge icon="ticket-outline" count={normalDraws} label="普通" pity={normalPity} />
          <TicketBadge icon="star" count={goldenDraws} label="黄金" pity={goldenPity} golden />
          <View style={styles.progressMini}>
            <Text style={styles.progressMiniText}>
              {unlockedCount}/{totalItems}
            </Text>
          </View>
        </View>

        {/* Hint */}
        <Text style={styles.hintText}>注册送5普通+1黄金 · 每局+1普通 · 升级+1黄金</Text>

        {/* Button grid — 2×2 */}
        <View style={styles.buttonGrid}>
          <View style={styles.buttonRow}>
            <DrawButton
              label="普通 ×1"
              disabled={normalDraws < 1 || busy}
              onPress={() => handleDraw('normal', 1)}
            />
            <DrawButton
              label="普通 ×10"
              disabled={normalDraws < 10 || busy}
              onPress={() => handleDraw('normal', 10)}
            />
          </View>
          <View style={styles.buttonRow}>
            <DrawButton
              label="黄金 ×1"
              disabled={goldenDraws < 1 || busy}
              onPress={() => handleDraw('golden', 1)}
              golden
            />
            <DrawButton
              label="黄金 ×10"
              disabled={goldenDraws < 10 || busy}
              onPress={() => handleDraw('golden', 10)}
              golden
            />
          </View>
        </View>
      </View>

      {/* 10-pull result overlay */}
      {showTenOverlay && lastResults.length > 1 && (
        <TenResultOverlay
          results={lastResults}
          drawType={currentDrawType}
          onClose={handleCloseTenOverlay}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────────

function TicketBadge({
  icon,
  count,
  label,
  pity,
  golden,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  count: number;
  label: string;
  pity: number;
  golden?: boolean;
}) {
  return (
    <View style={[styles.ticketBadge, golden && styles.ticketBadgeGolden]}>
      <Ionicons name={icon} size={18} color={golden ? GOLDEN_BORDER : colors.textSecondary} />
      <Text style={styles.ticketBadgeCount}>{count}</Text>
      <Text style={styles.ticketBadgeLabel}>{label}</Text>
      <Text style={styles.ticketBadgePity}>
        保底 {pity}/{PITY_THRESHOLD}
      </Text>
    </View>
  );
}

function DrawButton({
  label,
  disabled,
  onPress,
  golden,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
  golden?: boolean;
}) {
  return (
    <Pressable
      style={[styles.drawBtn, golden && styles.drawBtnGolden, disabled && styles.drawBtnDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.drawBtnLabel, disabled && styles.drawBtnLabelDisabled]}>{label}</Text>
    </Pressable>
  );
}

const RARITY_COLORS: Record<string, string> = {
  legendary: '#FFD700',
  epic: '#A855F7',
  rare: '#3B82F6',
  common: '#9CA3AF',
};

const RARITY_LABELS: Record<string, string> = {
  legendary: '传说',
  epic: '史诗',
  rare: '稀有',
  common: '普通',
};

const REWARD_TYPE_LABELS: Record<string, string> = {
  avatar: '头像',
  frame: '头像框',
  seatFlair: '座位装饰',
  nameStyle: '名称样式',
};

const PREVIEW_SIZE_SINGLE = 120;

function SingleResultCard({ item }: { item: DrawResultItem }) {
  const rarityColor = RARITY_COLORS[item.rarity] ?? '#9CA3AF';
  const rarityLabel = RARITY_LABELS[item.rarity] ?? item.rarity;
  const typeLabel = REWARD_TYPE_LABELS[item.rewardType] ?? item.rewardType;
  const displayName = getRewardDisplayName(item.rewardType, item.rewardId);

  return (
    <View style={[styles.singleCard, { borderColor: rarityColor }]}>
      <View style={[styles.singleCardRarityBadge, { backgroundColor: rarityColor }]}>
        <Text style={styles.singleCardRarityText}>{rarityLabel}</Text>
      </View>
      {item.pityTriggered && <Text style={styles.singleCardPity}>保底</Text>}
      <View style={styles.singleCardPreview}>
        <RewardPreview
          rewardType={item.rewardType}
          rewardId={item.rewardId}
          size={PREVIEW_SIZE_SINGLE}
        />
      </View>
      <Text style={styles.singleCardName}>{displayName}</Text>
      <Text style={styles.singleCardType}>{typeLabel}</Text>
      {item.isNew && <Text style={styles.singleCardNew}>NEW</Text>}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────

// Golden button accent
const GOLDEN_BG = '#9A7500';
const GOLDEN_BORDER = '#FFD700';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.screenH,
    paddingVertical: layout.headerPaddingV,
    backgroundColor: colors.surface,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.border,
    zIndex: 10,
  },
  headerTitle: {
    flex: 1,
    fontSize: layout.headerTitleSize,
    lineHeight: layout.headerTitleLineHeight,
    fontWeight: typography.weights.bold,
    color: colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: componentSizes.icon.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  machineArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Single result overlay ──
  singleResultOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.medium,
  },
  singleCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.medium,
    borderWidth: 2,
    padding: spacing.large,
    alignItems: 'center',
    gap: spacing.small,
    minWidth: 200,
    ...shadows.md,
  },
  singleCardRarityBadge: {
    borderRadius: borderRadius.small,
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.tight,
  },
  singleCardRarityText: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.surface,
  },
  singleCardPity: {
    fontSize: typography.captionSmall,
    color: GOLDEN_BORDER,
    fontWeight: '600',
  },
  singleCardPreview: {
    marginVertical: spacing.small,
  },
  singleCardName: {
    ...textStyles.headingBold,
    color: colors.text,
  },
  singleCardType: {
    ...textStyles.caption,
    color: colors.textSecondary,
  },
  singleCardNew: {
    fontSize: typography.captionSmall,
    color: colors.success,
    fontWeight: '700',
  },
  tapHint: {
    ...textStyles.caption,
    color: colors.textMuted,
  },

  // ── Bottom panel ──
  bottomPanel: {
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.medium,
    gap: spacing.small,
    backgroundColor: colors.surface,
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.border,
  },
  statusRow: {
    flexDirection: 'row',
    gap: spacing.small,
    alignItems: 'center',
  },
  ticketBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.tight,
    backgroundColor: colors.background,
    borderRadius: borderRadius.small,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    padding: spacing.small,
  },
  ticketBadgeGolden: {
    borderColor: withAlpha(GOLDEN_BORDER, 0.3),
    backgroundColor: withAlpha(GOLDEN_BORDER, 0.06),
  },
  ticketBadgeCount: {
    ...textStyles.bodySemibold,
    color: colors.text,
    fontSize: 16,
  },
  ticketBadgeLabel: {
    ...textStyles.captionSmall,
    color: colors.textSecondary,
  },
  ticketBadgePity: {
    ...textStyles.captionSmall,
    color: colors.textMuted,
    marginLeft: 'auto',
  },
  progressMini: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.small,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    padding: spacing.small,
    paddingHorizontal: spacing.small,
  },
  progressMiniText: {
    ...textStyles.captionSmall,
    color: colors.textSecondary,
  },
  hintText: {
    ...textStyles.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },

  // ── Draw buttons ──
  buttonGrid: {
    gap: spacing.small,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  drawBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.medium,
    paddingVertical: spacing.medium,
    alignItems: 'center',
  },
  drawBtnGolden: {
    backgroundColor: GOLDEN_BG,
    borderWidth: 1,
    borderColor: withAlpha(GOLDEN_BORDER, 0.3),
  },
  drawBtnDisabled: {
    opacity: 0.35,
  },
  drawBtnLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.surface,
  },
  drawBtnLabelDisabled: {
    color: withAlpha(colors.surface, 0.5),
  },
});
