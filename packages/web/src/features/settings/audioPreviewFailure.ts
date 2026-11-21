import { AudioPreviewUnavailableError } from '@/services/infra/AudioService';
import { handleError } from '@/utils/errorPipeline';
import { createLogger } from '@/utils/logger';

const audioPreviewLog = createLogger('MusicSettings');

/** Reports a preview failure with the specific message for audio already owned by a game. */
export function reportAudioPreviewFailure(error: unknown, label: string): void {
  const unavailable = error instanceof AudioPreviewUnavailableError;
  handleError(error, {
    label,
    logger: audioPreviewLog,
    alertMessage: unavailable ? error.message : '试听失败，请检查游戏音频状态和网络后重试',
    isExpected: (value) => value instanceof AudioPreviewUnavailableError,
  });
}
