/**
 * Avalon night step definitions: the single declaration point for the
 * three confirmation steps — each step's narration keys and its
 * participant derivation (the seats that must confirm). Step order
 * itself lives only in AVALON_NIGHT_STEPS (state/types); this table is
 * an unordered Record keyed by step, and a contract test pins the two
 * key sets equal. No IO.
 *
 * Narration keys are roles-derived, like the participant sets: the
 * evilReveal opening names Oberon only when Oberon is actually dealt,
 * so begin/end keys are functions of the dealt roles, not static
 * strings. The end key never varies with Oberon — the closing line is
 * the same "坏人请闭眼。" in every board.
 */

import { type AvalonNightStep, type AvalonRoleId, isAvalonEvilRole } from '../state/types';

export interface AvalonNightStepDef {
  readonly step: AvalonNightStep;
  /** 本步开始音（开夜批第二段、转场批第二段、重连重播均取此值）。 */
  readonly beginAudioKey: (roles: Readonly<Record<number, AvalonRoleId>>) => string;
  /** 本步结束音（转场批第一段取此值）。 */
  readonly endAudioKey: (roles: Readonly<Record<number, AvalonRoleId>>) => string;
  /** 本步确认集派生（roles → 必须确认的座位）。 */
  readonly participants: (roles: Readonly<Record<number, AvalonRoleId>>) => readonly number[];
}

function isOberonRole(role: AvalonRoleId): boolean {
  return role === 'oberon';
}

function hasOberonRole(roles: Readonly<Record<number, AvalonRoleId>>): boolean {
  return Object.values(roles).some(isOberonRole);
}

export const AVALON_NIGHT_STEP_DEFS: Readonly<Record<AvalonNightStep, AvalonNightStepDef>> = {
  evilReveal: {
    step: 'evilReveal',
    beginAudioKey: (roles) => (hasOberonRole(roles) ? 'evil_reveal_except_oberon' : 'evil_reveal'),
    endAudioKey: () => 'evil_reveal',
    participants: (roles) => {
      const seats = Object.keys(roles).map(Number);
      // 坏人互认：奥伯伦全程闭眼，不参与、不确认。
      return seats.filter((seat) => isAvalonEvilRole(roles[seat]!) && !isOberonRole(roles[seat]!));
    },
  },
  merlinReveal: {
    step: 'merlinReveal',
    beginAudioKey: () => 'merlin_reveal',
    endAudioKey: () => 'merlin_reveal',
    participants: (roles) => {
      const seats = Object.keys(roles).map(Number);
      return seats.filter((seat) => roles[seat] === 'merlin');
    },
  },
  percivalReveal: {
    step: 'percivalReveal',
    beginAudioKey: () => 'percival_reveal',
    endAudioKey: () => 'percival_reveal',
    participants: (roles) => {
      const seats = Object.keys(roles).map(Number);
      return seats.filter((seat) => roles[seat] === 'percival');
    },
  },
};

/** Reads one step's definition from the table. */
export function getAvalonNightStepDef(step: AvalonNightStep): AvalonNightStepDef {
  return AVALON_NIGHT_STEP_DEFS[step];
}

/** The step's opening narration key for the dealt roles. */
export function getAvalonNightStepBeginAudioKey(
  step: AvalonNightStep,
  roles: Readonly<Record<number, AvalonRoleId>>,
): string {
  return getAvalonNightStepDef(step).beginAudioKey(roles);
}

/** The step's closing narration key for the dealt roles. */
export function getAvalonNightStepEndAudioKey(
  step: AvalonNightStep,
  roles: Readonly<Record<number, AvalonRoleId>>,
): string {
  return getAvalonNightStepDef(step).endAudioKey(roles);
}
