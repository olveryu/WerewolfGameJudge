/**
 * Common (10 patterns) and rare (5 patterns) seat entrances, each in the ten flair palette
 * colours: 150 catalog ids such as `fadeRedEnter`. Ports of the previous client's
 * `seatAnimations/common` templates: every effect is drawn behind the avatar inside the square
 * animation box.
 */
import { type EntranceSpec, pose } from '@/scene/entrance';
import { FLAIR_PALETTE, type FlairColorSet } from '@/scene/flairs/common/palette';
import {
  Easing,
  settleMs,
  type Track,
  track,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from '@/scene/timeline';

import {
  fillCircle,
  fillEllipse,
  fillPath,
  fillRect,
  strokeArc,
  strokeCircle,
  strokeEllipse,
  strokeLine,
  strokePath,
} from './draw';

const COMMON_DURATION = 2000;
const RARE_DURATION = 2500;

const outCubic = Easing.out(Easing.cubic);

type Template = (id: string, colors: FlairColorSet) => EntranceSpec;

/** A template driven by one `0 → 1` timing over the tier duration. */
function progressTrack(duration: number, easing = outCubic): Track {
  return track(0, withTiming(1, { duration, easing }));
}

const fade: Template = (id, colors) => {
  const opacity = track(0, withTiming(1, { duration: COMMON_DURATION * 0.75, easing: outCubic }));
  const glow = track(0.6, withTiming(0, { duration: COMMON_DURATION }));
  return {
    id,
    completeMs: glow.endMs,
    settleMs: settleMs(opacity, glow),
    clip: 'square',
    avatar: (ms) => [pose({ opacity: opacity.at(ms) })],
    beneath: (context, ms, size) =>
      fillCircle(context, size / 2, size / 2, size * 0.42, colors.rgbLight, 0.35 * glow.at(ms)),
  };
};

const slide =
  (direction: 'up' | 'down'): Template =>
  (id, colors) => {
    const progress = progressTrack(COMMON_DURATION);
    return {
      id,
      completeMs: progress.endMs,
      settleMs: progress.endMs,
      clip: 'square',
      avatar: (ms, size) => {
        const p = progress.at(ms);
        const offset = (1 - p) * size * 0.4;
        return [pose({ opacity: p, translateY: direction === 'up' ? offset : -offset })];
      },
      beneath: (context, ms, size) => {
        const p = progress.at(ms);
        const [y1, y2] =
          direction === 'up' ? [size * (1 - p * 0.5), size] : [0, size * (1 - p) * 0.5];
        strokeLine(context, size / 2, y1, size / 2, y2, {
          color: colors.rgb,
          width: 2,
          opacity: (1 - p) * 0.5,
        });
      },
    };
  };

const zoomIn: Template = (id, colors) => {
  const progress = progressTrack(COMMON_DURATION, Easing.out(Easing.back(1.5)));
  return {
    id,
    completeMs: progress.endMs,
    settleMs: progress.endMs,
    clip: 'square',
    avatar: (ms) => {
      const p = progress.at(ms);
      return [pose({ opacity: Math.min(p * 2, 1), scale: 0.3 + p * 0.7 })];
    },
    beneath: (context, ms, size) => {
      const p = progress.at(ms);
      strokeCircle(context, size / 2, size / 2, size * 0.2 + p * size * 0.3, {
        color: colors.rgb,
        width: 2,
        opacity: (1 - p) * 0.4,
      });
    },
  };
};

const zoomOut: Template = (id, colors) => {
  const progress = progressTrack(COMMON_DURATION);
  return {
    id,
    completeMs: progress.endMs,
    settleMs: progress.endMs,
    clip: 'square',
    avatar: (ms) => {
      const p = progress.at(ms);
      return [pose({ opacity: Math.min(p * 2, 1), scale: 1.6 - p * 0.6 })];
    },
    beneath: (context, ms, size) => {
      const p = progress.at(ms);
      strokeCircle(context, size / 2, size / 2, size * 0.5 - p * size * 0.15, {
        color: colors.rgbLight,
        width: 3,
        opacity: (1 - p) * 0.3,
      });
    },
  };
};

const spin: Template = (id, colors) => {
  const progress = progressTrack(COMMON_DURATION);
  return {
    id,
    completeMs: progress.endMs,
    settleMs: progress.endMs,
    clip: 'square',
    avatar: (ms) => {
      const p = progress.at(ms);
      return [
        pose({ opacity: Math.min(p * 1.5, 1), rotateDeg: (1 - p) * 360, scale: 0.5 + p * 0.5 }),
      ];
    },
    beneath: (context, ms, size) => {
      const p = progress.at(ms);
      strokeArc(context, size / 2, size / 2, size * 0.42, -Math.PI / 2, p * Math.PI * 2, {
        color: colors.rgb,
        width: 2,
        opacity: (1 - p) * 0.5,
        cap: 'round',
      });
    },
  };
};

const bounce: Template = (id, colors) => {
  const drop = track(-0.5, withSpring(0, { damping: 8, stiffness: 180 }));
  const opacity = track(0, withTiming(1, { duration: COMMON_DURATION * 0.15 }));
  const ring = track(0, withTiming(1, { duration: COMMON_DURATION }));
  return {
    id,
    completeMs: ring.endMs,
    settleMs: settleMs(drop, opacity, ring),
    clip: 'square',
    avatar: (ms, size) => [pose({ opacity: opacity.at(ms), translateY: drop.at(ms) * size })],
    beneath: (context, ms, size) => {
      const p = ring.at(ms);
      strokeCircle(context, size / 2, size * 0.7, size * 0.1 + p * size * 0.35, {
        color: colors.rgb,
        width: 2,
        opacity: (1 - p) * 0.4,
      });
    },
  };
};

const flip: Template = (id, colors) => {
  const progress = progressTrack(COMMON_DURATION);
  return {
    id,
    completeMs: progress.endMs,
    settleMs: progress.endMs,
    clip: 'square',
    avatar: (ms) => {
      const p = progress.at(ms);
      return [pose({ opacity: p > 0.3 ? 1 : 0, rotateYDeg: (1 - p) * 90 })];
    },
    beneath: (context, ms, size) => {
      const p = progress.at(ms);
      const x = size * p;
      strokeLine(context, x, 0, x, size, {
        color: colors.rgbLight,
        width: 2,
        opacity: (1 - p) * 0.5,
      });
    },
  };
};

const blur: Template = (id, colors) => {
  const progress = progressTrack(COMMON_DURATION);
  return {
    id,
    completeMs: progress.endMs,
    settleMs: progress.endMs,
    clip: 'square',
    avatar: (ms) => {
      const p = progress.at(ms);
      return [pose({ opacity: p, scale: 1.15 - p * 0.15 })];
    },
    beneath: (context, ms, size) => {
      const p = progress.at(ms);
      fillCircle(context, size / 2, size / 2, size * 0.4, colors.rgbLight, 0.5 * (1 - p) * 0.4);
    },
  };
};

const pop: Template = (id, colors) => {
  const scale = track(0, withSpring(1, { damping: 6, stiffness: 200 }));
  const opacity = track(0, withTiming(1, { duration: COMMON_DURATION * 0.1 }));
  const burst = track(0, withTiming(1, { duration: COMMON_DURATION }));
  return {
    id,
    completeMs: burst.endMs,
    settleMs: settleMs(scale, opacity, burst),
    clip: 'square',
    avatar: (ms) => [pose({ opacity: opacity.at(ms), scale: scale.at(ms) })],
    beneath: (context, ms, size) => {
      const p = burst.at(ms);
      strokeCircle(context, size / 2, size / 2, p * size * 0.5, {
        color: colors.rgb,
        width: 3 * (1 - p),
        opacity: (1 - p) * 0.5,
      });
    },
  };
};

// ── Rare ────────────────────────────────────────────────────────────────────

const SPIRAL_PARTICLES = 6;

const spiral: Template = (id, colors) => {
  const progress = progressTrack(RARE_DURATION);
  return {
    id,
    completeMs: progress.endMs,
    settleMs: progress.endMs,
    clip: 'square',
    avatar: (ms) => {
      const p = progress.at(ms);
      return [
        pose({ opacity: Math.min(p * 1.5, 1), rotateDeg: (1 - p) * 720, scale: 0.2 + p * 0.8 }),
      ];
    },
    beneath: (context, ms, size) => {
      const t = progress.at(ms);
      for (let i = 0; i < SPIRAL_PARTICLES; i += 1) {
        const angle = (i / SPIRAL_PARTICLES) * Math.PI * 2 + t * Math.PI * 3;
        const radius = size * 0.45 * (1 - t);
        fillCircle(
          context,
          size / 2 + Math.cos(angle) * radius,
          size / 2 + Math.sin(angle) * radius,
          size * 0.025 * (1 - t * 0.5),
          i % 2 === 0 ? colors.rgb : colors.rgbLight,
          0.7 * (1 - t),
        );
      }
    },
  };
};

const SHARDS = 8;
const EXPLODE_DURATION = RARE_DURATION * 0.55;

const shatter: Template = (id, colors) => {
  const explode = track(
    0,
    withTiming(1, { duration: EXPLODE_DURATION, easing: Easing.out(Easing.quad) }),
  );
  const reveal = track(
    0,
    withDelay(
      EXPLODE_DURATION * 0.3,
      withTiming(1, { duration: RARE_DURATION * 0.5, easing: outCubic }),
    ),
  );
  return {
    id,
    completeMs: reveal.endMs,
    settleMs: settleMs(explode, reveal),
    clip: 'square',
    avatar: (ms) => {
      const o = reveal.at(ms);
      return [pose({ opacity: o, scale: 0.8 + o * 0.2 })];
    },
    beneath: (context, ms, size) => {
      const t = explode.at(ms);
      for (let i = 0; i < SHARDS; i += 1) {
        const angle = (i / SHARDS) * Math.PI * 2;
        const dist = t * size * 0.45;
        const x = size / 2 + Math.cos(angle) * dist;
        const y = size / 2 + Math.sin(angle) * dist;
        const half = size * 0.08 * (1 - t * 0.5);
        fillPath(
          context,
          `M ${x} ${y - half} L ${x + half * 0.7} ${y + half * 0.5} L ${x - half * 0.7} ${y + half * 0.5} Z`,
          i % 2 === 0 ? colors.rgb : colors.rgbLight,
          1 - t,
        );
      }
    },
  };
};

const portal: Template = (id, colors) => {
  const open = track(0, withTiming(1, { duration: RARE_DURATION * 0.5, easing: outCubic }));
  const emerge = track(
    0,
    withDelay(
      RARE_DURATION * 0.25,
      withTiming(1, { duration: RARE_DURATION * 0.5, easing: outCubic }),
    ),
  );
  return {
    id,
    completeMs: emerge.endMs,
    settleMs: settleMs(open, emerge),
    clip: 'square',
    avatar: (ms) => {
      const c = emerge.at(ms);
      return [pose({ opacity: c, scale: 0.4 + c * 0.6 })];
    },
    beneath: (context, ms, size) => {
      const o = open.at(ms);
      const c = emerge.at(ms);
      strokeEllipse(context, size / 2, size / 2, size * 0.4 * o, size * 0.45 * o, {
        color: colors.rgbLight,
        width: 2,
        opacity: 0.4 * (1 - c),
      });
      fillEllipse(
        context,
        size / 2,
        size / 2,
        size * 0.3 * o,
        size * 0.35 * o,
        colors.rgb,
        0.6 * (1 - c),
      );
    },
  };
};

const STRIKE_DURATION = RARE_DURATION * 0.35;
const FLASH_DURATION = RARE_DURATION * 0.2;

const lightning: Template = (id, colors) => {
  const strike = track(
    0,
    withTiming(1, { duration: STRIKE_DURATION, easing: Easing.in(Easing.quad) }),
  );
  const flash = track(
    0,
    withDelay(
      STRIKE_DURATION,
      withSequence(
        withTiming(0.8, { duration: FLASH_DURATION * 0.3 }),
        withTiming(0, { duration: FLASH_DURATION * 0.7 }),
      ),
    ),
  );
  const reveal = track(
    0,
    withDelay(STRIKE_DURATION, withTiming(1, { duration: RARE_DURATION * 0.45, easing: outCubic })),
  );
  return {
    id,
    completeMs: reveal.endMs,
    settleMs: settleMs(strike, flash, reveal),
    clip: 'square',
    avatar: (ms) => {
      const o = reveal.at(ms);
      return [pose({ opacity: o, scale: 0.9 + o * 0.1 })];
    },
    beneath: (context, ms, size) => {
      const t = strike.at(ms);
      const cx = size / 2;
      const endY = size * t;
      strokePath(
        context,
        `M ${cx} 0 L ${cx - size * 0.15} ${endY * 0.35} L ${cx + size * 0.1} ${endY * 0.5} L ${cx - size * 0.05} ${endY * 0.7} L ${cx} ${endY}`,
        { color: colors.rgb, width: 3, opacity: 1 - reveal.at(ms), join: 'bevel' },
      );
      fillRect(context, 0, 0, size, size, colors.rgbLight, 0.3 * flash.at(ms));
    },
  };
};

const PETALS = 6;

const bloom: Template = (id, colors) => {
  const progress = progressTrack(RARE_DURATION);
  return {
    id,
    completeMs: progress.endMs,
    settleMs: progress.endMs,
    clip: 'square',
    avatar: (ms) => {
      const p = progress.at(ms);
      return [pose({ opacity: Math.min(p * 2, 1), scale: 0.5 + p * 0.5 })];
    },
    beneath: (context, ms, size) => {
      const t = progress.at(ms);
      for (let i = 0; i < PETALS; i += 1) {
        const angle = (i / PETALS) * Math.PI * 2;
        const dist = t * size * 0.35;
        fillEllipse(
          context,
          size / 2 + Math.cos(angle) * dist,
          size / 2 + Math.sin(angle) * dist,
          size * 0.06 * (0.3 + t * 0.7),
          size * 0.12 * (0.3 + t * 0.7),
          i % 2 === 0 ? colors.rgb : colors.rgbLight,
          0.7 * (1 - t * 0.8),
        );
      }
    },
  };
};

/** Pattern prefix → template, common then rare, as in the catalog. */
const PATTERNS: Readonly<Record<string, Template>> = {
  fade,
  slideUp: slide('up'),
  slideDown: slide('down'),
  zoomIn,
  zoomOut,
  spin,
  bounce,
  flip,
  blur,
  pop,
  spiral,
  shatter,
  portal,
  lightning,
  bloom,
};

/** `<pattern><Colour>Enter`, e.g. `slideUpTealEnter`. */
const GENERATED_ID =
  /^([a-z][A-Za-z]*?)(Red|Orange|Amber|Green|Teal|Blue|Indigo|Purple|Pink|Gray)Enter$/;

const COLOUR_KEYS = {
  Red: 'red',
  Orange: 'orange',
  Amber: 'amber',
  Green: 'green',
  Teal: 'teal',
  Blue: 'blue',
  Indigo: 'indigo',
  Purple: 'purple',
  Pink: 'pink',
  Gray: 'gray',
} as const;

function isColourName(name: string): name is keyof typeof COLOUR_KEYS {
  return name in COLOUR_KEYS;
}

const generated = new Map<string, EntranceSpec>();

/** The entrance of generated catalog id `id`; throws for an id outside the 150. */
export function generatedEntrance(id: string): EntranceSpec {
  let spec = generated.get(id);
  if (!spec) {
    const match = GENERATED_ID.exec(id);
    const template = match ? PATTERNS[match[1]!] : undefined;
    const colour = match?.[2];
    if (!template || colour === undefined || !isColourName(colour)) {
      throw new Error(`"${id}" is not a generated seat entrance`);
    }
    spec = template(id, FLAIR_PALETTE[COLOUR_KEYS[colour]]);
    generated.set(id, spec);
  }
  return spec;
}
