/**
 * RoomAlertContext — 房间级统一 alert 通道
 *
 * 5 个 room controller（useRoomSeatController、useRoomTitleActions、
 * useRoomShareController、useRoomProfileController、useRoomHostOperations）
 * 都需要弹 alert，但它们被 6 个游戏的 room state hooks 调用，逐层透传
 * state 会导致 30+ 个改动点且合并逻辑复杂。
 *
 * 本 context 在 RoomEntryBoundary 层收敛：controller 只管 push，
 * Boundary 统一渲染一个 <AlertModal>。符合"确认框直接使用 <AlertModal>"规则。
 */

import type React from 'react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import type { AlertButton, AlertInputConfig } from '@/components/AlertModal';
import { AlertModal } from '@/components/AlertModal';

export interface RoomAlertConfig {
  title: string;
  message?: string;
  buttons: AlertButton[];
  input?: AlertInputConfig;
}

interface RoomAlertContextValue {
  /** 显示房间级 alert（替代 showErrorAlert/showConfirmAlert 等） */
  showRoomAlert: (config: RoomAlertConfig) => void;
  /** 关闭当前 alert */
  clearRoomAlert: () => void;
}

const RoomAlertContext = createContext<RoomAlertContextValue | null>(null);

/** 在 room controller 中调用，获取 showRoomAlert */
export function useRoomAlert(): RoomAlertContextValue {
  const ctx = useContext(RoomAlertContext);
  if (!ctx) {
    throw new Error('useRoomAlert must be used within RoomAlertProvider');
  }
  return ctx;
}

/**
 * 可选版本：不在 RoomAlertProvider 内时返回 null 而不是抛错。
 * 供同时被房间内和房间外（配置页）调用的 hook 使用，
 * 调用方在返回 null 时走本地 AlertModal state。
 */
export function useOptionalRoomAlert(): RoomAlertContextValue | null {
  return useContext(RoomAlertContext);
}

/** 供 RoomEntryBoundary 包裹 children，统一渲染 AlertModal */
export const RoomAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alert, setAlert] = useState<RoomAlertConfig | null>(null);

  const showRoomAlert = useCallback((config: RoomAlertConfig) => {
    setAlert(config);
  }, []);

  const clearRoomAlert = useCallback(() => {
    setAlert(null);
  }, []);

  const value = useMemo(() => ({ showRoomAlert, clearRoomAlert }), [showRoomAlert, clearRoomAlert]);

  return (
    <RoomAlertContext.Provider value={value}>
      {children}
      <AlertModal
        visible={alert !== null}
        title={alert?.title ?? ''}
        message={alert?.message}
        buttons={alert?.buttons ?? [{ text: '确定', style: 'default', onPress: clearRoomAlert }]}
        input={alert?.input}
        onClose={clearRoomAlert}
      />
    </RoomAlertContext.Provider>
  );
};
