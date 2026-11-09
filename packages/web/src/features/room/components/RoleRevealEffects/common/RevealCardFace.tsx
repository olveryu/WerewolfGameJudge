import { type CSSProperties, useEffect, useRef } from 'react';

import { Easing, withDelay, withSequence, withTiming } from '@/scene/timeline';

import type { RevealRoleData } from '../../../model/RevealRoleData';
import { useRevealFrame, useSharedValue } from '../runtime';
import { ALIGNMENT_COLORS } from '../themes';

const EMOJI_POP_DELAY = 350;
const EMOJI_POP_DURATION = 600;
const NAME_SLIDE_DELAY = 500;
const NAME_SLIDE_DURATION = 500;
const SUB_SLIDE_DELAY = 600;
const SUB_SLIDE_DURATION = 500;
const WOLF_SHAKE_DELAY = 350;
const WOLF_SHAKE_STEP = 500 / 6;
const BORDER_WIDTH = 3;
const CARD_RADIUS = 28;
const PLACEHOLDER_RADIUS = 20;
const TEXT_INVERSE = '#FFFFFF';

/**
 * The old gradient ran from (15%, 0) to (85%, 100%) of the card. CSS spans a gradient line between
 * the corners its angle reaches, so the stops are rescaled to land where the old endpoints did.
 */
function revealGradientCss(
  colors: readonly [string, string, string],
  width: number,
  height: number,
): string {
  const dx = width * 0.7;
  const dy = height;
  const angle = Math.atan2(dx, -dy);
  const cssLineLength = Math.abs(width * Math.sin(angle)) + Math.abs(height * Math.cos(angle));
  const oldLineLength = Math.hypot(dx, dy);
  const span = oldLineLength / cssLineLength;
  const start = ((1 - span) / 2) * 100;
  const end = ((1 + span) / 2) * 100;
  return `linear-gradient(${(angle * 180) / Math.PI}deg, ${colors[0]} ${start}%, ${colors[1]} 50%, ${colors[2]} ${end}%)`;
}

