/**
 * CardPick: face-down cards spread over a card table; the player picks one, it flies to the
 * center and flips over to show the role. Cards dealt to other players leave the table live.
 *
 * The old Skia layer (chips, charge aura, light sweep) sat beneath the cards; it is DOM here so
 * it stays beneath them.
 */
import { shuffleArray } from '@game-judge/game-engine/platform/random';
import { type CSSProperties, useEffect, useRef, useState } from 'react';

import { Easing, withDelay, withRepeat, withSequence, withTiming } from '@/scene/timeline';

import { HintWithWarning } from '../common/HintWithWarning';
import { RevealedCard } from '../common/RevealedCard';
import { CONFIG } from '../config';
import { useAutoTimeout, useRevealLifecycle } from '../hooks/useRevealLifecycle';
import {
  interpolate,
  type SharedValue,
  useFrameStyle,
  useRevealCardSize,
  useSharedValue,
  useViewportSize,
} from '../runtime';
import { ALIGNMENT_THEMES } from '../themes';
import type { RevealEffectProps } from '../types';

const TABLE_COLORS = {
  felt: 'linear-gradient(180deg, #e6dfd5 0%, #f0ebe3 50%, #e6dfd5 100%)',
  cardBack: 'linear-gradient(135deg, #f5f1eb 0%, #faf7f2 50%, #f5f1eb 100%)',
  accent: '#8b7355',
  accentLight: '#b8a080',
  symbol: '♠',
  woodDark: '#5a3a1e',
  woodLight: '#8b6914',
  chipRed: '#cc3333',
  chipBlue: '#3366aa',
  chipGold: '#d4af37',
  chipGreen: '#338844',
  chargeAura: '#d4af37',
  lightBar: '#ffffff',
} as const;

const CP = CONFIG.cardPick;

function createTableChips(screenW: number, screenH: number) {
  return [
    { x: screenW * 0.08, y: screenH * 0.15, r: 8, color: TABLE_COLORS.chipRed },
    { x: screenW * 0.92, y: screenH * 0.2, r: 7, color: TABLE_COLORS.chipBlue },
    { x: screenW * 0.15, y: screenH * 0.82, r: 9, color: TABLE_COLORS.chipGold },
    { x: screenW * 0.88, y: screenH * 0.78, r: 7, color: TABLE_COLORS.chipGreen },
    { x: screenW * 0.05, y: screenH * 0.5, r: 6, color: TABLE_COLORS.chipRed },
    { x: screenW * 0.95, y: screenH * 0.45, r: 8, color: TABLE_COLORS.chipBlue },
    { x: screenW * 0.2, y: screenH * 0.12, r: 6, color: TABLE_COLORS.chipGold },
    { x: screenW * 0.82, y: screenH * 0.88, r: 7, color: TABLE_COLORS.chipGreen },
  ];
}

const FILL: CSSProperties = { position: 'absolute', inset: 0 };

function circleStyle(cx: number, cy: number, r: number): CSSProperties {
  return {
    position: 'absolute',
    left: cx - r,
    top: cy - r,
    width: r * 2,
    height: r * 2,
    borderRadius: '50%',
    boxSizing: 'border-box',
  };
}

function MiniCardBack({ width, height }: { readonly width: number; readonly height: number }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 'var(--radius-small)',
        overflow: 'hidden',
        background: TABLE_COLORS.cardBack,
        padding: 5,
        boxSizing: 'border-box',
        display: 'flex',
      }}
    >
      <div
        style={{
          flex: 1,
          border: `1.5px solid ${TABLE_COLORS.accentLight}`,
          borderRadius: 'var(--radius-small)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: 22, color: TABLE_COLORS.accent, opacity: 0.6 }}>
          {TABLE_COLORS.symbol}
        </span>
      </div>
    </div>
  );
}

type Phase = 'spreading' | 'waiting' | 'picking' | 'flipping' | 'revealed';

