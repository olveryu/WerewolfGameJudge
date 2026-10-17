/**
 * Avalon night step definitions: the single declaration point for the
 * three confirmation steps — each step's narration keys and its
 * participant derivation (the seats that must confirm). Step order
 * itself lives only in AVALON_NIGHT_STEPS (state/types); this table is
 * an unordered Record keyed by step, and a contract test pins the two
 * key sets equal. No IO.
 */

import { type AvalonNightStep, type AvalonRoleId, isAvalonEvilRole } from '../state/types';

export interface AvalonNightStepDef {
  readonly step: AvalonNightStep;
  /** 本步开始音（开夜批第二段、转场批第二段取下一步的此值）。 */
  readonly audioKey: string;
  /**
   * 本步结束音。现行三步的结束段与开始段同 key，故缺省不写、派生为
   * audioKey——与狼人杀 StepSpec.audioEndKey? 的「缺省回落」形态一致。
   */
  readonly audioEndKey?: string;
  /** 本步确认集派生（roles → 必须确认的座位）。 */
  readonly participants: (roles: Readonly<Record<number, AvalonRoleId>>) => readonly number[];
}

export const AVALON_NIGHT_STEP_DEFS: Readonly<Record<AvalonNightStep, AvalonNightStepDef>> = {
  evilReveal: {
    step: 'evilReveal',
    audioKey: 'evil_reveal',
    participants: (roles) => {
      const seats = Object.keys(roles).map(Number);
      // 坏人互认：奥伯伦全程闭眼，不参与、不确认。
      return seats.filter((seat) => isAvalonEvilRole(roles[seat]!) && roles[seat] !== 'oberon');
    },
  },
  merlinReveal: {
    step: 'merlinReveal',
    audioKey: 'merlin_reveal',
    participants: (roles) => {
      const seats = Object.keys(roles).map(Number);
      return seats.filter((seat) => roles[seat] === 'merlin');
    },
  },
  percivalReveal: {
    step: 'percivalReveal',
    audioKey: 'percival_reveal',
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

/** The step's end narration key: the explicit end key, else its begin key. */
export function getAvalonNightStepEndKey(def: AvalonNightStepDef): string {
  return def.audioEndKey ?? def.audioKey;
}
