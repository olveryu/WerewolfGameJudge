/**
 * GachaScreen — 扭蛋抽奖主界面
 *
 * 上半区：Skia CapsuleMachine 动画（28 球物理 + 搅拌 + 掉落 + 碎裂）。
 * 下半区：TicketTabBar（双面板切换） + 大数字/pity + 抽奖按钮（primary/secondary）。
 * 单抽结果：SingleResultReveal（4 级稀有度分层演出）。
 * 10 连抽结果：TenResultOverlay（高稀有度延迟亮起 + 发光边框）。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PITY_THRESHOLD } from '@werewolf/game-engine/growth/gachaProbability';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { Button } from '@/components/Button';
import { ScreenHeader } from '@/components/ScreenHeader';
import { useAuthContext } from '@/contexts/AuthContext';
import { useDrawMutation, useGachaStatusQuery } from '@/hooks/queries/useGachaQuery';
import type { DrawResultItem } from '@/services/feature/GachaService';
import { colors, componentSizes, spacing, typography, withAlpha } from '@/theme';
import { createSharedStyles } from '@/theme/sharedStyles';

import type { RootStackParamList } from '../../navigation/types';
import { CapsuleMachine, type CapsuleMachineRef } from './components/CapsuleMachine';
import { DrawButton } from './components/DrawButton';
import { PityProgressBar } from './components/PityProgressBar';
import { SingleResultReveal } from './components/SingleResultReveal';
import { TenResultOverlay } from './components/TenResultOverlay';
import { TicketTabBar } from './components/TicketTabBar';
import { PHASE } from './gachaConstants';

type Props = NativeStackScreenProps<RootStackParamList, 'Gacha'>;

export function GachaScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const { user } = useAuthContext();
  const isAnon = !user || user.isAnonymous;
  const { data: status, isLoading } = useGachaStatusQuery();
  const { mutate: draw, isPending: isDrawPending } = useDrawMutation();

  const machineRef = useRef<CapsuleMachineRef>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [currentDrawType, setCurrentDrawType] = useState<'normal' | 'golden'>('normal');
  const [lastResults, setLastResults] = useState<DrawResultItem[]>([]);
  const [showTenOverlay, setShowTenOverlay] = useState(false);
  const [showSingleResult, setShowSingleResult] = useState(false);
  const [activeTab, setActiveTab] = useState<'normal' | 'golden'>('normal');
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
      if (isAnon) {
        navigation.navigate('AuthLogin', {
          loginTitle: '登录',
          loginSubtitle: '登录后即可抽奖',
        });
        return;
      }
      if (isAnimating || isDrawPending) return;

      setCurrentDrawType(drawType);
      setLastResults([]);
      setShowSingleResult(false);
      setShowTenOverlay(false);
      pendingCountRef.current = count;

      if (!reducedMotion) {
        setIsAnimating(true);
        machineRef.current?.startAnimation(drawType, count);
      }

      draw(
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
    [isAnon, isAnimating, draw, isDrawPending, reducedMotion, navigation],
  );

  const handleCloseTenOverlay = useCallback(() => {
    setShowTenOverlay(false);
  }, []);

  const handleDismissSingleResult = useCallback(() => {
    setShowSingleResult(false);
  }, []);

  // ── Layout ────────────────────────────────────────────────────────────
  const [machineLayout, setMachineLayout] = useState({ w: screenWidth, h: 0 });
  const handleMachineLayout = useCallback((e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    if (w > 0 && h > 0) setMachineLayout({ w, h });
  }, []);

  const machineWidth = machineLayout.w;
  const machineHeight = machineLayout.h;

  const normalDraws = status?.normalDraws ?? 0;
  const goldenDraws = status?.goldenDraws ?? 0;
  const normalPity = status?.normalPity ?? 0;
  const goldenPity = status?.goldenPity ?? 0;

  const busy = isAnimating || isDrawPending;

  // Auto-select tab: if current tab has 0 tickets and other has some, switch
  const handleTabSwitch = useCallback(
    (tab: 'normal' | 'golden') => {
      if (!busy) setActiveTab(tab);
    },
    [busy],
  );

  // Derive counts for active tab
  const isGoldenTab = activeTab === 'golden';
  const activeDraws = isGoldenTab ? goldenDraws : normalDraws;
  const activePity = isGoldenTab ? goldenPity : normalPity;
  const activeDrawType: 'normal' | 'golden' = activeTab;
  const multiCount = Math.min(10, activeDraws || 10);

  // ── Loading ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <ScreenHeader
          title="扭蛋抽奖"
          onBack={handleGoBack}
          topInset={insets.top}
          headerRight={
            <View style={styles.headerActions}>
              <Button
                variant="icon"
                onPress={() => navigation.navigate('Appearance', undefined)}
                accessibilityLabel="装扮"
              >
                <Ionicons name="shirt-outline" size={componentSizes.icon.lg} color={colors.text} />
              </Button>
              <Button
                variant="icon"
                onPress={() => navigation.navigate('Unlocks', undefined)}
                accessibilityLabel="收藏"
              >
                <Ionicons name="grid-outline" size={componentSizes.icon.lg} color={colors.text} />
              </Button>
            </View>
          }
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Header */}
      <ScreenHeader
        title="扭蛋抽奖"
        onBack={handleGoBack}
        topInset={insets.top}
        headerRight={
          <View style={styles.headerActions}>
            <Button
              variant="icon"
              onPress={() => navigation.navigate('Appearance', undefined)}
              accessibilityLabel="装扮"
            >
              <Ionicons name="shirt-outline" size={componentSizes.icon.lg} color={colors.text} />
            </Button>
            <Button
              variant="icon"
              onPress={() => navigation.navigate('Unlocks', undefined)}
              accessibilityLabel="收藏"
            >
              <Ionicons name="grid-outline" size={componentSizes.icon.lg} color={colors.text} />
            </Button>
          </View>
        }
      />

      {/* Machine area */}
      <View style={styles.machineArea} onLayout={handleMachineLayout}>
        {machineHeight > 0 && (
          <CapsuleMachine
            ref={machineRef}
            width={machineWidth}
            height={machineHeight}
            drawType={currentDrawType}
            onPhaseChange={handlePhaseChange}
          />
        )}
        {/* Single result overlay — 4-tier rarity presentation */}
        {showSingleResult && lastResults.length > 0 && (
          <SingleResultReveal
            item={lastResults[0]}
            onDismiss={handleDismissSingleResult}
            onGoEquip={() => {
              handleDismissSingleResult();
              navigation.navigate('Appearance', undefined);
            }}
            reducedMotion={reducedMotion}
          />
        )}
      </View>

      {/* Gradient transition */}
      <LinearGradient
        colors={[withAlpha(colors.background, 0), colors.background]}
        style={styles.gradientTransition}
      />

      {/* Bottom panel: tab bar + stats + draw buttons */}
      <View
        style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, spacing.medium) }]}
      >
        {/* Tab bar: shows both ticket counts */}
        <TicketTabBar
          activeTab={activeTab}
          normalCount={normalDraws}
          goldenCount={goldenDraws}
          onSwitch={handleTabSwitch}
          reducedMotion={reducedMotion}
        />

        {/* Card wrapper */}
        <View style={styles.card}>
          {/* Stats row: big count left + pity right */}
          <View style={styles.statsRow}>
            <View style={styles.bigCountWrap}>
              <Text
                style={[
                  styles.bigCount,
                  isGoldenTab && styles.bigCountGolden,
                  activeDraws === 0 && styles.bigCountZero,
                ]}
              >
                {activeDraws}
              </Text>
              <Text style={[styles.countUnit, isGoldenTab && styles.countUnitGolden]}>张</Text>
            </View>
            <View style={styles.pitySection}>
              <Text style={styles.pityLabel}>距离保底</Text>
              <PityProgressBar
                pity={activePity}
                threshold={PITY_THRESHOLD}
                golden={isGoldenTab}
                reducedMotion={reducedMotion}
              />
            </View>
          </View>

          {/* Draw buttons — vertical stack: ×10 primary + ×1 secondary */}
          <View style={styles.buttonStack}>
            <DrawButton
              label={`${isGoldenTab ? '⭐ ' : '✨ '}抽 ×${isAnon ? 10 : multiCount}`}
              disabled={!isAnon && (activeDraws < 2 || busy)}
              onPress={() => handleDraw(activeDrawType, isAnon ? 10 : multiCount)}
              golden={isGoldenTab}
              multiPull
              multiPullCount={isAnon ? undefined : activeDraws}
              reducedMotion={reducedMotion}
            />
            <DrawButton
              label="抽 ×1"
              disabled={!isAnon && (activeDraws < 1 || busy)}
              onPress={() => handleDraw(activeDrawType, 1)}
              golden={isGoldenTab}
              variant="secondary"
              reducedMotion={reducedMotion}
            />
          </View>

          {/* Hint */}
          <Text style={styles.metaHint}>每局+1普通 · 升级+1黄金</Text>
        </View>
      </View>

      {/* 10-pull result overlay */}
      {showTenOverlay && lastResults.length > 1 && (
        <TenResultOverlay
          results={lastResults}
          drawType={currentDrawType}
          onClose={handleCloseTenOverlay}
          onGoEquip={() => {
            handleCloseTenOverlay();
            navigation.navigate('Appearance', undefined);
          }}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Panel Colors ───────────────────────────────────────────────────────

const GOLDEN_COUNT_COLOR = '#B8860B';

// ─── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  machineArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    overflow: 'hidden',
  },

  // ── Gradient transition ──
  gradientTransition: {
    height: 32,
    pointerEvents: 'none',
  },

  // ── Bottom panel ──
  bottomPanel: {
    paddingHorizontal: spacing.screenH,
    gap: spacing.medium,
    backgroundColor: colors.background,
  },
  card: {
    ...createSharedStyles(colors).cardBase,
    gap: spacing.medium,
  },

  // ── Stats row ──
  statsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bigCountWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.micro,
  },
  bigCount: {
    fontSize: typography.display + 12,
    fontWeight: typography.weights.bold,
    color: colors.text,
    lineHeight: typography.display + 14,
    fontVariant: ['tabular-nums'],
    letterSpacing: typography.letterSpacing.hero,
  },
  bigCountGolden: {
    color: GOLDEN_COUNT_COLOR,
  },
  bigCountZero: {
    opacity: 0.25,
  },
  countUnit: {
    fontSize: typography.secondary,
    color: colors.textMuted,
    fontWeight: typography.weights.medium,
  },
  countUnitGolden: {
    color: withAlpha(GOLDEN_COUNT_COLOR, 0.5),
  },

  // ── Pity ──
  pitySection: {
    alignItems: 'flex-end',
    gap: spacing.tight,
    flex: 1,
    maxWidth: 120,
  },
  pityLabel: {
    fontSize: typography.captionSmall,
    color: colors.textMuted,
  },

  // ── Draw buttons ──
  buttonStack: {
    gap: spacing.small,
  },

  // ── Header / Meta ──
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.small,
  },
  metaHint: {
    fontSize: typography.captionSmall,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
