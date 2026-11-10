/**
 * The layout the eternal-night collection reveals share: the card sized to leave room for the
 * caption, artwork opening over it during the entry, then a confirm button that completes.
 */
import { type ReactNode, useEffect, useState } from 'react';

import { MYTHIC_ENTRY_DURATION } from '@/config/mythicVisual';
import { Easing, withTiming } from '@/scene/timeline';

import { CONFIG } from '../config';
import { useRevealLifecycle } from '../hooks/useRevealLifecycle';
import { type SharedValue, useSharedValue, useViewportSize } from '../runtime';

/** The card size, also capped so the card and its caption fit 58% of the screen height. */
export function useMythicCardSize(): { readonly width: number; readonly height: number } {
  const { width: screenWidth, height: screenHeight } = useViewportSize();
  const width = Math.min(
    CONFIG.common.cardMaxWidth,
    screenWidth * CONFIG.common.cardWidthRatio,
    (screenHeight * 0.58) / CONFIG.common.cardAspectRatio,
  );
  return { width, height: width * CONFIG.common.cardAspectRatio };
}

/** The entry progress (0→1 over the mythic entry duration) and whether it has finished. */
export function useMythicEntry(reducedMotion: boolean): {
  readonly progress: SharedValue;
  readonly revealed: boolean;
} {
  const progress = useSharedValue(reducedMotion ? 1 : 0);
  const [revealed, setRevealed] = useState(reducedMotion);
  useEffect(() => {
    if (reducedMotion) return;
    progress.animate(
      withTiming(1, { duration: MYTHIC_ENTRY_DURATION, easing: Easing.inOut(Easing.cubic) }),
      () => setRevealed(true),
    );
  }, [progress, reducedMotion]);
  return { progress, revealed };
}

interface MythicRevealLayoutProps {
  readonly testID: string;
  readonly confirmTestID: string;
  readonly revealed: boolean;
  readonly title: string;
  readonly titleColor: string;
  readonly onComplete: () => void;
  /** The framed card with its artwork. */
  readonly children: ReactNode;
}

/** Centers the framed card above the caption, which becomes the confirm button once revealed. */
export function MythicRevealLayout({
  testID,
  confirmTestID,
  revealed,
  title,
  titleColor,
  onComplete,
  children,
}: MythicRevealLayoutProps) {
  const { fireComplete } = useRevealLifecycle(onComplete);
  return (
    <div
      data-testid={testID}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-large)',
        paddingTop: 'var(--space-xlarge)',
      }}
    >
      {children}
      {revealed ? (
        <button
          type="button"
          onClick={fireComplete}
          data-testid={confirmTestID}
          style={{
            padding: 'var(--space-medium) var(--space-xlarge)',
            borderRadius: 'var(--radius-medium)',
            border: 'none',
            background: 'var(--color-primary)',
            color: 'var(--color-text-inverse)',
            fontSize: 'var(--font-body)',
            cursor: 'pointer',
          }}
        >
          我知道了
        </button>
      ) : (
        <span
          style={{
            color: titleColor,
            fontSize: 'var(--font-title)',
            padding: 'var(--space-small) 0',
          }}
        >
          {title}
        </span>
      )}
    </div>
  );
}