/** Pick one face-down card from the table and flip it over. */
export default function CardPick({
  role,
  onComplete,
  reducedMotion,
  testIDPrefix,
  remainingCards = 12,
}: RevealEffectProps) {
  const theme = ALIGNMENT_THEMES[role.alignment];
  const { width: screenWidth, height: screenHeight } = useViewportSize();
  const { width: revealCardWidth, height: revealCardHeight } = useRevealCardSize();

  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'revealed' : 'spreading');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const { fireComplete } = useRevealLifecycle(onComplete, CP.revealHoldDuration);

  const [initialCardCount] = useState(() => Math.max(1, Math.min(remainingCards, 16)));
  const [removedIndices, setRemovedIndices] = useState<ReadonlySet<number>>(() => new Set());
  const prevRemainingRef = useRef(remainingCards);
  const aliveCount = initialCardCount - removedIndices.size;

  const cols = Math.min(CP.maxColumns, initialCardCount);
  const rows = Math.ceil(initialCardCount / cols);
  const miniCardWidth = Math.min(
    screenWidth * CP.miniCardWidthRatio,
    (screenWidth - CP.cardGap * (cols + 1)) / cols,
  );
  const miniCardHeight = miniCardWidth * CP.miniCardAspectRatio;
  const totalGridWidth = cols * miniCardWidth + (cols - 1) * CP.cardGap;
  const totalGridHeight = rows * miniCardHeight + (rows - 1) * CP.cardGap;
  const gridPositions = Array.from({ length: initialCardCount }, (_, index) => ({
    x: -totalGridWidth / 2 + miniCardWidth / 2 + (index % cols) * (miniCardWidth + CP.cardGap),
    y:
      -totalGridHeight / 2 +
      miniCardHeight / 2 +
      Math.floor(index / cols) * (miniCardHeight + CP.cardGap),
  }));

  const spreadProgress = useSharedValue(reducedMotion ? 1 : 0);
  const otherCardsOpacity = useSharedValue(reducedMotion ? 0 : 1);
  const drawnCardX = useSharedValue(0);
  const drawnCardY = useSharedValue(0);
  const drawnCardOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const flipProgress = useSharedValue(reducedMotion ? 1 : 0);
  const chargeAuraPulse = useSharedValue(0);
  const chargeAuraOpacity = useSharedValue(0);
  const lightBarProgress = useSharedValue(0);
  const lightBarOpacity = useSharedValue(0);

  const drawnCardRef = useRef<HTMLDivElement>(null);
  const backFaceRef = useRef<HTMLDivElement>(null);
  const frontFaceRef = useRef<HTMLDivElement>(null);
  const chargeAuraRef = useRef<HTMLDivElement>(null);
  const lightBarsRef = useRef<HTMLDivElement>(null);

  const startFlipping = () => {
    setPhase('flipping');
    lightBarOpacity.animate(
      withSequence(
        withTiming(0.6, { duration: 150 }),
        withDelay(CP.flipDuration - 200, withTiming(0, { duration: 200 })),
      ),
    );
    lightBarProgress.animate(
      withTiming(1, { duration: CP.flipDuration, easing: Easing.inOut(Easing.cubic) }),
    );
    chargeAuraOpacity.animate(withTiming(0, { duration: 400 }));
    flipProgress.animate(
      withTiming(1, { duration: CP.flipDuration, easing: Easing.inOut(Easing.cubic) }),
      () => setPhase('revealed'),
    );
  };

  const startFlipAfterDelay = () => {
    chargeAuraOpacity.animate(withTiming(0.7, { duration: 200 }));
    chargeAuraPulse.animate(
      withRepeat(
        withSequence(
          withTiming(1, { duration: 300, easing: Easing.inOut(Easing.quad) }),
          withTiming(0.5, { duration: 300, easing: Easing.inOut(Easing.quad) }),
        ),
        2,
      ),
    );
    flipProgress.animate(withDelay(200, withTiming(0, { duration: 1 })), startFlipping);
  };

  const handleCardSelect = (index: number) => {
    if (phase !== 'waiting') return;
    const position = gridPositions[index];
    if (!position) throw new Error(`No card at index ${index}`);
    setSelectedIndex(index);
    setPhase('picking');
    drawnCardX.set(position.x);
    drawnCardY.set(position.y);
    drawnCardOpacity.set(1);
    otherCardsOpacity.animate(withTiming(0, { duration: CP.fadeOutDuration }));
    drawnCardX.animate(
      withTiming(0, { duration: CP.flyToCenterDuration, easing: Easing.out(Easing.cubic) }),
    );
    drawnCardY.animate(
      withTiming(0, { duration: CP.flyToCenterDuration, easing: Easing.out(Easing.cubic) }),
      startFlipAfterDelay,
    );
  };

  useEffect(() => {
    if (phase !== 'waiting' && phase !== 'spreading') return;
    const removedCount = prevRemainingRef.current - remainingCards;
    if (removedCount <= 0) return;
    prevRemainingRef.current = remainingCards;
    setRemovedIndices((previous) => {
      const aliveIndices = Array.from({ length: initialCardCount }, (_, i) => i).filter(
        (i) => !previous.has(i),
      );
      const toRemove = Math.min(removedCount, Math.max(0, aliveIndices.length - 1));
      return new Set([...previous, ...shuffleArray(aliveIndices).slice(0, toRemove)]);
    });
  }, [remainingCards, phase, initialCardCount]);

  useEffect(() => {
    if (reducedMotion) {
      fireComplete();
      return;
    }
    spreadProgress.animate(
      withTiming(1, { duration: CP.spreadDuration, easing: Easing.out(Easing.cubic) }),
      () => setPhase('waiting'),
    );
  }, [reducedMotion, spreadProgress, fireComplete]);

  const autoTimeoutWarning = useAutoTimeout(phase === 'waiting' && !reducedMotion, () => {
    const aliveIndices = Array.from({ length: initialCardCount }, (_, i) => i).filter(
      (i) => !removedIndices.has(i),
    );
    const [randomIndex] = shuffleArray(aliveIndices);
    if (randomIndex !== undefined) handleCardSelect(randomIndex);
  });

  useFrameStyle(drawnCardRef, () => ({
    opacity: drawnCardOpacity.get(),
    transform: `translate(${drawnCardX.get()}px, ${drawnCardY.get()}px) perspective(1200px) rotateY(${interpolate(flipProgress.get(), [0, 1], [0, 180])}deg)`,
  }));
  useFrameStyle(backFaceRef, () => ({ opacity: flipProgress.get() < 0.5 ? 1 : 0 }));
  useFrameStyle(frontFaceRef, () => ({ opacity: flipProgress.get() >= 0.5 ? 1 : 0 }));
  useFrameStyle(chargeAuraRef, () => ({
    opacity: chargeAuraOpacity.get(),
    transform: `scale(${(60 + chargeAuraPulse.get() * 12) / 72})`,
  }));
  useFrameStyle(lightBarsRef, () => ({
    opacity: lightBarOpacity.get(),
    transform: `translateX(${-screenWidth * 0.3 + lightBarProgress.get() * screenWidth * 0.6}px)`,
  }));

  const hintText =
    phase === 'spreading' || phase === 'waiting'
      ? aliveCount === 1
        ? '🤚 最后一张，点击翻开'
        : `🤚 还剩 ${aliveCount} 张，点选一张`
      : null;

  return (
    <div
      data-testid={`${testIDPrefix}-container`}
      style={{ ...FILL, backgroundColor: 'var(--color-background)', overflow: 'hidden' }}
    >
      <div style={{ ...FILL, background: TABLE_COLORS.felt }} />
      <div
        style={{
          position: 'absolute',
          inset: 8,
          border: `4px solid ${TABLE_COLORS.woodDark}`,
          borderRadius: 'var(--radius-medium)',
          display: 'flex',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            flex: 1,
            margin: 3,
            border: `1.5px solid ${TABLE_COLORS.woodLight}`,
            borderRadius: 'var(--radius-small)',
          }}
        />
      </div>

      {!reducedMotion && (
        <div style={{ ...FILL, pointerEvents: 'none' }}>
          {createTableChips(screenWidth, screenHeight).map((chip) => (
            <div key={`${chip.x}-${chip.y}`}>
              <div
                style={{
                  ...circleStyle(chip.x, chip.y, chip.r),
                  background: chip.color,
                  opacity: 0.5,
                }}
              />
              <div
                style={{
                  ...circleStyle(chip.x, chip.y, chip.r * 0.6 + 0.5),
                  border: '1px solid #ffffff',
                  opacity: 0.15,
                }}
              />
              <div
                style={{ ...circleStyle(chip.x, chip.y, 1.5), background: '#ffffff', opacity: 0.2 }}
              />
            </div>
          ))}
          <div
            ref={chargeAuraRef}
            style={{
              ...circleStyle(screenWidth / 2, screenHeight / 2, 72),
              background: `radial-gradient(circle closest-side, ${TABLE_COLORS.chargeAura}60, ${TABLE_COLORS.chargeAura}00)`,
              filter: 'blur(10px)',
              opacity: 0,
            }}
          />
          <div ref={lightBarsRef} style={{ ...FILL, mixBlendMode: 'screen', opacity: 0 }}>
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: screenHeight * 0.25,
                width: 4,
                height: screenHeight * 0.5,
                borderRadius: 2,
                background: TABLE_COLORS.lightBar,
                opacity: 0.4,
                filter: 'blur(6px)',
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: 20,
                top: screenHeight * 0.3,
                width: 2,
                height: screenHeight * 0.4,
                borderRadius: 1,
                background: TABLE_COLORS.lightBar,
                opacity: 0.2,
                filter: 'blur(4px)',
              }}
            />
          </div>
        </div>
      )}

      <HintWithWarning
        hintText={hintText}
        showWarning={autoTimeoutWarning}
        hintStyle={{ color: TABLE_COLORS.accent, letterSpacing: 1 }}
      />

      {(phase === 'spreading' || phase === 'waiting' || phase === 'picking') && (
        <div data-testid={`${testIDPrefix}-grid`} style={FILL}>
          {gridPositions.map((position, index) => {
            if (selectedIndex === index && phase === 'picking') return null;
            return (
              <MiniCard
                key={`card-${position.x}-${position.y}`}
                index={index}
                x={position.x}
                y={position.y}
                width={miniCardWidth}
                height={miniCardHeight}
                spreadProgress={spreadProgress}
                otherCardsOpacity={otherCardsOpacity}
                isSelected={selectedIndex === index}
                removed={removedIndices.has(index)}
                onPress={handleCardSelect}
                disabled={phase !== 'waiting' || removedIndices.has(index)}
                testIDPrefix={testIDPrefix}
              />
            );
          })}
        </div>
      )}

      {selectedIndex !== null && (
        <div
          ref={drawnCardRef}
          data-testid={`${testIDPrefix}-drawn-card`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: revealCardWidth,
            height: revealCardHeight,
            marginLeft: -revealCardWidth / 2,
            marginTop: -revealCardHeight / 2,
            borderRadius: 'var(--radius-medium)',
            boxShadow: '0px 6px 16px rgba(0,0,0,0.15)',
            opacity: 0,
          }}
        >
          <div ref={frontFaceRef} style={{ ...FILL, transform: 'scaleX(-1)', opacity: 0 }}>
            <RevealedCard
              role={role}
              theme={theme}
              width={revealCardWidth}
              height={revealCardHeight}
              revealed={phase === 'revealed'}
              reducedMotion={reducedMotion}
              onComplete={fireComplete}
            />
          </div>
          <div ref={backFaceRef} style={FILL}>
            <MiniCardBack width={revealCardWidth} height={revealCardHeight} />
          </div>
        </div>
      )}
    </div>
  );
}

