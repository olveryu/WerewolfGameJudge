/**
 * 阿瓦隆第一晚播报 asset registry — 对齐狼人杀 audioRegistry。
 *
 * key 到 mp3 的严格映射；engine 的 AudioEffect.audioKey 必须在这里有对应，
 * 缺失时 fail-fast（MissingAvalonAudioError）。
 *
 * Begin 与 end 是两个独立维度：evilReveal 的 begin 随奥伯伦是否在场分
 * 两个 key，end 恒为同一个 key，故 begin 表与 end 表分开建，不用成对
 * 表给 begin-only 的 key 硬配一个永远播不到的 end。
 */

import type { AudioClip } from '@/features/product/model/AudioClip';

import evilRevealBegin from '../../../../../../assets/audio_avalon/evil_reveal.mp3';
import evilRevealExceptOberonBegin from '../../../../../../assets/audio_avalon/evil_reveal_except_oberon.mp3';
import merlinRevealBegin from '../../../../../../assets/audio_avalon/merlin_reveal.mp3';
import nightBegin from '../../../../../../assets/audio_avalon/night.mp3';
import nightEndBegin from '../../../../../../assets/audio_avalon/night_end.mp3';
import percivalRevealBegin from '../../../../../../assets/audio_avalon/percival_reveal.mp3';
import evilRevealEnd from '../../../../../../assets/audio_avalon_end/evil_reveal.mp3';
import merlinRevealEnd from '../../../../../../assets/audio_avalon_end/merlin_reveal.mp3';
import percivalRevealEnd from '../../../../../../assets/audio_avalon_end/percival_reveal.mp3';

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

const BEGIN_AUDIO: Readonly<Record<string, string>> = {
  evil_reveal: evilRevealBegin,
  evil_reveal_except_oberon: evilRevealExceptOberonBegin,
  merlin_reveal: merlinRevealBegin,
  percival_reveal: percivalRevealBegin,
};

const END_AUDIO: Readonly<Record<string, string>> = {
  evil_reveal: evilRevealEnd,
  merlin_reveal: merlinRevealEnd,
  percival_reveal: percivalRevealEnd,
};

const NIGHT_AUDIO: AudioClip = { key: 'night', url: nightBegin };
const NIGHT_END_AUDIO: AudioClip = { key: 'night_end', url: nightEndBegin };

/** 解析 begin 播报（isEndAudio=false）；night / night_end 走专用 key。
 * 注意：night_end 虽然是"结束语"，但 engine 排队时不设 isEndAudio，走 beginning
 * 路径解析（registry 内特判）。行为正确，语义上容易误导，特此说明。 */
export function resolveAvalonBeginningAudio(audioKey: string): AudioClip {
  if (audioKey === 'night') return NIGHT_AUDIO;
  if (audioKey === 'night_end') return NIGHT_END_AUDIO;
  const url = BEGIN_AUDIO[audioKey];
  if (url === undefined) throw new MissingAvalonAudioError('beginning', audioKey);
  return { key: `step_begin_${audioKey}`, url };
}

/** 解析 end 播报（isEndAudio=true）。 */
export function resolveAvalonEndingAudio(audioKey: string): AudioClip {
  const url = END_AUDIO[audioKey];
  if (url === undefined) throw new MissingAvalonAudioError('ending', audioKey);
  return { key: `step_end_${audioKey}`, url };
}

/** 开局预加载全部 9 段（对齐狼人杀 getWerewolfPreloadAudio）。 */
export function getAvalonPreloadAudio(): readonly AudioClip[] {
  return [
    NIGHT_AUDIO,
    NIGHT_END_AUDIO,
    { key: 'step_begin_evil_reveal', url: evilRevealBegin },
    { key: 'step_begin_evil_reveal_except_oberon', url: evilRevealExceptOberonBegin },
    { key: 'step_end_evil_reveal', url: evilRevealEnd },
    { key: 'step_begin_merlin_reveal', url: merlinRevealBegin },
    { key: 'step_end_merlin_reveal', url: merlinRevealEnd },
    { key: 'step_begin_percival_reveal', url: percivalRevealBegin },
    { key: 'step_end_percival_reveal', url: percivalRevealEnd },
  ];
}