function withAlpha(hex: string, alpha: number): string {
  return `${hex}${Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

interface RevealCardFaceProps {
  readonly role: RevealRoleData;
  readonly width: number;
  readonly height: number;
  readonly revealGradient: readonly [string, string, string];
  /**
   * Omitted: shown still. False: hidden until it turns true. True: the portrait pops, the name and
   * id slide up, and wolf cards shake.
   */
  readonly animateEntrance?: boolean;
  readonly testID?: string;
  readonly style?: CSSProperties;
}

/** The revealed role card face every effect ends on: portrait, name and id over the faction gradient. */
export function RevealCardFace({
  role,
  width,
  height,
  revealGradient,
  animateEntrance,
  testID,
  style,
}: RevealCardFaceProps) {
  const factionColor = ALIGNMENT_COLORS[role.alignment];
  const isWolf = role.alignment === 'wolf';
  const willAnimate = animateEntrance !== undefined;
  const hidden = willAnimate ? 0 : 1;
  const emojiScale = useSharedValue(hidden);
  const emojiRotate = useSharedValue(0);
  const nameOpacity = useSharedValue(hidden);
  const nameTranslateY = useSharedValue(willAnimate ? 10 : 0);
  const subOpacity = useSharedValue(hidden);
  const subTranslateY = useSharedValue(willAnimate ? 10 : 0);
  const shakeX = useSharedValue(0);
  const shakeRotate = useSharedValue(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const portraitRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLParagraphElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (!animateEntrance) return;
    const popEasing = Easing.bezier(0.34, 1.56, 0.64, 1);
    const settle = Easing.out(Easing.quad);
    if (isWolf) {
      emojiScale.set(0.2);
      emojiRotate.set(-10);
      emojiScale.animate(
        withDelay(
          EMOJI_POP_DELAY,
          withSequence(
            withTiming(1.3, { duration: EMOJI_POP_DURATION * 0.5, easing: popEasing }),
            withTiming(0.95, { duration: EMOJI_POP_DURATION * 0.2, easing: settle }),
            withTiming(1, { duration: EMOJI_POP_DURATION * 0.3, easing: settle }),
          ),
        ),
      );
      emojiRotate.animate(
        withDelay(
          EMOJI_POP_DELAY,
          withSequence(
            withTiming(3, { duration: EMOJI_POP_DURATION * 0.5, easing: popEasing }),
            withTiming(-1, { duration: EMOJI_POP_DURATION * 0.2 }),
            withTiming(0, { duration: EMOJI_POP_DURATION * 0.3 }),
          ),
        ),
      );
      shakeX.animate(
        withDelay(
          WOLF_SHAKE_DELAY,
          withSequence(
            ...[-4, 4, -3, 2, -1, 0].map((x) => withTiming(x, { duration: WOLF_SHAKE_STEP })),
          ),
        ),
      );
      shakeRotate.animate(
        withDelay(
          WOLF_SHAKE_DELAY,
          withSequence(
            withTiming(-1, { duration: WOLF_SHAKE_STEP }),
            withTiming(1, { duration: WOLF_SHAKE_STEP }),
            withTiming(-0.5, { duration: WOLF_SHAKE_STEP }),
            withTiming(0.5, { duration: WOLF_SHAKE_STEP }),
            withTiming(0, { duration: WOLF_SHAKE_STEP * 2 }),
          ),
        ),
      );
    } else {
      emojiScale.set(0.3);
      emojiScale.animate(
        withDelay(
          EMOJI_POP_DELAY,
          withSequence(
            withTiming(1.2, { duration: EMOJI_POP_DURATION * 0.6, easing: popEasing }),
            withTiming(1, { duration: EMOJI_POP_DURATION * 0.4, easing: settle }),
          ),
        ),
      );
    }
    const slide = (duration: number) => withTiming(1, { duration, easing: settle });
    const slideIn = (duration: number) => withTiming(0, { duration, easing: settle });
    nameOpacity.animate(withDelay(NAME_SLIDE_DELAY, slide(NAME_SLIDE_DURATION)));
    nameTranslateY.animate(withDelay(NAME_SLIDE_DELAY, slideIn(NAME_SLIDE_DURATION)));
    subOpacity.animate(withDelay(SUB_SLIDE_DELAY, slide(SUB_SLIDE_DURATION)));
    subTranslateY.animate(withDelay(SUB_SLIDE_DELAY, slideIn(SUB_SLIDE_DURATION)));
  }, [
    animateEntrance,
    isWolf,
    emojiScale,
    emojiRotate,
    nameOpacity,
    nameTranslateY,
    subOpacity,
    subTranslateY,
    shakeX,
    shakeRotate,
  ]);

  useRevealFrame(() => {
    if (cardRef.current) {
      cardRef.current.style.transform = `translateX(${shakeX.get()}px) rotate(${shakeRotate.get()}deg)`;
    }
    if (portraitRef.current) {
      portraitRef.current.style.transform = `scale(${emojiScale.get()}) rotate(${emojiRotate.get()}deg)`;
    }
    if (nameRef.current) {
      nameRef.current.style.opacity = String(nameOpacity.get());
      nameRef.current.style.transform = `translateY(${nameTranslateY.get()}px)`;
    }
    if (subRef.current) {
      subRef.current.style.opacity = String(subOpacity.get());
      subRef.current.style.transform = `translateY(${subTranslateY.get()}px)`;
    }
  });

  const portraitSize = Math.round(width * 0.7);
  const iconSize = Math.round(width * 0.38);
  const portraitStyle: CSSProperties = {
    width: portraitSize,
    height: portraitSize,
    marginBottom: Math.round(width * 0.04),
    flexShrink: 0,
    transform: `scale(${hidden})`,
  };
  return (
    <div
      ref={cardRef}
      data-testid={testID}
      style={{
        position: 'relative',
        boxSizing: 'border-box',
        width,
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 24px 24px',
        overflow: 'hidden',
        borderRadius: CARD_RADIUS,
        border: `${BORDER_WIDTH}px solid ${withAlpha(factionColor, 0.5)}`,
        background: revealGradientCss(
          revealGradient,
          width - BORDER_WIDTH * 2,
          height - BORDER_WIDTH * 2,
        ),
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
        ...style,
      }}
    >
      {role.imageUrl !== undefined ? (
        <img
          ref={(element) => {
            portraitRef.current = element;
          }}
          src={role.imageUrl}
          alt=""
          style={{ ...portraitStyle, objectFit: 'contain' }}
        />
      ) : (
        <span
          ref={(element) => {
            portraitRef.current = element;
          }}
          data-testid="role-badge"
          style={{
            ...portraitStyle,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: PLACEHOLDER_RADIUS,
            backgroundColor: factionColor,
            color: TEXT_INVERSE,
            fontSize: Math.round(iconSize * 0.4),
            fontWeight: 700,
          }}
        >
          {role.name.charAt(0)}
        </span>
      )}
      <p
        ref={nameRef}
        style={{
          margin: 0,
          color: factionColor,
          fontSize: Math.round(width * 0.114),
          fontWeight: 700,
          letterSpacing: Math.round(width * 0.014),
          opacity: hidden,
        }}
      >
        {role.name}
      </p>
      <p
        ref={subRef}
        style={{
          margin: `${Math.round(width * 0.029)}px 0 0`,
          color: factionColor,
          fontSize: Math.round(width * 0.071),
          fontWeight: 600,
          letterSpacing: Math.max(1, Math.round(width * 0.007)),
          opacity: hidden,
        }}
      >
        {(role.displayId ?? role.id).toUpperCase()}
      </p>
    </div>
  );
}
