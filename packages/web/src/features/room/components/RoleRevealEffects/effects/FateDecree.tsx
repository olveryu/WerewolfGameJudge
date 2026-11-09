/**
 * FateDecree: an obsidian decree sealed with the night crown parts down the middle, the seal
 * fading as the halves slide off the card.
 */
import { useRef } from 'react';

import { MYTHIC_COLORS } from '@/config/mythicVisual';

import {
  MythicRevealLayout,
  useMythicCardSize,
  useMythicEntry,
} from '../common/MythicRevealLayout';
import { RevealCardFace } from '../common/RevealCardFace';
import { useRevealFrame } from '../runtime';
import { ALIGNMENT_THEMES } from '../themes';
import type { RevealEffectProps } from '../types';

const HALF_STYLE = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  width: '50%',
  boxSizing: 'border-box',
  background: MYTHIC_COLORS.obsidian,
  border: `2px solid ${MYTHIC_COLORS.crimson}`,
  pointerEvents: 'none',
} as const;

/** The night crown motif in a 100×70 view box. */
function NightCrownMotif() {
  return (
    <g strokeLinejoin="round">
      <path
        d="M12 57 L1 19 L29 36 L33 16 L50 1 L67 16 L71 36 L99 19 L88 57 L50 69 Z"
        fill={MYTHIC_COLORS.obsidian}
        stroke={MYTHIC_COLORS.silver}
        strokeWidth={2}
      />
      <path
        d="M12 57 L1 19 L24 45 L33 16 L50 1 L40 39 L50 52 L60 39 L50 1 L67 16 L76 45 L99 19 L88 57 L50 69 Z"
        fill={MYTHIC_COLORS.silver}
      />
      <path
        d="M12 57 L50 61 L88 57 M33 16 L24 45 M67 16 L76 45"
        fill="none"
        stroke={MYTHIC_COLORS.pearl}
      />
      <path
        d="M50 28 L58 43 L50 59 L42 43 Z"
        fill={MYTHIC_COLORS.enamel}
        stroke={MYTHIC_COLORS.highlight}
      />
      <path d="M50 28 L58 43 L50 48 Z" fill={MYTHIC_COLORS.crystal} />
    </g>
  );
}

/** The fate-decree reveal: the sealed decree opens, then the player confirms. */
export default function FateDecree({
  role,
  onComplete,
  reducedMotion,
  testIDPrefix,
}: RevealEffectProps) {
  const { width: cardWidth, height: cardHeight } = useMythicCardSize();
  const { progress, revealed } = useMythicEntry(reducedMotion);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const sealRef = useRef<HTMLDivElement>(null);

  useRevealFrame(() => {
    const value = progress.get();
    const halfOpacity = String(1 - Math.max(0, (value - 0.9) * 10));
    const shift = value * cardWidth * 0.52;
    if (leftRef.current) {
      leftRef.current.style.transform = `translateX(${-shift}px)`;
      leftRef.current.style.opacity = halfOpacity;
    }
    if (rightRef.current) {
      rightRef.current.style.transform = `translateX(${shift}px)`;
      rightRef.current.style.opacity = halfOpacity;
    }
    if (sealRef.current) {
      sealRef.current.style.opacity = String(1 - Math.min(1, value * 3));
      sealRef.current.style.transform = `scale(${1 + value * 0.3})`;
    }
  });

  const hidden = reducedMotion ? { opacity: 0 } : undefined;
  return (
    <MythicRevealLayout
      testID={`${testIDPrefix}-fateDecree`}
      confirmTestID={`${testIDPrefix}-decree-confirm`}
      revealed={revealed}
      title="命运敕令"
      titleColor={MYTHIC_COLORS.silver}
      onComplete={onComplete}
    >
      <div
        style={{
          position: 'relative',
          width: cardWidth,
          height: cardHeight,
          overflow: 'hidden',
          borderRadius: 'var(--radius-medium)',
          border: `2px solid ${MYTHIC_COLORS.silver}`,
          boxSizing: 'border-box',
        }}
      >
        <div inert={!revealed}>
          <RevealCardFace
            role={role}
            width={cardWidth}
            height={cardHeight}
            revealGradient={ALIGNMENT_THEMES[role.alignment].revealGradient}
            testID={`${testIDPrefix}-decree-card`}
          />
        </div>
        <div
          ref={leftRef}
          style={{
            ...HALF_STYLE,
            ...hidden,
            left: 0,
            borderRight: `5px solid ${MYTHIC_COLORS.silver}`,
          }}
        />
        <div
          ref={rightRef}
          style={{
            ...HALF_STYLE,
            ...hidden,
            right: 0,
            borderLeft: `5px solid ${MYTHIC_COLORS.silver}`,
          }}
        />
        <div
          ref={sealRef}
          style={{
            position: 'absolute',
            left: '32%',
            top: '36%',
            width: '36%',
            height: '25%',
            pointerEvents: 'none',
            ...hidden,
          }}
        >
          <svg width="100%" height="100%" viewBox="0 0 100 70" aria-hidden>
            <NightCrownMotif />
          </svg>
        </div>
      </div>
    </MythicRevealLayout>
  );
}
