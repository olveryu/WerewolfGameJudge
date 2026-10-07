/**
 * 阿瓦隆第一晚播报 asset registry — 对齐狼人杀 audioRegistry。
 *
 * key 到 mp3 的严格映射；engine 的 AvalonAudioEffect.audioKey 必须在这里有对应，
 * 缺失时 fail-fast（MissingAvalonAudioError）。
 */

import type { AudioAsset, AudioClip } from '@/features/product/model/AudioClip';

import evilRevealBegin from '../../../../assets/audio_avalon/evil_reveal.mp3';
import merlinRevealBegin from '../../../../assets/audio_avalon/merlin_reveal.mp3';
import nightBegin from '../../../../assets/audio_avalon/night.mp3';
import nightEndBegin from '../../../../assets/audio_avalon/night_end.mp3';
import percivalRevealBegin from '../../../../assets/audio_avalon/percival_reveal.mp3';
import evilRevealEnd from '../../../../assets/audio_avalon_end/evil_reveal.mp3';
import merlinRevealEnd from '../../../../assets/audio_avalon_end/merlin_reveal.mp3';
import percivalRevealEnd from '../../../../assets/audio_avalon_end/percival_reveal.mp3';

/** Programming error raised when an engine audio key has no client asset. */
export class MissingAvalonAudioError extends Error {
  constructor(
    readonly phase: 'beginning' | 'ending',
    readonly audioKey: string,
  ) {
    super(`[FAIL-FAST] Missing Avalon ${phase} audio for ${audioKey}`);
    this.name = 'MissingAvalonAudioError';
  }
}

interface AvalonStepAudioEntry {
  readonly begin: AudioAsset;
  readonly end: AudioAsset;
}

const STEP_AUDIO: Readonly<Record<string, AvalonStepAudioEntry>> = {
  evil_reveal: { begin: evilRevealBegin, end: evilRevealEnd },
  merlin_reveal: { begin: merlinRevealBegin, end: merlinRevealEnd },
  percival_reveal: { begin: percivalRevealBegin, end: percivalRevealEnd },
};

const NIGHT_AUDIO: AudioClip = { key: 'night', asset: nightBegin };
const NIGHT_END_AUDIO: AudioClip = { key: 'night_end', asset: nightEndBegin };

/** 解析 begin 播报（isEndAudio=false）；night / night_end 走专用 key。 */
export function resolveAvalonBeginningAudio(audioKey: string): AudioClip {
  if (audioKey === 'night') return NIGHT_AUDIO;
  if (audioKey === 'night_end') return NIGHT_END_AUDIO;
  const entry = STEP_AUDIO[audioKey];
  if (entry === undefined) throw new MissingAvalonAudioError('beginning', audioKey);
  return { key: `step_begin_${audioKey}`, asset: entry.begin };
}

/** 解析 end 播报（isEndAudio=true）。 */
export function resolveAvalonEndingAudio(audioKey: string): AudioClip {
  const entry = STEP_AUDIO[audioKey];
  if (entry === undefined) throw new MissingAvalonAudioError('ending', audioKey);
  return { key: `step_end_${audioKey}`, asset: entry.end };
}

/** 开局预加载全部 8 段（对齐狼人杀 getWerewolfPreloadAudio）。 */
export function getAvalonPreloadAudio(): readonly AudioClip[] {
  return [
    NIGHT_AUDIO,
    NIGHT_END_AUDIO,
    { key: 'step_begin_evil_reveal', asset: evilRevealBegin },
    { key: 'step_end_evil_reveal', asset: evilRevealEnd },
    { key: 'step_begin_merlin_reveal', asset: merlinRevealBegin },
    { key: 'step_end_merlin_reveal', asset: merlinRevealEnd },
    { key: 'step_begin_percival_reveal', asset: percivalRevealBegin },
    { key: 'step_end_percival_reveal', asset: percivalRevealEnd },
  ];
}
