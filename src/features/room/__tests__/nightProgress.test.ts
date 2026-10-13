/**
 * resolveStepProgress — the shared night/step progress derivation.
 * Both nightPhase games (werewolf, avalon) must route their night
 * ribbon through it; the source scan keeps a hand-rolled second
 * derivation from coming back.
 */
import fs from 'node:fs';
import path from 'node:path';

import { resolveStepProgress } from '../model/nightProgress';

const STEPS = ['evilReveal', 'merlinReveal', 'percivalReveal'] as const;
const LABELS = {
  evilReveal: '坏人互认',
  merlinReveal: '梅林的视野',
  percivalReveal: '派西维尔的视野',
} as const;

describe('resolveStepProgress', () => {
  it('resolves 1-based progress with the step label', () => {
    expect(resolveStepProgress(STEPS, 'evilReveal', LABELS)).toEqual({
      current: 1,
      total: 3,
      label: '坏人互认',
    });
    expect(resolveStepProgress(STEPS, 'percivalReveal', LABELS)).toEqual({
      current: 3,
      total: 3,
      label: '派西维尔的视野',
    });
  });

  it('returns null for a step outside the list or without a label', () => {
    expect(resolveStepProgress(STEPS, 'unknown' as never, LABELS)).toBeNull();
    expect(resolveStepProgress(STEPS, 'merlinReveal', { evilReveal: '坏人互认' })).toBeNull();
  });
});

describe('night ribbon derivation is shared by both nightPhase games', () => {
  const readSource = (relativePath: string) =>
    fs.readFileSync(path.resolve(__dirname, '../../..', relativePath), 'utf8');

  it('werewolf and avalon adapters both derive through resolveStepProgress', () => {
    expect(readSource('games/werewolf/werewolfRoomAdapter.ts')).toContain('resolveStepProgress(');
    expect(readSource('games/avalon/room/avalonRoomAdapter.ts')).toContain('resolveStepProgress(');
  });
});
