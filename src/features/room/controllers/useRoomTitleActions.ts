/** Shared room title gestures: admin navigation and identity-gated debug visibility. */

import { useNavigation } from '@react-navigation/native';
import { useCallback, useRef } from 'react';

import { AdminApiError, getAdminWhoAmI } from '@/features/admin/services/adminApi';
import { showAlert } from '@/utils/alert';
import { debugLogStore } from '@/utils/debugLogStore';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

const TAP_THRESHOLD = 4;
const TAP_TIMEOUT_MS = 3000;

/** Compose title callbacks without reading or mutating game state. */
export function useRoomTitleActions() {
  const navigation = useNavigation();
  const lastTap = useRef<number | null>(null);
  const tapCountRef = useRef(0);
  const isVerifying = useRef(false);

  const verifyAndToggle = useCallback(async () => {
    if (isVerifying.current) return;
    isVerifying.current = true;
    try {
      // Only admins can toggle the debug log; the worker checks the caller's
      // JWT identity (users.is_admin or the super-admin allowlist).
      await getAdminWhoAmI();
      debugLogStore.toggleVisibility();
    } catch (error: unknown) {
      if (error instanceof AdminApiError && (error.status === 401 || error.status === 403)) {
        roomScreenLog.warn('Admin identity rejected for debug log');
        showAlert('打开调试日志失败', '需要管理员权限');
        return;
      }
      handleError(error, { label: '打开调试日志', logger: roomScreenLog });
    } finally {
      isVerifying.current = false;
    }
  }, []);

  const handleTitlePress = useCallback(() => {
    const now = Date.now();
    tapCountRef.current =
      lastTap.current !== null && now - lastTap.current <= TAP_TIMEOUT_MS
        ? tapCountRef.current + 1
        : 1;
    if (tapCountRef.current >= TAP_THRESHOLD) {
      lastTap.current = null;
      tapCountRef.current = 0;
      navigation.navigate('Admin');
      return;
    }
    lastTap.current = now;
  }, [navigation]);

  const handleTitleLongPress = useCallback(() => {
    lastTap.current = null;
    tapCountRef.current = 0;
    void verifyAndToggle();
  }, [verifyAndToggle]);

  return { handleTitlePress, handleTitleLongPress };
}
