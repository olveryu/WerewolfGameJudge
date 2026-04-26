import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getUnlockedAvatars } from '@werewolf/game-engine/growth/frameUnlock';
import {
  isFlairUnlocked,
  isFrameUnlocked,
  isNameStyleUnlocked,
  isRoleRevealEffectUnlocked,
} from '@werewolf/game-engine/growth/frameUnlock';
import {
  getItemRarity,
  type NameStyleId,
  type RoleRevealEffectId,
} from '@werewolf/game-engine/growth/rewardCatalog';
import { useCallback, useMemo, useState } from 'react';

import { AVATAR_FRAMES, type FrameId } from '@/components/avatarFrames';
import type { RevealEffectType } from '@/components/RoleRevealEffects';
import type { FlairId } from '@/components/seatFlairs';
import { getAnimationOption } from '@/components/SettingsSheet/animationOptions';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { useGameFacade } from '@/contexts/GameFacadeContext';
import { useUpdateProfile } from '@/hooks/mutations/useAuthMutations';
import { useUploadAvatar } from '@/hooks/mutations/useUploadAvatar';
import { useUserStatsQuery } from '@/hooks/queries/useUserStatsQuery';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import type { RootStackParamList } from '@/navigation/types';
import { ConnectionStatus } from '@/services/types/IGameFacade';
import { showAlert } from '@/utils/alert';
import { BUILTIN_AVATAR_PREFIX, isBuiltinAvatarUrl, makeBuiltinAvatarUrl } from '@/utils/avatar';
import { getAvatarIcon } from '@/utils/defaultAvatarIcons';

import {
  buildAvatarGridData,
  buildEffectGridData,
  buildFlairGridData,
  buildFrameGridData,
  buildNameStyleGridData,
  filterAvatarGridData,
} from '../gridDataBuilders';
import type { PickerTab, RarityFilter, Selection } from '../types';
import { useAppearanceSave } from './useAppearanceSave';

