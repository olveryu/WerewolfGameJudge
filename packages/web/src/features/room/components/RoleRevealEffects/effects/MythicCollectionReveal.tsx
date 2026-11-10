/**
 * The mythic collection reveals: each collection's artwork opens over the card (astral star
 * segments fly apart, ocean shells part, the ink scroll unrolls) before the player confirms.
 */
import { useRef } from 'react';

import { MYTHIC_COLLECTION_COLORS, type MythicCollection } from '@/config/mythicVisual';

import {
  MythicRevealLayout,
  useMythicCardSize,
  useMythicEntry,
} from '../common/MythicRevealLayout';
import { RevealCardFace } from '../common/RevealCardFace';
import { useRevealFrame } from '../runtime';
import { ALIGNMENT_THEMES } from '../themes';
import type { RevealEffectProps } from '../types';

const REVEALS = {
  astral: { id: 'fateReweave', name: '命盘重构' },
  ocean: { id: 'oceanPearl', name: '万海开珠' },
  ink: { id: 'unfoldLandscape', name: '长卷开天' },
} as const;

const STAR_SEGMENT_COUNT = 8;

function StarSegmentArt() {
  const palette = MYTHIC_COLLECTION_COLORS.astral;
  return (
    <>
      <path
        d="M100 150 L270 79 A184 184 0 0 1 270 221 Z"
        fill={palette.dark}
        stroke={palette.secondary}
        strokeWidth={2}
      />
      <path
        d="M128 150 H250 M172 126 V174 M192 117 V183 M212 108 V192"
        stroke={palette.primary}
        strokeWidth={1.5}
      />
      <circle cx={237} cy={150} r={7} fill={palette.pearl} />
    </>
  );
}

function HalfArt({ collection }: { readonly collection: 'ocean' | 'ink' }) {
  const palette = MYTHIC_COLLECTION_COLORS[collection];
  if (collection === 'ocean') {
    return (
      <>
        <path
          d="M100 295 C75 270 -15 205 -10 115 C-8 45 60 -5 100 10 Z"
          fill={palette.dark}
          stroke={palette.secondary}
          strokeWidth={3}
        />
        <path
          d="M100 288 Q2 145 72 15 M100 288 Q-15 135 48 24 M100 288 Q-20 160 24 52 M100 288 Q-12 184 8 84"
          fill="none"
          stroke={palette.primary}
          strokeWidth={3}
        />
        <path d="M100 278 Q33 147 90 16" fill="none" stroke={palette.pearl} strokeWidth={1.5} />
      </>
    );
  }
  return (
    <>
      <rect x={0} y={5} width={100} height={290} fill={palette.pearl} />
      <path d="M0 245 L32 183 L49 204 L75 142 L100 194 V272 H0 Z" fill={palette.primary} />
      <path d="M0 270 L24 225 L46 250 L66 199 L100 255 V285 H0 Z" fill={palette.dark} />
      <path d="M94 0 V300" stroke={palette.secondary} strokeWidth={8} />
      <path
        d="M18 51 Q50 37 72 57 M18 77 Q38 58 64 72"
        fill="none"
        stroke={palette.dark}
        strokeWidth={3}
      />
    </>
  );
}

function CenterArt({ collection }: { readonly collection: 'ocean' | 'ink' }) {
  const palette = MYTHIC_COLLECTION_COLORS[collection];
  if (collection === 'ocean') {
    return (
      <>
        <circle r={21} fill={palette.primary} opacity={0.4} />
        <circle r={13} fill={palette.pearl} />
        <circle cx={-4} cy={-4} r={4} fill={palette.secondary} />
      </>
    );
  }
  return (
    <>
      <rect x={-16} y={-20} width={32} height={40} fill={palette.secondary} />
      <path d="M-9 -12 V12 H9 V-12 M0 -15 V15 M-10 0 H10" stroke={palette.pearl} strokeWidth={3} />
    </>
  );
}

function setSvgFrame(element: SVGGElement | null | undefined, transform: string, opacity: number) {
  if (!element) return;
  element.setAttribute('transform', transform);
  element.setAttribute('opacity', String(opacity));
}

