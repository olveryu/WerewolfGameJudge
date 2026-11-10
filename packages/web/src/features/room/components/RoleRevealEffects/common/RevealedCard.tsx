import { type CSSProperties, type RefObject, useRef } from 'react';

import type { RevealRoleData } from '../../../model/RevealRoleData';
import type { AlignmentTheme } from '../themes';
import { AlignmentRevealOverlay } from './alignment/AlignmentRevealOverlay';
import { REVEAL_PIXI_LAYER } from './layers';
import { RevealBurst } from './RevealBurst';
import { RevealCardFace } from './RevealCardFace';
import { useAnchorRect } from './useAnchorRect';

interface RevealedCardProps {
  readonly role: RevealRoleData;
  readonly theme: AlignmentTheme;
  readonly width: number;
  readonly height: number;
  /** The card face enters, the burst fires and the faction finale plays once this turns true. */
  readonly revealed: boolean;
  readonly reducedMotion: boolean;
  readonly onComplete: () => void;
  readonly testID?: string;
  readonly style?: CSSProperties;
}

/**
 * The finale shared by the interactive effects: the card face entering, the burst over it and the
 * faction overlay framing it, which completes the reveal.
 */
export function RevealedCard({
  role,
  theme,
  width,
  height,
  revealed,
  reducedMotion,
  onComplete,
  testID,
  style,
}: RevealedCardProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  return (
    <>
      <div ref={anchorRef} style={{ position: 'relative', width, height, ...style }}>
        <RevealCardFace
          role={role}
          width={width}
          height={height}
          revealGradient={theme.revealGradient}
          animateEntrance={revealed}
          testID={testID}
        />
      </div>
      <RevealBurst trigger={revealed} zIndex={REVEAL_PIXI_LAYER.burst} color={theme.glowColor} />
      {revealed && (
        <RevealFinale
          anchorRef={anchorRef}
          role={role}
          theme={theme}
          reducedMotion={reducedMotion}
          onComplete={onComplete}
        />
      )}
    </>
  );
}

interface RevealFinaleProps {
  readonly anchorRef: RefObject<HTMLDivElement | null>;
  readonly role: RevealRoleData;
  readonly theme: AlignmentTheme;
  readonly reducedMotion: boolean;
  readonly onComplete: () => void;
}

/** Measures the card where it settled when the reveal fires, then frames it. */
export function RevealFinale({
  anchorRef,
  role,
  theme,
  reducedMotion,
  onComplete,
}: RevealFinaleProps) {
  const rect = useAnchorRect(anchorRef);
  if (!rect) return null;
  return (
    <AlignmentRevealOverlay
      alignment={role.alignment}
      theme={theme}
      rect={rect}
      zIndex={REVEAL_PIXI_LAYER.alignment}
      animate={!reducedMotion}
      onComplete={onComplete}
    />
  );
}
