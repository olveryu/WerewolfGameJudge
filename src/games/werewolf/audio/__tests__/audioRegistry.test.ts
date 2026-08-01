import { NIGHT_STEPS } from '@game-judge/game-engine/games/werewolf/public';

import {
  getWerewolfPreloadAudio,
  MissingWerewolfAudioError,
  resolveWerewolfBeginningAudio,
  resolveWerewolfEndingAudio,
} from '@/games/werewolf/audio/audioRegistry';

describe('Werewolf audio registry', () => {
  it('resolves every beginning and ending key emitted by the engine night plan', () => {
    for (const step of NIGHT_STEPS) {
      expect(() => resolveWerewolfBeginningAudio(step.audioKey)).not.toThrow();
      expect(() => resolveWerewolfEndingAudio(step.audioEndKey ?? step.audioKey)).not.toThrow();
    }
  });

  it('resolves role, seer-label, and step-specific narration keys', () => {
    expect(resolveWerewolfBeginningAudio('wolf').key).toBe('role_begin_wolf');
    expect(resolveWerewolfEndingAudio('seer_1').key).toBe('role_end_seer_1');
    expect(resolveWerewolfBeginningAudio('piperHypnotizedReveal').key).toBe(
      'role_begin_piperHypnotizedReveal',
    );
  });

  it('fails fast when the engine emits an unregistered narration key', () => {
    expect(() => resolveWerewolfBeginningAudio('unknown')).toThrow(MissingWerewolfAudioError);
    expect(() => resolveWerewolfBeginningAudio('unknown')).toThrow(
      '[FAIL-FAST] Missing Werewolf beginning audio for unknown',
    );
    expect(() => resolveWerewolfEndingAudio('unknown')).toThrow(MissingWerewolfAudioError);
  });

  it('preloads night clips and deduplicates repeated role clips', () => {
    const clips = getWerewolfPreloadAudio(['wolf', 'villager', 'wolf']);

    expect(clips.map((clip) => clip.key)).toEqual([
      'night',
      'night_end',
      'role_begin_wolf',
      'role_end_wolf',
    ]);
  });
});
