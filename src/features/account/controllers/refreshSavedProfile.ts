/** Refresh confirmed profile writes without relabeling a successful save as a failed write. */
import { handleError } from '@/utils/errorPipeline';
import { isAbortError, isExpectedError } from '@/utils/errorUtils';
import { settingsLog } from '@/utils/logger';

/** Returns false for a refresh failure; callers must display the saved-but-not-refreshed outcome. */
export async function refreshSavedProfile(refreshUser: () => Promise<void>): Promise<boolean> {
  try {
    await refreshUser();
    return true;
  } catch (error) {
    if (isAbortError(error)) throw error;
    handleError(error, {
      label: '刷新已保存的资料',
      logger: settingsLog,
      feedback: false,
      isExpected: isExpectedError,
    });
    return false;
  }
}
