/** Appearance page draft state: current items, the draft selection, grids and press handlers. */
import {
  getItemRarity,
  getUnlockedAvatars,
  isFlairUnlocked,
  isFrameUnlocked,
  isNameStyleUnlocked,
  isRoleRevealEffectUnlocked,
  isSeatAnimationUnlocked,
  type Rarity,
  type RoleRevealEffectId,
} from '@game-judge/game-engine/product/rewards';
import { useMemo, useState } from 'react';

import { makeBuiltinAvatarUrl, parseBuiltinAvatarId } from '@/components/avatar/avatarSources';
import type { User } from '@/contexts/AuthContext';
import type { CosmeticTab, RarityFilter } from '@/features/product/components/CosmeticTabs';
import type { ClientProductUi } from '@/features/product/model/ClientProductUi';
import { FRAME_NAMES } from '@/features/product/model/cosmeticNames';
import type { RevealEffectSelectionId } from '@/features/product/model/GameProductUi';
import { showAlert } from '@/utils/alert';

import {
  buildAvatarGridData,
  buildEffectGridData,
  buildFlairGridData,
  buildFrameGridData,
  buildNameStyleGridData,
  buildSeatAnimationGridData,
  filterAvatarGridData,
  filterGridDataByRarity,
} from './gridData';
import type { Selection } from './types';

/** The draft value wins; `none` clears; otherwise the equipped item stays. */
function effectiveItem(selection: Selection, current: string | null): string | null {
  if (selection === 'none') return null;
  return selection ?? current;
}

function alertLockedReward() {
  showAlert('未解锁', '提升等级后随机解锁');
}

/** A picker's press handler: read-only accounts ignore presses; locked items explain why. */
function makeItemPress(
  readOnly: boolean,
  isUnlocked: (id: string) => boolean,
  select: (id: string) => void,
) {
  return (id: string) => {
    if (readOnly) return;
    if (id !== 'none' && !isUnlocked(id)) {
      alertLockedReward();
      return;
    }
    select(id);
  };
}

interface AppearanceStateParams {
  readonly user: User | null;
  readonly unlockedIds: readonly string[];
  readonly productUi: ClientProductUi;
}

