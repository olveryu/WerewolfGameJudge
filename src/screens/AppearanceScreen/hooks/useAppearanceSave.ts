import type {
  NameStyleId,
  RoleRevealEffectId,
  SeatAnimationId,
} from '@werewolf/game-engine/growth/rewardCatalog';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { toast } from 'sonner-native';

import type { FrameId } from '@/components/avatarFrames';
import type { FlairId } from '@/components/seatFlairs';
import type { IGameFacade } from '@/services/types/IGameFacade';
import { showConfirmAlert, showErrorAlert } from '@/utils/alertPresets';
import { makeBuiltinAvatarUrl } from '@/utils/avatar';
import { getErrorMessage } from '@/utils/errorUtils';
import { settingsLog } from '@/utils/logger';

import type { Selection } from '../types';

interface UseAppearanceSaveParams {
  selected: Selection;
  selectedFrame: FrameId | 'none' | null;
  selectedFlair: FlairId | 'none' | null;
  selectedNameStyle: NameStyleId | 'none' | null;
  selectedEffect: RoleRevealEffectId | 'none' | 'random' | null;
  selectedSeatAnimation: SeatAnimationId | 'none' | null;
  hasSelection: boolean;
  customAvatarUrl: string | null | undefined;
  heroEffectId: string;
  heroEffectUnlocked: boolean;
  heroEffectIsEquipped: boolean;
  heroEffectOptionLabel: string | undefined;
  updateProfile: (patch: Record<string, string>) => Promise<unknown>;
  uploadAvatar: (uri: string) => Promise<string>;
  refreshUser: () => Promise<void>;
  facade: IGameFacade;
  isInRoom: boolean;
  goBack: () => void;
}

