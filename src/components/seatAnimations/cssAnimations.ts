/**
 * CSS animation utilities for seat entrance animations.
 *
 * Web-only: injects @keyframes into a <style> element (singleton).
 * Each animation component applies animationName/animationDuration/etc via inline style.
 * onComplete timing uses setTimeout — semantically identical to Reanimated's withTiming callback.
 */
import { Platform } from 'react-native';

// ── Easing constants ────────────────────────────────────────────────────────

/** CSS equivalent of Easing.out(Easing.cubic) */
export const EASE_OUT_CUBIC = 'cubic-bezier(0.33, 1, 0.68, 1)';

/** CSS equivalent of Easing.out(Easing.back(1.5)) — overshoot */
export const EASE_OUT_BACK = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

// ── Keyframe registry ───────────────────────────────────────────────────────

const registeredKeyframes = new Set<string>();
let styleElement: HTMLStyleElement | null = null;

function getStyleElement(): HTMLStyleElement {
  if (styleElement) return styleElement;
  styleElement = document.createElement('style');
  styleElement.setAttribute('data-seat-animations', '1');
  document.head.appendChild(styleElement);
  return styleElement;
}

/**
 * Register a CSS @keyframes rule. Idempotent — duplicate names are skipped.
 * Must be called before the animation is used (typically at module load time).
 */
export function registerKeyframes(name: string, rule: string): void {
  if (Platform.OS !== 'web') return;
  if (registeredKeyframes.has(name)) return;
  registeredKeyframes.add(name);
  const el = getStyleElement();
  el.textContent += `@keyframes ${name}{${rule}}\n`;
}

// ── Animation style builder ─────────────────────────────────────────────────

interface AnimationStyleOptions {
  name: string;
  duration: number;
  delay?: number;
  easing?: string;
  fillMode?: string;
}

/**
 * Build a web-compatible inline style object for a CSS animation.
 * Returns an object with camelCase CSS animation properties.
 */
export function buildAnimationStyle(opts: AnimationStyleOptions): Record<string, string> {
  return {
    animationName: opts.name,
    animationDuration: `${opts.duration}ms`,
    animationDelay: opts.delay ? `${opts.delay}ms` : '0ms',
    animationTimingFunction: opts.easing ?? EASE_OUT_CUBIC,
    animationFillMode: opts.fillMode ?? 'forwards',
  };
}

/**
 * Build style for multiple simultaneous animations on one element.
 */
export function buildMultiAnimationStyle(
  animations: AnimationStyleOptions[],
): Record<string, string> {
  return {
    animationName: animations.map((a) => a.name).join(', '),
    animationDuration: animations.map((a) => `${a.duration}ms`).join(', '),
    animationDelay: animations.map((a) => `${a.delay ?? 0}ms`).join(', '),
    animationTimingFunction: animations.map((a) => a.easing ?? EASE_OUT_CUBIC).join(', '),
    animationFillMode: animations.map((a) => a.fillMode ?? 'forwards').join(', '),
  };
}

// ── Common keyframes ────────────────────────────────────────────────────────
// Registered at module load time so they're available before first render.

// Simple fade: opacity 0 → 1
registerKeyframes('seatFadeIn', 'from{opacity:0}to{opacity:1}');

// Slide up: translateY(40%) + opacity 0 → translateY(0) + opacity 1
registerKeyframes(
  'seatSlideUp',
  'from{opacity:0;transform:translateY(40%)}to{opacity:1;transform:translateY(0)}',
);

// Slide down: translateY(-40%) + opacity 0 → translateY(0) + opacity 1
registerKeyframes(
  'seatSlideDown',
  'from{opacity:0;transform:translateY(-40%)}to{opacity:1;transform:translateY(0)}',
);

// Zoom in: scale(0) → scale(1), with opacity leading (reaching 1 at 50%)
registerKeyframes(
  'seatZoomIn',
  '0%{opacity:0;transform:scale(0)}50%{opacity:1;transform:scale(0.5)}100%{opacity:1;transform:scale(1)}',
);

// Zoom out: scale(2) → scale(1), with opacity leading
registerKeyframes(
  'seatZoomOut',
  '0%{opacity:0;transform:scale(2)}50%{opacity:1;transform:scale(1.5)}100%{opacity:1;transform:scale(1)}',
);

// Spin: rotate(360deg) + scale(0.5) → rotate(0) + scale(1), opacity leading (×1.5 rate)
registerKeyframes(
  'seatSpin',
  '0%{opacity:0;transform:rotate(360deg) scale(0.5)}33%{opacity:1;transform:rotate(240deg) scale(0.67)}100%{opacity:1;transform:rotate(0deg) scale(1)}',
);

// Flip: rotateY(180deg) + opacity 0 → rotateY(0) + opacity 1
registerKeyframes(
  'seatFlip',
  'from{opacity:0;transform:perspective(800px) rotateY(180deg)}to{opacity:1;transform:perspective(800px) rotateY(0deg)}',
);