/** Draft state for the appearance page; the save hook turns the selection into account writes. */
export function useAppearanceState({ user, unlockedIds, productUi }: AppearanceStateParams) {
  const readOnly = !user || user.isAnonymous;
  const customAvatarUrl = user?.customAvatarUrl ?? null;
  const currentAvatarId = parseBuiltinAvatarId(user?.avatarUrl ?? null);
  const currentFrameId = user?.avatarFrame ?? null;
  const currentFlairId = user?.seatFlair ?? null;
  const currentNameStyleId = user?.nameStyle ?? null;
  const currentEquippedEffect = user?.equippedEffect ?? null;
  const currentSeatAnimationId = user?.seatAnimation ?? null;

  const [selected, setSelected] = useState<Selection>(null);
  const [previewAvatarId, setPreviewAvatarId] = useState<string | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<Selection>(null);
  const [selectedFlair, setSelectedFlair] = useState<Selection>(null);
  const [selectedNameStyle, setSelectedNameStyle] = useState<Selection>(null);
  const [selectedEffect, setSelectedEffect] = useState<RevealEffectSelectionId | null>(null);
  const [selectedSeatAnimation, setSelectedSeatAnimation] = useState<Selection>(null);
  const [activeTab, setActiveTab] = useState<CosmeticTab>('avatar');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const [previewEffectId, setPreviewEffectId] = useState<RoleRevealEffectId | null>(null);

  const unlockedAvatars = useMemo(() => getUnlockedAvatars(unlockedIds), [unlockedIds]);
  const avatarGrid = useMemo(
    () => buildAvatarGridData(unlockedAvatars, readOnly, customAvatarUrl),
    [unlockedAvatars, readOnly, customAvatarUrl],
  );
  const frameGrid = useMemo(
    () => buildFrameGridData(unlockedIds, currentFrameId),
    [unlockedIds, currentFrameId],
  );
  const flairGrid = useMemo(
    () => buildFlairGridData(unlockedIds, currentFlairId),
    [unlockedIds, currentFlairId],
  );
  const nameStyleGrid = useMemo(
    () => buildNameStyleGridData(unlockedIds, currentNameStyleId),
    [unlockedIds, currentNameStyleId],
  );
  const effectGrid = useMemo(
    () => buildEffectGridData(productUi, unlockedIds, currentEquippedEffect),
    [productUi, unlockedIds, currentEquippedEffect],
  );
  const seatAnimationGrid = useMemo(
    () => buildSeatAnimationGridData(unlockedIds, currentSeatAnimationId),
    [unlockedIds, currentSeatAnimationId],
  );

  const isDefaultActive = !user?.avatarUrl;
  const isCustomActive = !!customAvatarUrl && user?.avatarUrl === customAvatarUrl;

  let previewAvatarUrl: string | null;
  if (selected === 'default') previewAvatarUrl = null;
  else if (selected === 'custom') previewAvatarUrl = customAvatarUrl;
  else if (selected !== null) previewAvatarUrl = makeBuiltinAvatarUrl(selected);
  else previewAvatarUrl = user?.avatarUrl ?? null;

  const effectiveFrame = effectiveItem(selectedFrame, currentFrameId);
  const effectiveFlair = effectiveItem(selectedFlair, currentFlairId);
  const effectiveNameStyle = effectiveItem(selectedNameStyle, currentNameStyleId);
  const frameLabel = effectiveFrame ? (FRAME_NAMES[effectiveFrame] ?? '') : '无框';

  const hasSelection =
    selected !== null ||
    selectedFrame !== null ||
    selectedFlair !== null ||
    selectedNameStyle !== null ||
    selectedEffect !== null ||
    selectedSeatAnimation !== null;

  const heroEffectId: RevealEffectSelectionId =
    selectedEffect ?? effectGrid.find((item) => item.isActive)?.id ?? 'none';
  const heroEffectPresentation = productUi.getRevealEffectPresentation(heroEffectId);
  const isConcreteEffect = heroEffectId !== 'none' && heroEffectId !== 'random';
  const heroEffectRarity: Rarity | null = isConcreteEffect ? getItemRarity(heroEffectId) : null;
  const heroEffectUnlocked =
    !isConcreteEffect || isRoleRevealEffectUnlocked(heroEffectId, unlockedIds);
  const heroEffectIsEquipped =
    heroEffectId === currentEquippedEffect || (heroEffectId === 'none' && !currentEquippedEffect);

  const handleSelectAvatar = (cellId: string) => {
    if (readOnly) return;
    if (cellId !== 'default' && cellId !== 'custom' && !unlockedAvatars.has(cellId)) {
      showAlert('未解锁', '提升等级后可解锁更多头像');
      return;
    }
    setSelected(cellId);
  };

  const handleSelectEffect = (id: RevealEffectSelectionId) => {
    if (readOnly) return;
    setSelectedEffect(id);
  };

  const handleChangeTab = (tab: CosmeticTab) => {
    setActiveTab(tab);
    setRarityFilter('all');
  };

  const handlePreviewEffect = () => {
    if (heroEffectId === 'none' || heroEffectId === 'random') {
      throw new Error('[FAIL-FAST] Only a concrete reveal effect can be previewed');
    }
    setPreviewEffectId(heroEffectId);
  };

  return {
    readOnly,
    customAvatarUrl,
    currentAvatarId,
    isDefaultActive,
    isCustomActive,
    unlockedAvatars,
    selected,
    selectedFrame,
    selectedFlair,
    selectedNameStyle,
    selectedEffect,
    selectedSeatAnimation,
    hasSelection,
    previewAvatarUrl,
    previewAvatarId,
    effectiveFrame,
    effectiveFlair,
    effectiveNameStyle,
    frameLabel,
    activeTab,
    rarityFilter,
    avatarGrid: filterAvatarGridData(avatarGrid, rarityFilter),
    frameGrid: filterGridDataByRarity(frameGrid, rarityFilter),
    flairGrid: filterGridDataByRarity(flairGrid, rarityFilter),
    nameStyleGrid: filterGridDataByRarity(nameStyleGrid, rarityFilter),
    effectGrid: filterGridDataByRarity(effectGrid, rarityFilter),
    seatAnimationGrid: filterGridDataByRarity(seatAnimationGrid, rarityFilter),
    heroEffectId,
    heroEffectPresentation,
    heroEffectRarity,
    heroEffectUnlocked,
    heroEffectIsEquipped,
    previewEffectId,
    handleSelectAvatar,
    handleSelectFrame: makeItemPress(
      readOnly,
      (id) => isFrameUnlocked(id, unlockedIds),
      setSelectedFrame,
    ),
    handleSelectFlair: makeItemPress(
      readOnly,
      (id) => isFlairUnlocked(id, unlockedIds),
      setSelectedFlair,
    ),
    handleSelectNameStyle: makeItemPress(
      readOnly,
      (id) => isNameStyleUnlocked(id, unlockedIds),
      setSelectedNameStyle,
    ),
    handleSelectSeatAnimation: makeItemPress(
      readOnly,
      (id) => isSeatAnimationUnlocked(id, unlockedIds),
      setSelectedSeatAnimation,
    ),
    handleSelectEffect,
    handleChangeTab,
    setRarityFilter,
    setPreviewAvatarId,
    handlePreviewEffect,
    handlePreviewEffectUnavailable: () => showAlert('无法预览', '请先选择一个具体特效'),
    closeEffectPreview: () => setPreviewEffectId(null),
  };
}

export type AppearanceState = ReturnType<typeof useAppearanceState>;
