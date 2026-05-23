/**
 * ChainShatter - 锁链击碎揭示动画（Canvas 2D + Reanimated 4）
 *
 * 视觉设计：中央锁头（金属蓝钢渐变锁身 + 铆钉 + 高光提梁 + 钥匙孔光晕）
 * + 左右各 4 个链环。背景飘浮尘埃粒子增加氛围。
 * 交互：连续点击击碎（6 次），每击产生：
 *   - 累积可见裂纹（gold→red 渐变）+ glow 光晕
 *   - 径向火花粒子（8-12 个 gold/orange/white）
 *   - 扩散冲击环
 *   - 屏幕抖动 + 冲击闪光
 * 连击机制：>800ms 未击则连击数回退 1。
 * 全碎后不规则多边形碎片带旋转 + 重力爆炸 + 径向光环扩散。
 *
 * Canvas DOM Component 负责：锁头 + 链环 + 裂纹 + 火花 + 冲击环 + 碎片 + 尘埃 + 火把火焰。
 * Reanimated 负责：容器动画（抖动、缩放、透明度）+ 阶段切换。
 * 不 import service，不含业务逻辑。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { AlignmentRevealOverlay } from '@/components/RoleRevealEffects/common/AlignmentRevealOverlay';
import { AtmosphericBackground } from '@/components/RoleRevealEffects/common/effects/AtmosphericBackground';
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
import { colors, crossPlatformTextShadow } from '@/theme';

import ChainShatterCanvas from './ChainShatterCanvas';

// ─── Visual constants ──────────────────────────────────────────────────
const BG_GRADIENT = ['#050510', '#0a0a1e', '#050510'] as const;

const COLORS = {
  breakFlash: 'rgba(255, 210, 100, 0.5)',
  hitText: '#FFD700',
  comboText: 'rgba(255, 200, 0, 0.7)',
  stoneWall: 'rgba(50, 45, 40, 0.7)',
  stoneWallBorder: 'rgba(80, 70, 60, 0.5)',
  lightPillar: 'rgba(255, 215, 0, 0.6)',
  springColor: 'rgba(160, 170, 180, 0.6)',
} as const;

const CS = CONFIG.chainShatter;
const SPARKS_PER_HIT = 10;
const SPARK_PALETTE = ['#FFD700', '#FFA500', '#FFFFFF', '#FFE066', '#FF8C00'];

// ─── Types ──────────────────────────────────────────────────────────────
interface CrackData {
  x: number;
  y: number;
  angle: number;
  length: number;
  hitIndex: number;
}

interface SparkBurstData {
  id: number;
  sparks: Array<{ vx: number; vy: number; color: string; size: number }>;
  time: number;
}

// ─── Helpers ────────────────────────────────────────────────────────────
function createStoneBlocks(screenW: number, screenH: number) {
  return Array.from({ length: 6 }, (_, i) => ({
    x: (i % 3) * (screenW / 3),
    y: screenH * 0.3 + Math.floor(i / 3) * 80,
    w: screenW / 3 - 4,
    h: 70,
  }));
}

function createTorchPositions(screenW: number, screenH: number) {
  return [
    { x: 20, y: screenH * 0.3 },
    { x: screenW - 50, y: screenH * 0.35 },
  ];
}

function generateSparks(count: number): SparkBurstData['sparks'] {
  const sparks: SparkBurstData['sparks'] = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 60 + Math.random() * 100;
    sparks.push({
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 40,
      color: SPARK_PALETTE[i % SPARK_PALETTE.length]!,
      size: 2 + Math.random() * 3,
    });
  }
  return sparks;
}

// ─── Main component ─────────────────────────────────────────────────────
type Phase = 'appear' | 'idle' | 'hitting' | 'shatter' | 'revealed';

export const ChainShatter: React.FC<RoleRevealEffectProps> = ({
  role,
  onComplete,
  reducedMotion = false,
  enableHaptics = true,
  testIDPrefix = 'chain-shatter',
}) => {
  const alignmentThemes = useMemo(() => createAlignmentThemes(colors), []);
  const theme = alignmentThemes[role.alignment];

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const torchPositions = useMemo(
    () => createTorchPositions(screenWidth, screenHeight),
    [screenWidth, screenHeight],
  );
  const stoneBlocks = useMemo(
    () => createStoneBlocks(screenWidth, screenHeight),
    [screenWidth, screenHeight],
  );
  const common = CONFIG.common;
  const cardWidth = Math.min(screenWidth * common.cardWidthRatio, common.cardMaxWidth);
  const cardHeight = cardWidth * common.cardAspectRatio;

  const cx = screenWidth / 2;
  const cy = screenHeight / 2;
  const lockW = screenWidth * CS.lockWidthRatio;
  const lockH = lockW * 0.8;

  const [phase, setPhase] = useState<Phase>('appear');
  const [cracks, setCracks] = useState<CrackData[]>([]);
  const [sparkBursts, setSparkBursts] = useState<SparkBurstData[]>([]);
  const [shatterStartTime, setShatterStartTime] = useState(0);
  const hitCountRef = useRef(0);
  const [hitCountDisplay, setHitCountDisplay] = useState(0);
  const lastHitTimeRef = useRef(0);
  const shatterTriggeredRef = useRef(false);
  const sparkIdRef = useRef(0);
  const { fireComplete } = useRevealLifecycle({ onComplete });

  // ── Shared values (view animations only) ──
  const [chainOpacity, setChainOpacity] = useState(0);
  const [chainScale, setChainScale] = useState(0);
  const [hitFlashOpacity, setHitFlashOpacity] = useState(0);
  const [canvasOpacity, setCanvasOpacity] = useState(1);
  const [cardScale, setCardScale] = useState(0);
  const [cardOpacity, setCardOpacity] = useState(0);
  const [flashOpacity, setFlashOpacity] = useState(0);
  const [shakeX, setShakeX] = useState(0);
  const [shakeY, setShakeY] = useState(0);
  const [comboOpacity, setComboOpacity] = useState(0);
  const [comboScale, setComboScale] = useState(1);
  const [lightPillarOpacity, setLightPillarOpacity] = useState(0);
  const [lightPillarScale, setLightPillarScale] = useState(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const schedule = useCallback((fn: () => void, delay: number) => {
    const id = setTimeout(fn, delay);
    timersRef.current.push(id);
    return id;
  }, []);

  // ── Phase transitions ──
  const enterRevealed = useCallback(() => setPhase('revealed'), []);

  // ── Appear animation ──
  useEffect(() => {
    if (reducedMotion) {
      setCardScale(1);
      setCardOpacity(1);
      setCanvasOpacity(0);
      setPhase('revealed');
      return;
    }

    setChainOpacity(1);
    setChainScale(1);
    schedule(() => setPhase('idle'), CS.chainAppearDuration);

    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [reducedMotion, schedule]);

  // ── Trigger final shatter ──
  const triggerShatter = useCallback(() => {
    if (shatterTriggeredRef.current) return;
    shatterTriggeredRef.current = true;

    setPhase('shatter');
    setShatterStartTime(performance.now());
    if (enableHaptics) void triggerHaptic('heavy', true);

    // Screen flash
    setFlashOpacity(0.7);
    schedule(() => setFlashOpacity(0), 80);

    // Fade canvas
    schedule(() => setCanvasOpacity(0), 400);

    // Card reveal
    schedule(() => {
      setCardScale(1);
      setCardOpacity(1);
      schedule(enterRevealed, CS.cardRevealDuration);
    }, 500);

    // Freedom light pillar
    schedule(() => {
      setLightPillarScale(1);
      setLightPillarOpacity(0.8);
      schedule(() => setLightPillarOpacity(0), 300);
    }, 300);
  }, [enableHaptics, enterRevealed, schedule]);

  // ── Auto-timeout (warning + 8s auto-shatter) ──
  const autoTimeoutWarning = useAutoTimeout(
    phase === 'idle' || phase === 'hitting',
    triggerShatter,
  );

  // ── Handle hit ──
  const handlePress = useCallback(() => {
    if (phase !== 'idle' && phase !== 'hitting') return;

    const now = Date.now();
    let current = hitCountRef.current;

    // Combo decay: too slow → lose 1 hit
    if (current > 0 && now - lastHitTimeRef.current > CS.comboTimeout) {
      current = Math.max(0, current - 1);
    }

    current++;
    hitCountRef.current = current;
    lastHitTimeRef.current = now;
    setHitCountDisplay(current);

    if (phase === 'idle') setPhase('hitting');
    if (enableHaptics) void triggerHaptic('medium', true);

    // Add persistent crack near lock center
    const newCrack: CrackData = {
      x: cx + (Math.random() - 0.5) * lockW * 0.6,
      y: cy + (Math.random() - 0.5) * lockH * 0.6,
      angle: Math.random() * Math.PI * 2,
      length: lockW * 0.2 + Math.random() * lockW * 0.4,
      hitIndex: current - 1,
    };
    setCracks((prev) => [...prev, newCrack]);

    // Spawn spark burst with timestamp
    const newSparks = generateSparks(SPARKS_PER_HIT);
    const sparkId = sparkIdRef.current++;
    setSparkBursts((prev) => [
      ...prev.slice(-5),
      { sparks: newSparks, id: sparkId, time: performance.now() },
    ]);

    // Combo indicator pop
    setComboScale(1.4);
    setComboOpacity(0.8);
    schedule(() => setComboScale(1), 80);
    schedule(() => setComboOpacity(0), CS.comboTimeout);

    // Hit flash
    setHitFlashOpacity(0.35);
    schedule(() => setHitFlashOpacity(0), 40);

    // Shake (X + Y for more dynamic feel)
    const intensity = Math.min(current / CS.requiredHits, 1);
    const amp = 6 + intensity * 8;
    setShakeX(-amp);
    setShakeY(-amp * 0.5);
    schedule(() => {
      setShakeX(amp);
      setShakeY(amp * 0.3);
    }, 25);
    schedule(() => {
      setShakeX(-amp * 0.5);
      setShakeY(0);
    }, 50);
    schedule(() => setShakeX(0), 75);

    // All hits done → shatter
    if (current >= CS.requiredHits) {
      schedule(triggerShatter, 200);
    }
  }, [phase, enableHaptics, cx, cy, lockW, lockH, triggerShatter, schedule]);

  // ── Computed styles with CSS transitions ──
  const chainContainerStyle = {
    transform: [{ scale: chainScale }, { translateX: shakeX }, { translateY: shakeY }],
    opacity: chainOpacity,
    transitionProperty: 'opacity, transform',
    transitionDuration: `${CS.chainAppearDuration}ms`,
    transitionTimingFunction: 'cubic-bezier(0.34, 1.3, 0.64, 1)',
  } as never;

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
    transitionDuration: `${CS.cardRevealDuration}ms`,
    transitionTimingFunction: 'cubic-bezier(0.34, 1.3, 0.64, 1)',
  } as never;

  const flashStyle = {
    opacity: flashOpacity,
    transitionProperty: 'opacity',
    transitionDuration: '80ms',
    transitionTimingFunction: 'ease-out',
  } as never;

  const hitFlashStyle = {
    opacity: hitFlashOpacity,
    transitionProperty: 'opacity',
    transitionDuration: '40ms',
  } as never;

  const comboStyle = {
    opacity: comboOpacity,
    transform: [{ scale: comboScale }],
    transitionProperty: 'opacity, transform',
    transitionDuration: '80ms',
  } as never;

  const lightPillarStyle = {
    opacity: lightPillarOpacity,
    transform: [{ scaleY: lightPillarScale }],
    transitionProperty: 'opacity, transform',
    transitionDuration: '500ms',
    transitionTimingFunction: 'cubic-bezier(0.33, 1, 0.68, 1)',
  } as never;

  const hitsRemaining = Math.max(0, CS.requiredHits - hitCountDisplay);

  // Canvas phase mapping (hide after shatter fades)
  const canvasPhase = phase === 'revealed' ? 'hidden' : phase === 'shatter' ? 'shatter' : phase;

  return (
    <View style={styles.container} testID={`${testIDPrefix}-container`}>
      {/* Immersive dark background */}
      <LinearGradient
        colors={[...BG_GRADIENT]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />
      <AtmosphericBackground color={theme.primaryColor} animate={!reducedMotion} />

      {/* Stone wall blocks in background */}
      {!reducedMotion && (
        <View style={styles.absoluteFillNoEvents}>
          {stoneBlocks.map((block, i) => (
            <View
              key={`stone-${i}`}
              style={[
                styles.stoneBlock,
                { left: block.x + 2, top: block.y, width: block.w, height: block.h },
              ]}
            />
          ))}
        </View>
      )}

      {/* Wall torch brackets */}
      {!reducedMotion &&
        torchPositions.map((torch, i) => (
          <View
            key={`torch-bracket-${i}`}
            style={[styles.torch, { left: torch.x + 8, top: torch.y + 30 }]}
          >
            <Text style={styles.torchBracket}>🔩</Text>
          </View>
        ))}

      {/* Pressable overlay for tap interaction */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handlePress}
        testID={`${testIDPrefix}-tap-area`}
      >
        <View style={[StyleSheet.absoluteFill, canvasContainerStyle]}>
          <View style={[StyleSheet.absoluteFill, chainContainerStyle]}>
            {/* Canvas 2D: lock + chains + cracks + sparks + dust + torches + shards */}
            <ChainShatterCanvas
              dom={{ style: { flex: 1 } }}
              width={screenWidth}
              height={screenHeight}
              phase={canvasPhase}
              hitCount={hitCountDisplay}
              requiredHits={CS.requiredHits}
              lockWidthRatio={CS.lockWidthRatio}
              cracks={cracks}
              sparkBursts={sparkBursts}
              shatterStartTime={shatterStartTime}
              shatterDuration={CS.shatterDuration}
            />

            {/* Hit counter inside shake container */}
            {(phase === 'idle' || phase === 'hitting') && (
              <View style={[styles.centeredOverlay, { top: cy + lockH / 2 + 30 }]}>
                <Text style={styles.hitCounterText}>
                  {hitCountDisplay} / {CS.requiredHits}
                </Text>
              </View>
            )}

            {/* Combo indicator (× N above lock, pops + fades) */}
            {phase === 'hitting' && hitCountDisplay > 0 && (
              <View
                style={[
                  styles.centeredOverlay,
                  comboStyle,
                  { top: cy - lockH / 2 - lockW * 0.3 - 40 },
                ]}
              >
                <Text style={styles.comboText}>× {hitCountDisplay}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Hit flash overlay */}
        <View style={[styles.flash, hitFlashStyle, { backgroundColor: COLORS.breakFlash }]} />

        {/* Screen flash */}
        <View style={[styles.flash, flashStyle, { backgroundColor: theme.glowColor }]} />
      </Pressable>

      {/* Hint text */}
      <HintWithWarning
        hintText={
          phase === 'appear'
            ? '⛓️ 锁链封印中'
            : phase === 'idle' || phase === 'hitting'
              ? `⛓️ 连续点击击碎锁链${hitsRemaining > 0 ? `（剩 ${hitsRemaining} 次）` : ''}`
              : phase === 'shatter'
                ? '💥 锁链已碎！'
                : null
        }
        showWarning={autoTimeoutWarning}
      />

      {/* Exposed spring coils (visible through cracks during hitting) */}
      {phase === 'hitting' && hitCountDisplay >= 3 && (
        <View style={styles.springContainer}>
          <Text style={styles.springText}>⌇⌇⌇</Text>
        </View>
      )}

      {/* Freedom light pillar (on shatter/reveal) */}
      {(phase === 'shatter' || phase === 'revealed') && (
        <View style={[styles.lightPillar, lightPillarStyle]} />
      )}

      {/* Revealed card */}
      {(phase === 'shatter' || phase === 'revealed') && (
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
  absoluteFillNoEvents: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  flash: { ...StyleSheet.absoluteFillObject, pointerEvents: 'none' },
  centeredOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    pointerEvents: 'none',
  },
  hitCounterText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.hitText,
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.8)', 0, 1, 6),
  },
  comboText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.comboText,
    ...crossPlatformTextShadow('rgba(0, 0, 0, 0.9)', 0, 2, 8),
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
  stoneBlock: {
    position: 'absolute',
    backgroundColor: COLORS.stoneWall,
    borderWidth: 1,
    borderColor: COLORS.stoneWallBorder,
    borderRadius: 2,
  },
  torch: {
    position: 'absolute',
    alignItems: 'center',
    zIndex: 2,
    pointerEvents: 'none',
  },
  torchBracket: {
    fontSize: 14,
    marginTop: -4,
  },
  springContainer: {
    position: 'absolute',
    alignSelf: 'center',
    top: '48%',
    zIndex: 3,
    pointerEvents: 'none',
  },
  springText: {
    fontSize: 18,
    color: COLORS.springColor,
    letterSpacing: 4,
  },
  lightPillar: {
    position: 'absolute',
    alignSelf: 'center',
    top: 0,
    width: 40,
    height: '100%',
    backgroundColor: COLORS.lightPillar,
    zIndex: 1,
    pointerEvents: 'none',
  },
});
