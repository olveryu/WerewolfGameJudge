/**
 * GachaScreen — 扭蛋抽奖主界面
 *
 * 上半区：Skia CapsuleMachine 动画（28 球物理 + 搅拌 + 掉落 + 碎裂）。
 * 下半区：渐变过渡 + 券数展示（TicketDisplay） + 抽奖按钮（DrawButton）。
 * 单抽结果：SingleResultReveal（4 级稀有度分层演出）。
 * 10 连抽结果：TenResultOverlay（高稀有度延迟亮起 + 发光边框）。
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PITY_THRESHOLD, TOTAL_UNLOCKABLE_COUNT } from '@werewolf/game-engine';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  type LayoutChangeEvent,
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
import { ScreenHeader } from '@/components/ScreenHeader';
import { useDrawMutation, useGachaStatusQuery } from '@/hooks/queries/useGachaQuery';
import type { DrawResultItem } from '@/services/feature/GachaService';
import { colors, componentSizes, spacing, textStyles, typography, withAlpha } from '@/theme';

import type { RootStackParamList } from '../../navigation/types';
import { CapsuleMachine, type CapsuleMachineRef } from './components/CapsuleMachine';
import { DrawButton } from './components/DrawButton';
import { SingleResultReveal } from './components/SingleResultReveal';
import { TenResultOverlay } from './components/TenResultOverlay';
import { TicketDisplay } from './components/TicketDisplay';
import { PHASE } from './gachaConstants';

type Props = NativeStackScreenProps<RootStackParamList, 'Gacha'>;

export function GachaScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
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
  const unlockedCount = status?.unlockedCount ?? 0;
  const totalItems = TOTAL_UNLOCKABLE_COUNT;
  const busy = isAnimating || drawMutation.isPending;

  // ── Loading ───────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <ScreenHeader
          title="扭蛋抽奖"
          onBack={handleGoBack}
          topInset={insets.top}
          headerRight={
            <Button
              variant="icon"
              onPress={() => navigation.navigate('Unlocks', undefined)}
              accessibilityLabel="收藏"
            >
              <Ionicons name="grid-outline" size={componentSizes.icon.lg} color={colors.text} />
            </Button>
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
          <Button
            variant="icon"
            onPress={() => navigation.navigate('Unlocks', undefined)}
            accessibilityLabel="收藏"
          >
            <Ionicons name="grid-outline" size={componentSizes.icon.lg} color={colors.text} />
          </Button>
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
            reducedMotion={reducedMotion}
          />
        )}
      </View>

      {/* Gradient transition (replaces hard border) */}
      <LinearGradient
        colors={[withAlpha(colors.background, 0), colors.surface]}
        style={styles.gradientTransition}
        pointerEvents="none"
      />

      {/* Bottom panel: ticket displays + draw buttons */}
      <View
        style={[styles.bottomPanel, { paddingBottom: Math.max(insets.bottom, spacing.medium) }]}
      >
        {/* Ticket displays */}
        <View style={styles.ticketRow}>
          <TicketDisplay
            count={normalDraws}
            label="普通"
            pity={normalPity}
            pityThreshold={PITY_THRESHOLD}
            reducedMotion={reducedMotion}
          />
          <TicketDisplay
            count={goldenDraws}
            label="黄金"
            pity={goldenPity}
            pityThreshold={PITY_THRESHOLD}
            golden
            reducedMotion={reducedMotion}
          />
        </View>

        {/* Hint + Collection link */}
        <View style={styles.hintRow}>
          <Text style={styles.hintText}>注册送5普通+1黄金 · 每局+1普通 · 升级+1黄金</Text>
          <Pressable
            style={styles.collectionLink}
            onPress={() => navigation.navigate('Unlocks', undefined)}
          >
            <Text style={styles.collectionText}>
              {unlockedCount}/{totalItems}
            </Text>
            <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />
          </Pressable>
        </View>

        {/* Draw buttons — 2×2 grid with material design */}
        <View style={styles.buttonGrid}>
          <View style={styles.buttonRow}>
            <DrawButton
              label="普通 ×1"
              disabled={normalDraws < 1 || busy}
              onPress={() => handleDraw('normal', 1)}
              reducedMotion={reducedMotion}
            />
            <DrawButton
              label={`普通 ×${Math.min(10, normalDraws)}`}
              disabled={normalDraws < 2 || busy}
              onPress={() => handleDraw('normal', Math.min(10, normalDraws))}
              multiPull
              multiPullCount={normalDraws}
              reducedMotion={reducedMotion}
            />
          </View>
          <View style={styles.buttonRow}>
            <DrawButton
              label="黄金 ×1"
              disabled={goldenDraws < 1 || busy}
              onPress={() => handleDraw('golden', 1)}
              golden
              reducedMotion={reducedMotion}
            />
            <DrawButton
              label={`黄金 ×${Math.min(10, goldenDraws)}`}
              disabled={goldenDraws < 2 || busy}
              onPress={() => handleDraw('golden', Math.min(10, goldenDraws))}
              golden
              multiPull
              multiPullCount={goldenDraws}
              reducedMotion={reducedMotion}
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
  },

  // ── Bottom panel ──
  bottomPanel: {
    paddingHorizontal: spacing.screenH,
    gap: spacing.small,
    backgroundColor: colors.surface,
  },
  ticketRow: {
    flexDirection: 'row',
    gap: spacing.small,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hintText: {
    ...textStyles.caption,
    color: colors.textMuted,
    flex: 1,
  },
  collectionLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
    paddingVertical: spacing.tight,
    paddingLeft: spacing.small,
  },
  collectionText: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.semibold,
    color: colors.textMuted,
    fontVariant: ['tabular-nums'],
  },

  // ── Draw buttons ──
  buttonGrid: {
    gap: spacing.small,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.small,
  },
});