interface MiniCardProps {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly spreadProgress: SharedValue;
  readonly otherCardsOpacity: SharedValue;
  readonly isSelected: boolean;
  readonly removed: boolean;
  readonly onPress: (index: number) => void;
  readonly disabled: boolean;
  readonly testIDPrefix: string;
}

/** One face-down card on the table: deals in staggered and tumbles away when dealt elsewhere. */
function MiniCard({
  index,
  x,
  y,
  width,
  height,
  spreadProgress,
  otherCardsOpacity,
  isSelected,
  removed,
  onPress,
  disabled,
  testIDPrefix,
}: MiniCardProps) {
  const exitProgress = useSharedValue(1);
  const cardRef = useRef<HTMLButtonElement>(null);
  const totalDuration = CP.spreadDuration + CP.spreadStagger * 15;
  const staggerFraction = (index * CP.spreadStagger) / totalDuration;

  useEffect(() => {
    if (!removed) return;
    exitProgress.animate(
      withTiming(0, { duration: CP.cardRemoveExitDuration, easing: Easing.in(Easing.cubic) }),
    );
  }, [removed, exitProgress]);

  useFrameStyle(cardRef, () => {
    const localProgress = Math.max(
      0,
      Math.min(1, (spreadProgress.get() - staggerFraction) / (1 - staggerFraction)),
    );
    const alive = exitProgress.get();
    const scale = interpolate(localProgress, [0, 1], [0.3, 1]) * (0.6 + 0.4 * alive);
    return {
      opacity: (isSelected ? 1 : otherCardsOpacity.get()) * localProgress * alive,
      transform: `translate(${x}px, ${y}px) scale(${scale}) rotate(${interpolate(alive, [0, 1], [8, 0])}deg)`,
    };
  });

  return (
    <button
      ref={cardRef}
      type="button"
      data-testid={`${testIDPrefix}-card-${index}`}
      aria-label={`牌 ${index + 1}`}
      disabled={disabled}
      onClick={() => onPress(index)}
      style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width,
        height,
        marginLeft: -width / 2,
        marginTop: -height / 2,
        padding: 0,
        border: 'none',
        background: 'none',
        borderRadius: 'var(--radius-small)',
        boxShadow: '0px 2px 6px rgba(0,0,0,0.12)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: 0,
      }}
    >
      <MiniCardBack width={width} height={height} />
    </button>
  );
}