function MythicCollectionReveal({
  collection,
  role,
  onComplete,
  reducedMotion,
  testIDPrefix,
}: RevealEffectProps & { readonly collection: MythicCollection }) {
  const palette = MYTHIC_COLLECTION_COLORS[collection];
  const presentation = REVEALS[collection];
  const { width: cardWidth, height: cardHeight } = useMythicCardSize();
  const { progress, revealed } = useMythicEntry(reducedMotion);
  const cardRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<(SVGGElement | null)[]>([]);
  const leftRef = useRef<SVGGElement>(null);
  const rightRef = useRef<SVGGElement>(null);
  const centerRef = useRef<SVGGElement>(null);

  useRevealFrame(() => {
    const value = progress.get();
    if (cardRef.current) {
      cardRef.current.style.opacity = String(Math.min(1, Math.max(0, (value - 0.15) / 0.5)));
    }
    segmentRefs.current.forEach((segment, index) =>
      setSvgFrame(
        segment,
        `rotate(${index * 45 + value * 35} 100 150) translate(${value * 185} 0)`,
        1 - value,
      ),
    );
    const tilt = collection === 'ocean' ? 28 : 0;
    setSvgFrame(
      leftRef.current,
      `translate(${-value * 120} 0) rotate(${-value * tilt} 100 290)`,
      1 - value,
    );
    setSvgFrame(
      rightRef.current,
      `translate(${value * 120} 0) rotate(${value * tilt} 100 290)`,
      1 - value,
    );
    setSvgFrame(
      centerRef.current,
      `translate(100 150) scale(${1 + value * 2})`,
      1 - Math.min(1, value * 2),
    );
  });

  return (
    <MythicRevealLayout
      testID={`${testIDPrefix}-${presentation.id}`}
      confirmTestID={`${testIDPrefix}-collection-confirm`}
      revealed={revealed}
      title={presentation.name}
      titleColor={palette.pearl}
      onComplete={onComplete}
    >
      <div
        style={{
          position: 'relative',
          width: cardWidth,
          height: cardHeight,
          overflow: 'hidden',
          borderRadius: 'var(--radius-medium)',
          border: `2px solid ${palette.secondary}`,
          boxSizing: 'border-box',
        }}
      >
        <div ref={cardRef} inert={!revealed} style={{ opacity: reducedMotion ? 1 : 0 }}>
          <RevealCardFace
            role={role}
            width={cardWidth}
            height={cardHeight}
            revealGradient={ALIGNMENT_THEMES[role.alignment].revealGradient}
            testID={`${testIDPrefix}-collection-card`}
          />
        </div>
        {!revealed && (
          <svg
            width="100%"
            height="100%"
            viewBox="0 0 200 300"
            aria-hidden
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            {collection === 'astral' ? (
              Array.from({ length: STAR_SEGMENT_COUNT }, (_, index) => (
                <g
                  key={index}
                  ref={(element) => {
                    segmentRefs.current[index] = element;
                  }}
                  transform={`rotate(${index * 45} 100 150)`}
                >
                  <StarSegmentArt />
                </g>
              ))
            ) : (
              <>
                <g ref={leftRef}>
                  <HalfArt collection={collection} />
                </g>
                <g ref={rightRef}>
                  <g transform="translate(200 0) scale(-1 1)">
                    <HalfArt collection={collection} />
                  </g>
                </g>
                <g ref={centerRef} transform="translate(100 150)">
                  <CenterArt collection={collection} />
                </g>
              </>
            )}
          </svg>
        )}
      </div>
    </MythicRevealLayout>
  );
}

/** The astral collection's fate-reweave reveal. */
export function AstralCollectionReveal(props: RevealEffectProps) {
  return <MythicCollectionReveal {...props} collection="astral" />;
}

/** The ocean collection's pearl reveal. */
export function OceanCollectionReveal(props: RevealEffectProps) {
  return <MythicCollectionReveal {...props} collection="ocean" />;
}

/** The ink collection's unfolding-landscape reveal. */
export function InkCollectionReveal(props: RevealEffectProps) {
  return <MythicCollectionReveal {...props} collection="ink" />;
}
