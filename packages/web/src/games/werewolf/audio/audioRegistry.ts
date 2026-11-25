/**
 * Werewolf narration assets discovered from their filenames.
 *
 * Product BGM and platform playback stay outside this registry.
 */

import {
  type RoleId,
  WEREWOLF_STEP_AUDIO_DECLARATIONS,
} from '@game-judge/game-engine/games/werewolf/public';

import type { AudioClip } from '@/features/product/model/AudioClip';

const beginningAudioFiles = import.meta.glob<string>('../../../../../../assets/audio/*.mp3', {
  eager: true,
  import: 'default',
});
const endingAudioFiles = import.meta.glob<string>('../../../../../../assets/audio_end/*.mp3', {
  eager: true,
  import: 'default',
});

function indexAudioFiles(files: Readonly<Record<string, string>>): ReadonlyMap<string, string> {
  return new Map(
    Object.entries(files).map(([path, url]) => {
      const filename = path.slice(path.lastIndexOf('/') + 1);
      if (!filename.endsWith('.mp3')) {
        throw new Error(`[FAIL-FAST] Unsupported Werewolf narration asset ${path}`);
      }
      return [filename.slice(0, -'.mp3'.length), url];
    }),
  );
}

const BEGINNING_AUDIO_URLS = indexAudioFiles(beginningAudioFiles);
const ENDING_AUDIO_URLS = indexAudioFiles(endingAudioFiles);
const FIRST_ROLE_AUDIO = new Map<string, (typeof WEREWOLF_STEP_AUDIO_DECLARATIONS)[number]>();
for (const declaration of WEREWOLF_STEP_AUDIO_DECLARATIONS) {
  if (!FIRST_ROLE_AUDIO.has(declaration.roleId)) {
    FIRST_ROLE_AUDIO.set(declaration.roleId, declaration);
  }
}

/** Programming error raised when engine narration metadata has no client asset. */
export class MissingWerewolfAudioError extends Error {
  constructor(
    readonly phase: 'beginning' | 'ending',
    readonly audioKey: string,
  ) {
    super(`[FAIL-FAST] Missing Werewolf ${phase} audio for ${audioKey}`);
    this.name = 'MissingWerewolfAudioError';
  }
}

function audioFilenameKey(audioKey: string): string {
  return audioKey.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function resolveAudioUrl(audioKey: string, phase: 'beginning' | 'ending'): string {
  const urls = phase === 'beginning' ? BEGINNING_AUDIO_URLS : ENDING_AUDIO_URLS;
  const declaredRoleAudio = FIRST_ROLE_AUDIO.get(audioKey);
  const declaredKey = declaredRoleAudio?.[phase === 'beginning' ? 'begin' : 'end'];
  const url =
    urls.get(audioFilenameKey(audioKey)) ??
    (declaredKey === null || declaredKey === undefined
      ? undefined
      : urls.get(audioFilenameKey(declaredKey)));
  if (url === undefined) throw new MissingWerewolfAudioError(phase, audioKey);
  return url;
}

/** Resolve a beginning narration key using its snake_case asset filename. */
export function resolveWerewolfBeginningAudio(audioKey: string): AudioClip {
  return { key: `role_begin_${audioKey}`, url: resolveAudioUrl(audioKey, 'beginning') };
}

/** Resolve an ending narration key using its snake_case asset filename. */
export function resolveWerewolfEndingAudio(audioKey: string): AudioClip {
  return { key: `role_end_${audioKey}`, url: resolveAudioUrl(audioKey, 'ending') };
}

/** “天黑请闭眼” audio clip. */
const NIGHT_AUDIO: AudioClip = {
  key: 'night',
  url: resolveAudioUrl('night', 'beginning'),
};
/** “天亮请睁眼” audio clip. */
const NIGHT_END_AUDIO: AudioClip = {
  key: 'night_end',
  url: resolveAudioUrl('night_end', 'beginning'),
};

export function getWerewolfNightAudio(): AudioClip {
  return NIGHT_AUDIO;
}

export function getWerewolfNightEndAudio(): AudioClip {
  return NIGHT_END_AUDIO;
}

export function getWerewolfPreloadAudio(roles: readonly RoleId[]): readonly AudioClip[] {
  const clips = new Map<string, AudioClip>([
    [NIGHT_AUDIO.key, NIGHT_AUDIO],
    [NIGHT_END_AUDIO.key, NIGHT_END_AUDIO],
  ]);
  for (const role of roles) {
    const firstStepAudio = FIRST_ROLE_AUDIO.get(role);
    if (firstStepAudio === undefined) continue;
    if (firstStepAudio.begin !== null) {
      const begin = resolveWerewolfBeginningAudio(firstStepAudio.begin);
      clips.set(`role_begin_${role}`, { key: `role_begin_${role}`, url: begin.url });
    }
    if (firstStepAudio.end !== null) {
      const end = resolveWerewolfEndingAudio(firstStepAudio.end);
      clips.set(`role_end_${role}`, { key: `role_end_${role}`, url: end.url });
    }
  }
  return [...clips.values()];
}
