/** Shared room title gestures: admin navigation and password-gated debug visibility. */

import { useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';

import { useAdminShortcut } from '@/features/admin/hooks/useAdminShortcut';
import { verifyAdminPassword } from '@/features/admin/services/adminAuth';
import {
  clearAdminCredential,
  readAdminCredential,
  writeAdminCredential,
} from '@/features/admin/services/adminCredentialStore';
import { showAlert, showPrompt } from '@/utils/alert';
import { debugLogStore } from '@/utils/debugLogStore';
import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

/** Compose title callbacks without reading or mutating game state. */
export function useRoomTitleActions() {
  const navigate = useNavigate();
  const { onPress: handleTitlePress, reset: resetAdminShortcut } = useAdminShortcut(() => {
    void navigate('/admin');
  });
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

  const handleTitleLongPress = useCallback(() => {
    resetAdminShortcut();
    const cached = readAdminCredential();
    if (cached) {
      void verifyAndToggle(cached);
      return;
    }
    showPrompt('管理员密码', {
      placeholder: '请输入管理员密码',
      onConfirm: (value: string) => {
        const credential = value.trim();
        if (credential) void verifyAndToggle(credential);
      },
    });
  }, [resetAdminShortcut, verifyAndToggle]);

  return { handleTitlePress, handleTitleLongPress };
}