export function useAppearanceState() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Appearance'>>();
  const { user, refreshUser } = useAuth();
  const { mutateAsync: updateProfile } = useUpdateProfile();
  const { mutateAsync: uploadAvatar } = useUploadAvatar();
  const facade = useGameFacade();
  const { connectionStatus } = useConnectionStatus(facade);
  const isInRoom = connectionStatus === ConnectionStatus.Live;

  const readOnly = !user || (user.isAnonymous ?? false);

  // Resolve current builtin avatar ID (null if not builtin)
  const currentAvatarId = useMemo(() => {
    if (!user?.avatarUrl || !isBuiltinAvatarUrl(user.avatarUrl)) return null;
    return user.avatarUrl.slice(BUILTIN_AVATAR_PREFIX.length);
  }, [user?.avatarUrl]);

  const currentFrameId = user?.avatarFrame ?? null;
  const currentFlairId = user?.seatFlair ?? null;
  const currentNameStyleId = user?.nameStyle ?? null;
  const currentEquippedEffect = user?.equippedEffect ?? null;

  // ── Local selection state ──

  const [selected, setSelected] = useState<Selection>(null);
  const [previewAvatarId, setPreviewAvatarId] = useState<string | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<FrameId | 'none' | null>(null);
  const [selectedFlair, setSelectedFlair] = useState<FlairId | 'none' | null>(null);
  const [selectedNameStyle, setSelectedNameStyle] = useState<NameStyleId | 'none' | null>(null);
  const [selectedEffect, setSelectedEffect] = useState<
    RoleRevealEffectId | 'none' | 'random' | null
  >(null);
  const [activeTab, setActiveTab] = useState<PickerTab>('avatar');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const [previewEffectType, setPreviewEffectType] = useState<RevealEffectType | null>(null);

  // Growth stats for unlock check (shared cache via TanStack Query)
  const { data: statsData } = useUserStatsQuery();
  const unlockedIds = useMemo(() => statsData?.unlockedItems ?? [], [statsData?.unlockedItems]);
  const unlockedAvatars = useMemo(() => getUnlockedAvatars(unlockedIds), [unlockedIds]);

  // ── Derived state ──

  const isDefaultActive = !user?.avatarUrl;
  const isCustomActive = !!user?.customAvatarUrl && user?.avatarUrl === user?.customAvatarUrl;

  const previewAvatarUrl =
    selected === 'default'
      ? null
      : selected === 'custom'
        ? user?.customAvatarUrl
        : selected !== null
          ? makeBuiltinAvatarUrl(selected)
          : user?.avatarUrl;

  const effectiveFrame =
    selectedFrame === 'none' ? null : (selectedFrame ?? currentFrameId ?? null);

  const frameLabel = effectiveFrame
    ? (AVATAR_FRAMES.find((f) => f.id === effectiveFrame)?.name ?? '')
    : '无框';

  const effectiveFlair = selectedFlair === 'none' ? null : (selectedFlair ?? currentFlairId);
  const effectiveNameStyle =
    selectedNameStyle === 'none' ? null : (selectedNameStyle ?? currentNameStyleId);

  const hasSelection =
    selected !== null ||
    selectedFrame !== null ||
    selectedFlair !== null ||
    selectedNameStyle !== null ||
    selectedEffect !== null;

  const isNoFrameActive = !currentFrameId;
  const isNoFlairActive = !currentFlairId;
  const isNoNameStyleActive = !currentNameStyleId;
  const isNoEffectActive = !currentEquippedEffect;
  const isRandomEffectActive = currentEquippedEffect === 'random';

  // ── Grid data ──

  const data = useMemo(
    () => buildAvatarGridData(unlockedAvatars, readOnly, user?.customAvatarUrl),
    [unlockedAvatars, readOnly, user?.customAvatarUrl],
  );

  const frameGridData = useMemo(
    () => buildFrameGridData(unlockedIds, currentFrameId, isNoFrameActive),
    [unlockedIds, currentFrameId, isNoFrameActive],
  );

  const flairGridData = useMemo(
    () => buildFlairGridData(unlockedIds, currentFlairId, isNoFlairActive),
    [unlockedIds, currentFlairId, isNoFlairActive],
  );

  const nameStyleGridData = useMemo(
    () => buildNameStyleGridData(unlockedIds, currentNameStyleId, isNoNameStyleActive),
    [unlockedIds, currentNameStyleId, isNoNameStyleActive],
  );

  const effectGridData = useMemo(
    () =>
      buildEffectGridData(
        unlockedIds,
        currentEquippedEffect,
        isNoEffectActive,
        isRandomEffectActive,
      ),
    [unlockedIds, currentEquippedEffect, isNoEffectActive, isRandomEffectActive],
  );

  // ── Rarity-filtered data ──

  const filteredAvatarData = useMemo(
    () => filterAvatarGridData(data, rarityFilter),
    [data, rarityFilter],
  );

  const filteredFrameData = useMemo(() => {
    if (rarityFilter === 'all') return frameGridData;
    return frameGridData.filter((item) => item.rarity === null || item.rarity === rarityFilter);
  }, [frameGridData, rarityFilter]);

  const filteredFlairData = useMemo(() => {
    if (rarityFilter === 'all') return flairGridData;
    return flairGridData.filter((item) => item.rarity === null || item.rarity === rarityFilter);
  }, [flairGridData, rarityFilter]);

  const filteredNameStyleData = useMemo(() => {
    if (rarityFilter === 'all') return nameStyleGridData;
    return nameStyleGridData.filter((item) => item.rarity === null || item.rarity === rarityFilter);
  }, [nameStyleGridData, rarityFilter]);

  const filteredEffectData = useMemo(() => {
    if (rarityFilter === 'all') return effectGridData;
    return effectGridData.filter((item) => item.rarity === null || item.rarity === rarityFilter);
  }, [effectGridData, rarityFilter]);

  // ── Effect Hero derived state ──

  const heroEffectId = selectedEffect ?? currentEquippedEffect ?? 'none';
  const heroEffectOption = getAnimationOption(
    heroEffectId === 'none' ? 'none' : heroEffectId === 'random' ? 'random' : heroEffectId,
  );
  const heroEffectRarity =
    heroEffectId !== 'none' && heroEffectId !== 'random' ? getItemRarity(heroEffectId) : null;
  const heroEffectUnlocked =
    heroEffectId === 'none' ||
    heroEffectId === 'random' ||
    isRoleRevealEffectUnlocked(heroEffectId as RoleRevealEffectId, unlockedIds);
  const heroEffectIsEquipped =
    heroEffectId === currentEquippedEffect || (heroEffectId === 'none' && !currentEquippedEffect);

  // ── Save operations (async handlers extracted) ──

  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const { saving, handleUpload, handleConfirm, handleEquipEffect } = useAppearanceSave({
    selected,
    selectedFrame,
    selectedFlair,
    selectedNameStyle,
    selectedEffect,
    hasSelection,
    customAvatarUrl: user?.customAvatarUrl,
    heroEffectId,
    heroEffectUnlocked,
    heroEffectIsEquipped,
    heroEffectOptionLabel: heroEffectOption?.label,
    updateProfile,
    uploadAvatar,
    refreshUser,
    facade,
    isInRoom,
    goBack,
  });

  // ── Selection handlers ──

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handlePressDefault = useCallback(() => {
    setSelected('default');
  }, []);

  const handlePressAvatar = useCallback(
    (avatarId: string) => {
      if (readOnly) return;
      if (!unlockedAvatars.has(avatarId)) {
        showAlert('未解锁', '提升等级后可解锁更多头像');
        return;
      }
      setSelected(avatarId);
    },
    [readOnly, unlockedAvatars],
  );

  const handlePressCustom = useCallback(() => {
    setSelected('custom');
  }, []);

  const handlePressFrame = useCallback(
    (frameId: FrameId | 'none') => {
      if (readOnly) return;
      if (frameId !== 'none' && !isFrameUnlocked(frameId, unlockedIds)) {
        showAlert('未解锁', '提升等级后随机解锁');
        return;
      }
      setSelectedFrame(frameId);
    },
    [readOnly, unlockedIds],
  );

  const handlePressFlair = useCallback(
    (flairId: FlairId | 'none') => {
      if (readOnly) return;
      if (flairId !== 'none' && !isFlairUnlocked(flairId, unlockedIds)) {
        showAlert('未解锁', '提升等级后随机解锁');
        return;
      }
      setSelectedFlair(flairId);
    },
    [readOnly, unlockedIds],
  );

  const handlePressNameStyle = useCallback(
    (nameStyleId: NameStyleId | 'none') => {
      if (readOnly) return;
      if (nameStyleId !== 'none' && !isNameStyleUnlocked(nameStyleId, unlockedIds)) {
        showAlert('未解锁', '提升等级后随机解锁');
        return;
      }
      setSelectedNameStyle(nameStyleId);
    },
    [readOnly, unlockedIds],
  );

  const handlePressEffect = useCallback(
    (effectId: RoleRevealEffectId | 'none' | 'random') => {
      if (readOnly) return;
      setSelectedEffect(effectId);
    },
    [readOnly],
  );

  const handleTabChange = useCallback((tab: PickerTab) => {
    setActiveTab(tab);
    setRarityFilter('all');
  }, []);

  const handlePreviewEffect = useCallback(() => {
    if (heroEffectId === 'none' || heroEffectId === 'random') {
      showAlert('无法预览', '请先选择一个具体特效');
      return;
    }
    setPreviewEffectType(heroEffectId as RevealEffectType);
  }, [heroEffectId]);

  const handleLongPress = useCallback((avatarId: string) => {
    setPreviewAvatarId(avatarId);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewAvatarId(null);
  }, []);

  const handleUpgrade = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const wolfPawIcon = useMemo(() => getAvatarIcon(user?.id ?? 'anonymous'), [user?.id]);

  return {
    // Auth
    user,
    readOnly,
    // Tab / filter
    activeTab,
    rarityFilter,
    handleTabChange,
    setRarityFilter,
    // Selection state
    selected,
    selectedFrame,
    selectedFlair,
    selectedNameStyle,
    selectedEffect,
    // Derived
    previewAvatarUrl,
    effectiveFrame,
    frameLabel,
    effectiveFlair,
    effectiveNameStyle,
    hasSelection,
    isDefaultActive,
    isCustomActive,
    currentAvatarId,
    // Grid data (filtered)
    filteredAvatarData,
    filteredFrameData,
    filteredFlairData,
    filteredNameStyleData,
    filteredEffectData,
    // Effect hero
    heroEffectId,
    heroEffectOption,
    heroEffectRarity,
    heroEffectUnlocked,
    heroEffectIsEquipped,
    // Handlers
    handleGoBack,
    handlePressDefault,
    handlePressAvatar,
    handlePressCustom,
    handlePressFrame,
    handlePressFlair,
    handlePressNameStyle,
    handlePressEffect,
    handlePreviewEffect,
    handleEquipEffect,
    handleLongPress,
    handleClosePreview,
    handleUpload,
    handleConfirm,
    handleUpgrade,
    // Preview
    previewAvatarId,
    previewEffectType,
    setPreviewEffectType,
    // Misc
    saving,
    wolfPawIcon,
    unlockedAvatars,
  };
}
