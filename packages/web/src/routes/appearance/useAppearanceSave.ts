/** Appearance page writes: avatar upload, saving the draft, and equipping a reveal effect. */
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { makeBuiltinAvatarUrl } from '@/components/avatar/avatarSources';
import { refreshSavedProfile } from '@/features/account/accountMutations';
import { syncActiveRoomProfile } from '@/features/account/syncActiveRoomProfile';
import type { RevealEffectSelectionId } from '@/features/product/model/GameProductUi';
import type { ActiveRoomAccountSnapshot } from '@/features/room/model/RoomAccountCapability';
import { showErrorAlert } from '@/utils/alertPresets';
import { getUserFacingMessage } from '@/utils/errorUtils';
import { createLogger } from '@/utils/logger';

import type { Selection } from './types';

const appearanceLog = createLogger('Appearance');

/** The account fields the appearance page writes. */
interface AppearanceProfilePatch {
  avatarUrl?: string;
  avatarFrame?: string;
  seatFlair?: string;
  nameStyle?: string;
  equippedEffect?: string;
  seatAnimation?: string;
}

interface AppearanceSaveParams {
  readonly selected: Selection;
  readonly selectedFrame: Selection;
  readonly selectedFlair: Selection;
  readonly selectedNameStyle: Selection;
  readonly selectedEffect: RevealEffectSelectionId | null;
  readonly selectedSeatAnimation: Selection;
  readonly hasSelection: boolean;
  readonly customAvatarUrl: string | null;
  readonly heroEffectId: RevealEffectSelectionId;
  readonly heroEffectUnlocked: boolean;
  readonly heroEffectIsEquipped: boolean;
  readonly heroEffectOptionLabel: string;
  readonly updateProfile: (patch: AppearanceProfilePatch) => Promise<unknown>;
  readonly uploadAvatar: (file: File) => Promise<string>;
  readonly refreshUser: () => Promise<void>;
  readonly activeRoom: ActiveRoomAccountSnapshot;
  readonly goBack: () => void;
}

/** `none` clears the item (empty string); null leaves it unchanged. */
function toPatchValue(selection: Selection): string | undefined {
  if (selection === null) return undefined;
  return selection === 'none' ? '' : selection;
}

function resolveAvatarUrl(selected: Selection, customAvatarUrl: string | null): string | undefined {
  if (selected === 'default') return '';
  if (selected === 'custom') return customAvatarUrl ?? undefined;
  return selected === null ? undefined : makeBuiltinAvatarUrl(selected);
}

/** Drops unchanged fields so the account write only carries the draft. */
function definedFields(patch: AppearanceProfilePatch): AppearanceProfilePatch {
  return Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
}

interface SaveScope {
  isActive: boolean;
  isSaving: boolean;
}

/**
 * Appearance writes. Each task stops after any await once the page unmounts, and only one runs at
 * a time; a failure keeps the draft so the user can retry.
 */
