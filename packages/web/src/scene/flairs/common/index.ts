/**
 * Generated seat flairs: 10 common patterns × 10 colours and 5 rare patterns × 10 colours, keyed
 * `${prefix}${Colour}` like the reward catalog (e.g. `pulseRed`, `auroraTeal`).
 */
import type { DecorationSpec } from '@/scene/decoration';

import {
  breatheTemplate,
  driftTemplate,
  type FlairTemplate,
  flickerTemplate,
  floatTemplate,
  glowTemplate,
  orbitTemplate,
  pulseTemplate,
  rippleTemplate,
  sparkleTemplate,
  waveTemplate,
} from './commonPatterns';
import { FLAIR_PALETTE, FLAIR_PALETTE_KEYS } from './palette';
import {
  auroraTemplate,
  cascadeTemplate,
  constellationTemplate,
  fireflyTemplate,
  vortexTemplate,
} from './rarePatterns';

const PATTERNS: readonly { prefix: string; template: FlairTemplate }[] = [
  { prefix: 'pulse', template: pulseTemplate },
  { prefix: 'glow', template: glowTemplate },
  { prefix: 'sparkle', template: sparkleTemplate },
  { prefix: 'breathe', template: breatheTemplate },
  { prefix: 'float', template: floatTemplate },
  { prefix: 'ripple', template: rippleTemplate },
  { prefix: 'orbit', template: orbitTemplate },
  { prefix: 'flicker', template: flickerTemplate },
  { prefix: 'drift', template: driftTemplate },
  { prefix: 'wave', template: waveTemplate },
  { prefix: 'cascade', template: cascadeTemplate },
  { prefix: 'vortex', template: vortexTemplate },
  { prefix: 'constellation', template: constellationTemplate },
  { prefix: 'aurora', template: auroraTemplate },
  { prefix: 'firefly', template: fireflyTemplate },
];

/** The 150 generated flair specs, keyed by flair id. */
export const GENERATED_FLAIR_SPECS: ReadonlyMap<string, DecorationSpec> = new Map(
  PATTERNS.flatMap(({ prefix, template }) =>
    FLAIR_PALETTE_KEYS.map((colorKey) => {
      const id = `${prefix}${colorKey[0]!.toUpperCase()}${colorKey.slice(1)}`;
      return [id, { id, nodes: template(FLAIR_PALETTE[colorKey]) }] as const;
    }),
  ),
);
