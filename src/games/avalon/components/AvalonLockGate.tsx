/**
 * 阿瓦隆临时上锁：进入前需输入密码（用户 2026-10-07 要求，密码 369，还不能玩）。
 * 解锁状态保存在模块级变量，App 重启后重新上锁。
 */

import { useState } from 'react';

import { AlertModal } from '@/components/AlertModal';

/** 临时锁密码；用户要求 369。 */
const AVALON_LOCK_PASSWORD = '369';

let isAvalonUnlocked = false;

export function AvalonLockGate({ children }: { readonly children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(isAvalonUnlocked);
  const [error, setError] = useState<string | null>(null);

  if (unlocked) return <>{children}</>;

  return (
    <AlertModal
      visible
      title="阿瓦隆暂未开放"
      message={error ?? '请输入密码进入'}
      onClose={() => {
        // 关闭后留在原地，不进入。
      }}
      input={{
        placeholder: '密码',
      }}
      buttons={[
        {
          text: '取消',
          style: 'cancel',
          onPress: () => {
            // 取消后留在原地，不进入。
          },
        },
        {
          text: '确定',
          onPress: (inputValue) => {
            if (inputValue === AVALON_LOCK_PASSWORD) {
              isAvalonUnlocked = true;
              setUnlocked(true);
              setError(null);
            } else {
              setError('密码错误');
            }
          },
        },
      ]}
    />
  );
}