// Blur: scale(1.15) + opacity 0 → scale(1) + opacity 1
registerKeyframes(
  'seatBlur',
  'from{opacity:0;transform:scale(1.15)}to{opacity:1;transform:scale(1)}',
);

// Pop: spring-like scale overshoot (damping=6, stiffness=200 approximation)
registerKeyframes(
  'seatPopScale',
  '0%{transform:scale(0)}30%{transform:scale(1.2)}50%{transform:scale(0.92)}70%{transform:scale(1.05)}85%{transform:scale(0.98)}100%{transform:scale(1)}',
);

// Bounce: spring-like translateY (damping=8, stiffness=180 approximation)
registerKeyframes(
  'seatBounceY',
  '0%{transform:translateY(-50%)}35%{transform:translateY(8%)}55%{transform:translateY(-3%)}75%{transform:translateY(1%)}100%{transform:translateY(0)}',
);

// Quick fade for pop/bounce (10-15% of duration)
registerKeyframes('seatQuickFade', 'from{opacity:0}to{opacity:1}');

// Spiral: rotate(720deg) + scale(0) + opacity 0 → final, opacity leads ×2
registerKeyframes(
  'seatSpiral',
  '0%{opacity:0;transform:rotate(720deg) scale(0)}50%{opacity:1;transform:rotate(360deg) scale(0.5)}100%{opacity:1;transform:rotate(0deg) scale(1)}',
);

// Portal: scaleY(0) + scaleX(0.5) + opacity 0 → scaleY(1) + scaleX(1) + opacity 1
registerKeyframes(
  'seatPortal',
  'from{opacity:0;transform:scaleY(0) scaleX(0.5)}to{opacity:1;transform:scaleY(1) scaleX(1)}',
);

// Bloom: scale(0.5) + opacity 0 → final, opacity leads ×2
registerKeyframes(
  'seatBloom',
  '0%{opacity:0;transform:scale(0.5)}50%{opacity:1;transform:scale(0.75)}100%{opacity:1;transform:scale(1)}',
);

// Shatter child reveal: scale(0.8) + opacity 0 → scale(1) + opacity 1
registerKeyframes(
  'seatShatter',
  'from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}',
);

// Lightning child reveal: scale(0.9) + opacity 0 → scale(1) + opacity 1
registerKeyframes(
  'seatLightning',
  'from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}',
);

// Lightning flash: 0 → 0.6 → 0 in 250ms total
registerKeyframes('seatLightningFlash', '0%{opacity:0}20%{opacity:0.6}100%{opacity:0}');

// Epic flash: 0 → 0.35 → 0 in 250ms
registerKeyframes('seatEpicFlash', '0%{opacity:0}40%{opacity:0.35}100%{opacity:0}');

// Epic/Legendary child reveal (opacity only) — used with animationDelay
registerKeyframes('seatRevealFade', 'from{opacity:0}to{opacity:1}');

// Epic child scale spring (various start values, all go to 1)
registerKeyframes(
  'seatRevealSpring06',
  '0%{transform:scale(0.6)}40%{transform:scale(1.06)}65%{transform:scale(0.97)}85%{transform:scale(1.01)}100%{transform:scale(1)}',
);
registerKeyframes(
  'seatRevealSpring07',
  '0%{transform:scale(0.7)}40%{transform:scale(1.05)}65%{transform:scale(0.97)}85%{transform:scale(1.01)}100%{transform:scale(1)}',
);
registerKeyframes(
  'seatRevealSpring08',
  '0%{transform:scale(0.8)}40%{transform:scale(1.04)}65%{transform:scale(0.98)}85%{transform:scale(1.01)}100%{transform:scale(1)}',
);

// Legendary transforms derived from opacity — baked into single keyframe sets
registerKeyframes(
  'seatLegendaryScale050',
  'from{opacity:0;transform:scale(0.5)}to{opacity:1;transform:scale(1)}',
);
registerKeyframes(
  'seatLegendaryScale070',
  'from{opacity:0;transform:scale(0.7)}to{opacity:1;transform:scale(1)}',
);
registerKeyframes(
  'seatLegendaryScale080',
  'from{opacity:0;transform:scale(0.8)}to{opacity:1;transform:scale(1)}',
);
registerKeyframes(
  'seatLegendaryScale085',
  'from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}',
);
registerKeyframes(
  'seatLegendaryScale090',
  'from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}',
);
registerKeyframes(
  'seatLegendaryFlip',
  'from{opacity:0;transform:perspective(800px) rotateY(90deg)}to{opacity:1;transform:perspective(800px) rotateY(0deg)}',
);
registerKeyframes(
  'seatLegendarySlideUp',
  'from{opacity:0;transform:translateY(10%)}to{opacity:1;transform:translateY(0)}',
);
