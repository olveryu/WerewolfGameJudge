/**
 * FibKing 身份弹窗：迁到共享 RoleCardSimple 视觉卡（与其他游戏身份卡统一外观）。
 * 数据映射在 FibRoleCardAdapter；可见性由服务端 FibRoundView 裁剪，本组件只展示。
 */

import type { FibRoundView } from '@game-judge/game-engine/games/fibking/public';
import type React from 'react';
import { memo } from 'react';

import { RoleCardSimple } from '@/features/room/components/RoleCardSimple';
import { TESTIDS } from '@/testids';

import { toFibRevealRoleData } from './FibRoleCardAdapter';

interface FibIdentityModalProps {
  readonly view: FibRoundView;
  readonly onClose: () => void;
}

const FibIdentityModalComponent: React.FC<FibIdentityModalProps> = ({ view, onClose }) => (
  <RoleCardSimple
    visible={true}
    role={toFibRevealRoleData(view)}
    onClose={onClose}
    confirmText="知道了"
    testID={TESTIDS.fibIdentityModal}
    nameTestID={TESTIDS.fibIdentityRole}
  />
);

export const FibIdentityModal = memo(FibIdentityModalComponent);