export function useAppearanceSave(params: AppearanceSaveParams) {
  const [saving, setSaving] = useState(false);
  const lifetime = useRef<SaveScope | null>(null);
  useEffect(() => {
    const scope: SaveScope = { isActive: true, isSaving: false };
    lifetime.current = scope;
    return () => {
      scope.isActive = false;
    };
  }, []);

  /** Starts a write task, or returns null when the page is gone or another write is running. */
  const beginTask = (): SaveScope | null => {
    const scope = lifetime.current;
    if (!scope?.isActive || scope.isSaving) return null;
    scope.isSaving = true;
    setSaving(true);
    return scope;
  };

  const endTask = (scope: SaveScope) => {
    scope.isSaving = false;
    if (scope.isActive) setSaving(false);
  };

  const handleUpload = async (file: File) => {
    const scope = beginTask();
    if (scope === null) return;
    try {
      const url = await params.uploadAvatar(file);
      if (!scope.isActive) return;
      const isProfileRefreshed = await refreshSavedProfile(params.refreshUser);
      if (!scope.isActive) return;
      const roomSynced = await syncActiveRoomProfile(params.activeRoom, { avatarUrl: url });
      if (!scope.isActive) return;
      if (!isProfileRefreshed) toast.warning('头像已保存，资料刷新失败');
      else if (roomSynced) toast.success('头像已更新');
      else toast.warning('头像已保存，房间内同步失败');
      params.goBack();
    } catch (error: unknown) {
      if (!scope.isActive) return;
      appearanceLog.error('Avatar upload failed', error);
      showErrorAlert('上传失败', getUserFacingMessage(error));
    } finally {
      endTask(scope);
    }
  };

  const handleConfirm = async () => {
    if (!params.hasSelection) {
      throw new Error('[FAIL-FAST] Appearance confirm requires a pending selection');
    }
    const scope = beginTask();
    if (scope === null) return;
    try {
      const patch = definedFields({
        avatarUrl: resolveAvatarUrl(params.selected, params.customAvatarUrl),
        avatarFrame: toPatchValue(params.selectedFrame),
        seatFlair: toPatchValue(params.selectedFlair),
        nameStyle: toPatchValue(params.selectedNameStyle),
        equippedEffect: toPatchValue(params.selectedEffect),
        seatAnimation: toPatchValue(params.selectedSeatAnimation),
      });
      if (Object.keys(patch).length > 0) await params.updateProfile(patch);
      if (!scope.isActive) return;
      const isProfileRefreshed = await refreshSavedProfile(params.refreshUser);
      if (!scope.isActive) return;
      const roomSynced =
        Object.keys(patch).length === 0 ||
        (await syncActiveRoomProfile(params.activeRoom, {
          avatarUrl: patch.avatarUrl,
          avatarFrame: patch.avatarFrame,
          seatFlair: patch.seatFlair,
          nameStyle: patch.nameStyle,
          revealEffect: patch.equippedEffect,
          seatAnimation: patch.seatAnimation,
        }));
      if (!scope.isActive) return;
      if (!isProfileRefreshed) toast.warning('形象已保存，资料刷新失败');
      else if (!roomSynced) toast.warning('形象已保存，游戏内可能需要重新入座刷新');
      else toast.success('形象已更新');
      params.goBack();
    } catch (error: unknown) {
      if (!scope.isActive) return;
      appearanceLog.error('Appearance save failed', error);
      showErrorAlert('保存失败', getUserFacingMessage(error));
    } finally {
      endTask(scope);
    }
  };

  const handleConfirmUnavailable = () => {
    if (params.hasSelection) {
      throw new Error('[FAIL-FAST] Appearance unavailable feedback requires no pending selection');
    }
    toast.info('未做更改');
  };

  const handleEquipEffect = async () => {
    if (params.heroEffectIsEquipped || !params.heroEffectUnlocked) {
      throw new Error('[FAIL-FAST] Equip effect requires an unlocked, unequipped effect');
    }
    const scope = beginTask();
    if (scope === null) return;
    try {
      const value = params.heroEffectId === 'none' ? '' : params.heroEffectId;
      await params.updateProfile({ equippedEffect: value });
      if (!scope.isActive) return;
      const isProfileRefreshed = await refreshSavedProfile(params.refreshUser);
      if (!scope.isActive) return;
      const roomSynced = await syncActiveRoomProfile(params.activeRoom, { revealEffect: value });
      if (!scope.isActive) return;
      if (!isProfileRefreshed) {
        toast.warning('特效已保存，资料刷新失败');
      } else if (roomSynced) {
        toast.success(
          params.heroEffectId === 'none'
            ? '已卸下特效'
            : `已装备「${params.heroEffectOptionLabel}」`,
        );
      } else {
        toast.warning('特效已保存，房间内同步失败');
      }
    } catch (error: unknown) {
      if (!scope.isActive) return;
      appearanceLog.error('Equip effect failed', error);
      showErrorAlert('装备失败', getUserFacingMessage(error));
    } finally {
      endTask(scope);
    }
  };

  const handleEquipEffectUnavailable = () => {
    if (params.heroEffectIsEquipped) {
      if (!params.heroEffectUnlocked) {
        throw new Error('[FAIL-FAST] Equipped effect must be unlocked');
      }
      toast.info('已装备该特效');
      return;
    }
    if (!params.heroEffectUnlocked) {
      showErrorAlert('未解锁', '提升等级后随机解锁');
      return;
    }
    throw new Error('[FAIL-FAST] Equip effect unavailable feedback requires a disabled action');
  };

  return {
    saving,
    handleUpload,
    handleConfirm,
    handleConfirmUnavailable,
    handleEquipEffect,
    handleEquipEffectUnavailable,
  };
}
