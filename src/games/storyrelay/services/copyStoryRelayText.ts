/** Exports explicitly selected story text; never sends prose to telemetry or remote storage. */

import { Platform, Share } from 'react-native';

import { showDismissAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

/** Copies text on web and opens the native text-sharing sheet on installed clients. */
export async function copyStoryRelayText(text: string): Promise<void> {
  try {
    if (Platform.OS !== 'web') {
      await Share.share({ message: text });
      return;
    }
    if (typeof navigator === 'undefined' || navigator.clipboard === undefined)
      throw new Error('Clipboard is unavailable');
    await navigator.clipboard.writeText(text);
    showDismissAlert('已复制', '故事正文已复制');
  } catch (error: unknown) {
    handleError(error, {
      label: '复制故事',
      logger: roomScreenLog,
      alertMessage: '复制失败，可选中正文手动复制',
    });
  }
}
