/** Shared room title gestures: admin navigation and password-gated debug visibility. */

import { useNavigation } from '@react-navigation/native';
import { useCallback, useRef } from 'react';

import { verifyAdminPassword } from '@/features/admin/services/adminApi';
import {
  clearAdminCredential,
  readAdminCredential,
  writeAdminCredential,
} from '@/features/admin/services/adminCredentialStore';
import { showAlert, showPrompt } from '@/utils/alert';
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

  const verifyAndToggle = useCallback(async (credential: string) => {
    if (isVerifying.current) return;
    isVerifying.current = true;
    try {
      const valid = await verifyAdminPassword(credential);
      if (!valid) {
        clearAdminCredential();
        roomScreenLog.warn('Admin password rejected');
        showAlert('打开调试日志失败', '管理员密码无效，请重试');
        return;
      }
      writeAdminCredential(credential);
      debugLogStore.toggleVisibility();
    } catch (error: unknown) {
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
    const cached = readAdminCredential();
    if (cached) {
      void verifyAndToggle(cached);
      return;
    }
    showPrompt('Admin 密码', {
      placeholder: '请输入管理员密码',
      onConfirm: (value: string) => {
        const credential = value.trim();
        if (credential) void verifyAndToggle(credential);
      },
    });
  }, [verifyAndToggle]);

  return { handleTitlePress, handleTitleLongPress };
}