export function useAppearanceSave(params: UseAppearanceSaveParams) {
  const [saving, setSaving] = useState(false);
  const ref = useRef(params);
  ref.current = params;

  const handleUpload = useCallback(async () => {
    const p = ref.current;
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== ImagePicker.PermissionStatus.GRANTED) {
        showConfirmAlert(
          '需要相册权限',
          '请在系统设置中开启相册访问权限',
          () => void Linking.openSettings(),
          { confirmText: '去设置' },
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setSaving(true);
        try {
          const url = await p.uploadAvatar(result.assets[0].uri);
          await p.refreshUser();
          toast.success('头像已更新');

          if (p.isInRoom) {
            p.facade
              .updatePlayerProfile(undefined, url)
              .catch((err: unknown) => settingsLog.warn('Avatar sync to GameState failed', err));
          }

          p.goBack();
        } catch (e: unknown) {
          const message = getErrorMessage(e);
          settingsLog.error('Avatar upload failed', { message }, e);
          showErrorAlert('上传失败', message);
        } finally {
          setSaving(false);
        }
      }
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      settingsLog.warn('Image picker failed', { message }, e);
      showErrorAlert('选择图片失败', message);
    }
  }, []);

  const handleConfirm = useCallback(async () => {
    const p = ref.current;
    if (!p.hasSelection) {
      toast.info('未做更改');
      return;
    }
    setSaving(true);
    try {
      // Resolve new avatar URL (if changed)
      let newAvatarUrl: string | undefined;
      if (p.selected === 'default') {
        newAvatarUrl = '';
      } else if (p.selected === 'custom') {
        newAvatarUrl = p.customAvatarUrl ?? undefined;
      } else if (p.selected !== null) {
        newAvatarUrl = makeBuiltinAvatarUrl(p.selected);
      }

      // Resolve new frame (if changed)
      let newFrame: string | undefined;
      if (p.selectedFrame === 'none') {
        newFrame = '';
      } else if (p.selectedFrame !== null) {
        newFrame = p.selectedFrame;
      }

      // Resolve new flair (if changed)
      let newFlair: string | undefined;
      if (p.selectedFlair === 'none') {
        newFlair = '';
      } else if (p.selectedFlair !== null) {
        newFlair = p.selectedFlair;
      }

      // Resolve new nameStyle (if changed)
      let newNameStyle: string | undefined;
      if (p.selectedNameStyle === 'none') {
        newNameStyle = '';
      } else if (p.selectedNameStyle !== null) {
        newNameStyle = p.selectedNameStyle;
      }

      // Resolve new equippedEffect (if changed)
      let newEquippedEffect: string | undefined;
      if (p.selectedEffect === 'none') {
        newEquippedEffect = '';
      } else if (p.selectedEffect !== null) {
        newEquippedEffect = p.selectedEffect;
      }

      // Resolve new seatAnimation (if changed)
      let newSeatAnimation: string | undefined;
      if (p.selectedSeatAnimation === 'none') {
        newSeatAnimation = '';
      } else if (p.selectedSeatAnimation !== null) {
        newSeatAnimation = p.selectedSeatAnimation;
      }

      // Persist to auth profile
      const profilePatch: Record<string, string> = {};
      if (newAvatarUrl !== undefined) profilePatch.avatarUrl = newAvatarUrl;
      if (newFrame !== undefined) profilePatch.avatarFrame = newFrame;
      if (newFlair !== undefined) profilePatch.seatFlair = newFlair;
      if (newNameStyle !== undefined) profilePatch.nameStyle = newNameStyle;
      if (newEquippedEffect !== undefined) profilePatch.equippedEffect = newEquippedEffect;
      if (newSeatAnimation !== undefined) profilePatch.seatAnimation = newSeatAnimation;
      if (Object.keys(profilePatch).length > 0) {
        await p.updateProfile(profilePatch);
        await p.refreshUser();
      }

      // Sync to GameState only when in a room (otherwise no GameState exists)
      let gameStateSyncFailed = false;
      if (
        p.isInRoom &&
        (newAvatarUrl !== undefined ||
          newFrame !== undefined ||
          newFlair !== undefined ||
          newNameStyle !== undefined ||
          newEquippedEffect !== undefined ||
          newSeatAnimation !== undefined)
      ) {
        const result = await p.facade.updatePlayerProfile(
          undefined,
          newAvatarUrl,
          newFrame,
          newFlair,
          newNameStyle,
          newEquippedEffect,
          newSeatAnimation,
        );
        if (!result.success) {
          gameStateSyncFailed = true;
          settingsLog.warn('Cosmetic sync to GameState failed', {
            reason: result.reason,
          });
        }
      }

      if (gameStateSyncFailed) {
        toast.warning('形象已保存，游戏内可能需要重新入座刷新');
      } else {
        toast.success('形象已更新');
      }
      p.goBack();
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      settingsLog.error('Avatar/frame save failed', { message }, e);
      showErrorAlert('保存失败', message);
    } finally {
      setSaving(false);
    }
  }, []);

  const handleEquipEffect = useCallback(async () => {
    const p = ref.current;
    if (p.heroEffectIsEquipped) {
      toast.info('已装备该特效');
      return;
    }
    if (!p.heroEffectUnlocked) {
      showErrorAlert('未解锁', '提升等级后随机解锁');
      return;
    }
    setSaving(true);
    try {
      const value = p.heroEffectId === 'none' ? '' : p.heroEffectId;
      await p.updateProfile({ equippedEffect: value });
      await p.refreshUser();

      // Sync roleRevealEffect to GameState so other players see the change
      if (p.isInRoom) {
        const result = await p.facade.updatePlayerProfile(
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          value,
          undefined,
        );
        if (!result.success) {
          settingsLog.warn('Effect sync to GameState failed', { reason: result.reason });
        }
      }

      toast.success(
        p.heroEffectId === 'none'
          ? '已卸下特效'
          : `已装备「${p.heroEffectOptionLabel ?? p.heroEffectId}」`,
      );
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      settingsLog.error('Equip effect failed', { message }, e);
      showErrorAlert('装备失败', message);
    } finally {
      setSaving(false);
    }
  }, []);

  return { saving, handleUpload, handleConfirm, handleEquipEffect };
}
