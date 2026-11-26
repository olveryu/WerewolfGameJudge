import {
  createAudioContext,
  ensureAudioContextRunning,
} from '@/services/infra/audio/AudioContextOwner';
import { audioLog } from '@/utils/logger';

/** Plays a short synthesized rattle without loading external media. */
export async function playDiceRattle(): Promise<boolean> {
  const context = createAudioContext();
  if (context === null || !(await ensureAudioContextRunning())) {
    audioLog.warn('Toolbox dice: audio is unavailable');
    return false;
  }
  const duration = 1.3;
  const buffer = context.createBuffer(
    1,
    Math.ceil(context.sampleRate * duration),
    context.sampleRate,
  );
  const samples = buffer.getChannelData(0);
  for (const hit of [0.08, 0.21, 0.35, 0.49, 0.64, 0.79, 0.97, 1.15]) {
    const start = Math.floor(hit * context.sampleRate);
    const length = Math.floor(0.06 * context.sampleRate);
    const noise = crypto.getRandomValues(new Uint16Array(length));
    for (let index = 0; index < length && start + index < samples.length; index++) {
      const whiteNoise = (noise[index] ?? 0) / 32767.5 - 1;
      samples[start + index] = whiteNoise * Math.exp((-index / length) * 7) * 0.22;
    }
  }
  const source = context.createBufferSource();
  const filter = context.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1400;
  filter.Q.value = 0.7;
  source.buffer = buffer;
  source.connect(filter);
  filter.connect(context.destination);
  source.onended = () => {
    source.disconnect();
    filter.disconnect();
  };
  source.start();
  return true;
}
