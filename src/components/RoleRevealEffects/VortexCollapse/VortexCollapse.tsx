/**
 * VortexCollapse - 虚空坍缩揭示动画（Canvas 2D + CSS Transitions）
 *
 * 视觉设计：星际穿越 / 黑洞风格 — 深空背景 + 星云 + 旋涡中心 + 事件视界 +
 * 螺旋臂 + 轨道粒子 + 碎片 + 进度环 + 坍缩爆炸粒子。
 * 交互：画圈手势驱动旋转加速，spin 累计达 100% → 临界坍缩 → 爆发揭示。
 *
 * Canvas DOM 组件自管理视觉 + 画圈交互。
 * 不 import service，不含业务逻辑。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AlignmentRevealOverlay } from '@/components/RoleRevealEffects/common/AlignmentRevealOverlay';
import { RevealBurst } from '@/components/RoleRevealEffects/common/effects/RevealBurst';
import { HintWithWarning } from '@/components/RoleRevealEffects/common/HintWithWarning';
import { RoleCardContent } from '@/components/RoleRevealEffects/common/RoleCardContent';
import { CONFIG } from '@/components/RoleRevealEffects/config';
import {
  useAutoTimeout,
  useRevealLifecycle,
} from '@/components/RoleRevealEffects/hooks/useRevealLifecycle';
import type { RoleRevealEffectProps } from '@/components/RoleRevealEffects/types';
import { createAlignmentThemes } from '@/components/RoleRevealEffects/types';
import { triggerHaptic } from '@/components/RoleRevealEffects/utils/haptics';
import { colors } from '@/theme';

import VortexCollapseCanvas from './VortexCollapseCanvas';

// ─── Visual constants ──────────────────────────────────────────────────
const BG_GRADIENT = ['#030008', '#050012', '#030008'] as const;
const VC = CONFIG.vortexCollapse;

// ─── Types ──────────────────────────────────────────────────────────────
type Phase = 'atmosphere' | 'idle' | 'collapse' | 'revealed';

// ─── Main component ─────────────────────────────────────────────────────

export const VortexCollapse: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'vortex-collapse',
}) => {
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), []);
  const theme = alignmentThemes[role.alignment];

  const { width: screenW, height: screenH } = useWindowDimensions();
  const common = CONFIG.common;
  const cardWidth = Math.min(screenW * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  const [phase, setPhase] = useState<Phase>('atmosphere');
  const { fireComplete } = useRevealLifecycle({
    onComplete,
    revealHoldDurationMs: VC.revealHoldDuration,
  });

  // ── Animation state ──
  const [canvasOpacity, setCanvasOpacity] = useState(1);
  const [cardScale, setCardScale] = useState(0);
  const [cardOpacity, setCardOpacity] = useState(0);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  const doCollapse = useCallback(() => {
    setPhase('collapse');
    if (enableHaptics) void triggerHaptic('heavy', true);

    // Flash sequence: 0 → 0.8 → 0
    setFlashOpacity(0.8);
    schedule(() => setFlashOpacity(0), 100);

    // Fade canvas after 200ms
    schedule(() => setCanvasOpacity(0), 200);

    // Card reveal after delay
    schedule(() => {
      setCardScale(1);
      setCardOpacity(1);
      schedule(enterRevealed, VC.cardRevealDuration);
    }, VC.cardRevealDelay);
  }, [enableHaptics, enterRevealed, schedule]);

  // ── Init ──
  useEffect(() => {
    if (reducedMotion) {
      setCardScale(1);
      setCardOpacity(1);
      setCanvasOpacity(0);
      setPhase('revealed');
      return;
    }

    // Atmosphere → idle
    const timer = setTimeout(() => setPhase('idle'), VC.atmosphereDuration);
    const timers = timersRef.current;
    return () => {
      clearTimeout(timer);
      timers.forEach(clearTimeout);
    };
  }, [reducedMotion]);

  // ── Auto-timeout ──
  const autoTrigger = useCallback(() => {
    doCollapse();
  }, [doCollapse]);
  const autoTimeoutWarning = useAutoTimeout(phase === 'idle', autoTrigger);

  // ── Canvas collapse handler ──
  const handleCanvasCollapse = useCallback(() => {
    doCollapse();
  }, [doCollapse]);

  // ── Computed styles with CSS transitions ──
  const canvasContainerStyle = {
    opacity: canvasOpacity,
    transitionProperty: 'opacity',
    transitionDuration: '400ms',
    transitionTimingFunction: 'ease-out',
  } as never;

  const cardStyle = {
    transform: [{ scale: cardScale }],
    opacity: cardOpacity,
    transitionProperty: 'opacity, transform',
    transitionDuration: `${VC.cardRevealDuration}ms`,
    transitionTimingFunction: 'cubic-bezier(0.34, 1.3, 0.64, 1)',
  } as never;

  const flashStyle = {
    opacity: flashOpacity,
    transitionProperty: 'opacity',
    transitionDuration: '100ms',
    transitionTimingFunction: 'ease-out',
  } as never;

  return (
    <View style={styles.container} testID={`${testIDPrefix}-container`}>
      {/* Deep space background */}
      <LinearGradient
        colors={[...BG_GRADIENT]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Canvas overlay: vortex + interaction */}
      <View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
        <VortexCollapseCanvas
          dom={{ style: { flex: 1 } }}
          width={screenW}
          height={screenH}
          phase={phase === 'revealed' ? 'hidden' : phase}
          onCollapse={handleCanvasCollapse}
        />
      </View>

      {/* Flash overlay */}
      <View style={[styles.flash, flashStyle]} />

      {/* Hint */}
      <HintWithWarning
        hintText={
          phase === 'atmosphere'
            ? '🌀 虚空凝聚中…'
            : phase === 'idle'
              ? '🌀 画圈加速旋转漩涡'
              : phase === 'collapse'
                ? '💥 虚空坍缩！'
                : null
        }
        showWarning={autoTimeoutWarning}
      />

      {/* Revealed card */}
      {(phase === 'collapse' || phase === 'revealed') && (
        <View style={[styles.cardWrapper, cardStyle]}>
          <View style={styles.cardInner}>
            <RoleCardContent
              roleId={role.id as RoleId}
              width={cardWidth}
              height={cardHeight}
              revealMode
              revealGradient={theme.revealGradient}
              animateEntrance={phase === 'revealed'}
            />
            <RevealBurst trigger={phase === 'revealed'} color={theme.glowColor} />
            {phase === 'revealed' && (
              <AlignmentRevealOverlay
                alignment={role.alignment}
                theme={theme}
                cardWidth={cardWidth}
                cardHeight={cardHeight}
                animate={!reducedMotion}
                onComplete={fireComplete}
              />
            )}
          </View>
        </View>
      )}
    </View>
  );
};

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  flash: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
    backgroundColor: 'rgba(150,100,255,0.8)',
  },
  cardWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInner: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
});
