/**
 * AvatarPickerScreen - 头像与头像框选择（全屏 Screen）
 *
 * 两个 Tab：「头像」（自定义 + 内置 4 列网格）和「头像框」（3×2 大尺寸试穿网格）。
 * 顶部 Hero 预览区实时合成头像 + 框效果，两个 Tab 共享。
 * 支持选中 + 确认保存 + 长按预览。
 * Orchestrator 层：调用 auth service 保存 + facade 同步 GameState。
 * 不承载其他设置功能。
 */
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getUnlockedAvatars, isFrameUnlocked } from '@werewolf/game-engine/growth/frameUnlock';
import { isFlairUnlocked, isNameStyleUnlocked } from '@werewolf/game-engine/growth/frameUnlock';
import {
  getItemRarity,
  type NameStyleId,
  type Rarity,
} from '@werewolf/game-engine/growth/rewardCatalog';
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  ImageSourcePropType,
  Linking,
  ListRenderItemInfo,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { toast } from 'sonner-native';

import { AVATAR_FRAMES, type FrameId } from '@/components/avatarFrames';
import { AvatarWithFrame } from '@/components/AvatarWithFrame';
import { Button } from '@/components/Button';
import { NAME_STYLES, NameStyleText } from '@/components/nameStyles';
import { type FlairId, getFlairById, SEAT_FLAIRS } from '@/components/seatFlairs';
import { UI_ICONS } from '@/config/iconTokens';
import { RARITY_ORDER, RARITY_VISUAL } from '@/config/rarityVisual';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { useGameFacade } from '@/contexts/GameFacadeContext';
import { useUserStatsQuery } from '@/hooks/queries/useUserStatsQuery';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { RootStackParamList } from '@/navigation/types';
import { ConnectionStatus } from '@/services/types/IGameFacade';
import {
  borderRadius as borderRadiusToken,
  colors,
  componentSizes,
  fixed,
  layout,
  withAlpha,
} from '@/theme';
import { showAlert } from '@/utils/alert';
import { showConfirmAlert, showErrorAlert } from '@/utils/alertPresets';
import {
  AVATAR_IMAGES,
  AVATAR_KEYS,
  BUILTIN_AVATAR_PREFIX,
  getAvatarImageByIndex,
  getAvatarThumbByIndex,
  isBuiltinAvatarUrl,
  makeBuiltinAvatarUrl,
} from '@/utils/avatar';
import { getAvatarIcon } from '@/utils/defaultAvatarIcons';
import { getErrorMessage } from '@/utils/errorUtils';
import { settingsLog } from '@/utils/logger';

import { type AvatarPickerScreenStyles, createAvatarPickerScreenStyles } from './components';

const NUM_COLUMNS = 4;
const FRAME_NUM_COLUMNS = 3;
const FRAME_GRID_CELL_SIZE = 72;
const HERO_PREVIEW_SIZE = 80;

type Selection = number | 'custom' | 'default' | null;
type PickerTab = 'avatar' | 'frame' | 'flair' | 'nameStyle';

type RarityFilter = 'all' | Rarity;

/** Discriminated union for all avatar grid cells: special (default/custom) + builtin + placeholder */
type AvatarCellItem =
  | { key: string; type: 'default' }
  | { key: string; type: 'custom' }
  | { key: string; type: 'builtin'; index: number }
  | { key: string; type: 'placeholder' };

/** Unified item type for frame/flair FlatLists, including the "none" sentinel. */
interface FrameGridItem {
  id: FrameId | 'none';
  name: string;
  unlocked: boolean;
  isActive: boolean;
  rarity: Rarity | null;
}

interface FlairGridItem {
  id: FlairId | 'none';
  name: string;
  unlocked: boolean;
  isActive: boolean;
  rarity: Rarity | null;
}

interface NameStyleGridItem {
  id: NameStyleId | 'none';
  name: string;
  unlocked: boolean;
  isActive: boolean;
  rarity: Rarity | null;
}

export const AvatarPickerScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createAvatarPickerScreenStyles(colors), []);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'AvatarPicker'>>();
  const { user, updateProfile, uploadAvatar } = useAuth();
  const facade = useGameFacade();
  const { connectionStatus } = useConnectionStatus(facade);
  const isInRoom = connectionStatus === ConnectionStatus.Live;

  const readOnly = !user || (user.isAnonymous ?? false);

  // Resolve current builtin avatar index (-1 if not builtin)
  const currentBuiltinIndex = useMemo(() => {
    if (!user?.avatarUrl || !isBuiltinAvatarUrl(user.avatarUrl)) return -1;
    const key = user.avatarUrl.slice(BUILTIN_AVATAR_PREFIX.length);
    return (AVATAR_KEYS as readonly string[]).indexOf(key);
  }, [user?.avatarUrl]);

  const currentFrameId = user?.avatarFrame ?? null;
  const currentFlairId = user?.seatFlair ?? null;
  const currentNameStyleId = user?.nameStyle ?? null;

  // ── Local selection state ──

  const [selected, setSelected] = useState<Selection>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<FrameId | 'none' | null>(null);
  const [selectedFlair, setSelectedFlair] = useState<FlairId | 'none' | null>(null);
  const [selectedNameStyle, setSelectedNameStyle] = useState<NameStyleId | 'none' | null>(null);
  const [activeTab, setActiveTab] = useState<PickerTab>('avatar');
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
  const [saving, setSaving] = useState(false);

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
        : typeof selected === 'number'
          ? makeBuiltinAvatarUrl(selected)
          : user?.avatarUrl;

  const effectiveFrame =
    selectedFrame === 'none' ? null : (selectedFrame ?? currentFrameId ?? null);

  const frameLabel = effectiveFrame
    ? (AVATAR_FRAMES.find((f) => f.id === effectiveFrame)?.name ?? '')
    : '无框';

  const hasSelection =
    selected !== null ||
    selectedFrame !== null ||
    selectedFlair !== null ||
    selectedNameStyle !== null;

  const isNoFrameActive = !currentFrameId;
  const isNoFlairActive = !currentFlairId;
  const isNoNameStyleActive = !currentNameStyleId;

  // ── Grid data ──

  const data: AvatarCellItem[] = useMemo(() => {
    // Special cells: default wolf paw + custom avatar (bypass rarity filter)
    const specials: AvatarCellItem[] = readOnly
      ? []
      : [{ key: 'special-default', type: 'default' }];
    if (!readOnly && user?.customAvatarUrl) {
      specials.push({ key: 'special-custom', type: 'custom' });
    }

    const builtins: AvatarCellItem[] = AVATAR_IMAGES.map((_, i) => ({
      key: String(i),
      type: 'builtin' as const,
      index: i,
    }));
    // Sort: unlocked first, locked last
    builtins.sort((a, b) => {
      if (a.type !== 'builtin' || b.type !== 'builtin') return 0;
      const aUnlocked = unlockedAvatars.has(AVATAR_KEYS[a.index]);
      const bUnlocked = unlockedAvatars.has(AVATAR_KEYS[b.index]);
      if (aUnlocked === bUnlocked) return 0;
      return aUnlocked ? -1 : 1;
    });

    const items = [...specials, ...builtins];
    const remainder = items.length % NUM_COLUMNS;
    if (remainder !== 0) {
      for (let i = 0; i < NUM_COLUMNS - remainder; i++) {
        items.push({ key: `placeholder-${i}`, type: 'placeholder' });
      }
    }
    return items;
  }, [unlockedAvatars, readOnly, user?.customAvatarUrl]);

  /** Sorted frame grid data — "none" sentinel + unlocked-first order. */
  const frameGridData: FrameGridItem[] = useMemo(() => {
    const none: FrameGridItem = {
      id: 'none',
      name: '无',
      unlocked: true,
      isActive: isNoFrameActive,
      rarity: null,
    };
    const items: FrameGridItem[] = AVATAR_FRAMES.map((f) => ({
      id: f.id,
      name: f.name,
      unlocked: isFrameUnlocked(f.id, unlockedIds),
      isActive: currentFrameId === f.id,
      rarity: getItemRarity(f.id),
    }));
    items.sort((a, b) => Number(a.unlocked ? 0 : 1) - Number(b.unlocked ? 0 : 1));
    return [none, ...items];
  }, [unlockedIds, currentFrameId, isNoFrameActive]);

  /** Sorted flair grid data — "none" sentinel + unlocked-first order. */
  const flairGridData: FlairGridItem[] = useMemo(() => {
    const none: FlairGridItem = {
      id: 'none',
      name: '无',
      unlocked: true,
      isActive: isNoFlairActive,
      rarity: null,
    };
    const items: FlairGridItem[] = SEAT_FLAIRS.map((f) => ({
      id: f.id,
      name: f.name,
      unlocked: isFlairUnlocked(f.id, unlockedIds),
      isActive: currentFlairId === f.id,
      rarity: getItemRarity(f.id),
    }));
    items.sort((a, b) => Number(a.unlocked ? 0 : 1) - Number(b.unlocked ? 0 : 1));
    return [none, ...items];
  }, [unlockedIds, currentFlairId, isNoFlairActive]);

  /** Sorted nameStyle grid data — "none" sentinel + unlocked-first order. */
  const nameStyleGridData: NameStyleGridItem[] = useMemo(() => {
    const none: NameStyleGridItem = {
      id: 'none',
      name: '无',
      unlocked: true,
      isActive: isNoNameStyleActive,
      rarity: null,
    };
    const items: NameStyleGridItem[] = NAME_STYLES.map((s) => ({
      id: s.id,
      name: s.name,
      unlocked: isNameStyleUnlocked(s.id, unlockedIds),
      isActive: currentNameStyleId === s.id,
      rarity: getItemRarity(s.id),
    }));
    items.sort((a, b) => Number(a.unlocked ? 0 : 1) - Number(b.unlocked ? 0 : 1));
    return [none, ...items];
  }, [unlockedIds, currentNameStyleId, isNoNameStyleActive]);

  // ── Rarity-filtered data ──

  const filteredAvatarData = useMemo(() => {
    if (rarityFilter === 'all') return data;
    return data.filter(
      (item) => item.type !== 'builtin' || getItemRarity(AVATAR_KEYS[item.index]) === rarityFilter,
    );
  }, [data, rarityFilter]);

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

  // ── Handlers ──

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handlePressDefault = useCallback(() => {
    setSelected('default');
  }, []);

  const handlePressBuiltin = useCallback(
    (index: number) => {
      if (readOnly) return;
      const roleId = AVATAR_KEYS[index];
      if (roleId && !unlockedAvatars.has(roleId)) {
        showAlert('未解锁', '提升等级后可解锁更多头像');
        return;
      }
      setSelected(index);
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

  const handleLongPress = useCallback((index: number) => {
    setPreviewIndex(index);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewIndex(null);
  }, []);

  const handleUpload = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
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
          const url = await uploadAvatar(result.assets[0].uri);
          toast.success('头像已更新');

          if (isInRoom) {
            facade
              .updatePlayerProfile(undefined, url)
              .catch((err: unknown) => settingsLog.warn('Avatar sync to GameState failed:', err));
          }

          navigation.goBack();
        } catch (e: unknown) {
          const message = getErrorMessage(e);
          settingsLog.error('Avatar upload failed:', message, e);
          showErrorAlert('上传失败', message);
        } finally {
          setSaving(false);
        }
      }
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      settingsLog.warn('Image picker failed:', message, e);
      showErrorAlert('选择图片失败', message);
    }
  }, [uploadAvatar, facade, isInRoom, navigation]);

  const handleConfirm = useCallback(async () => {
    setSaving(true);
    try {
      // Resolve new avatar URL (if changed)
      let newAvatarUrl: string | undefined;
      if (selected === 'default') {
        newAvatarUrl = '';
      } else if (selected === 'custom') {
        newAvatarUrl = user?.customAvatarUrl ?? undefined;
      } else if (typeof selected === 'number') {
        newAvatarUrl = makeBuiltinAvatarUrl(selected);
      }

      // Resolve new frame (if changed)
      let newFrame: string | undefined;
      if (selectedFrame === 'none') {
        newFrame = '';
      } else if (selectedFrame !== null) {
        newFrame = selectedFrame;
      }

      // Resolve new flair (if changed)
      let newFlair: string | undefined;
      if (selectedFlair === 'none') {
        newFlair = '';
      } else if (selectedFlair !== null) {
        newFlair = selectedFlair;
      }

      // Resolve new nameStyle (if changed)
      let newNameStyle: string | undefined;
      if (selectedNameStyle === 'none') {
        newNameStyle = '';
      } else if (selectedNameStyle !== null) {
        newNameStyle = selectedNameStyle;
      }

      // Persist to auth profile
      const profilePatch: Record<string, string> = {};
      if (newAvatarUrl !== undefined) profilePatch.avatarUrl = newAvatarUrl;
      if (newFrame !== undefined) profilePatch.avatarFrame = newFrame;
      if (newFlair !== undefined) profilePatch.seatFlair = newFlair;
      if (newNameStyle !== undefined) profilePatch.nameStyle = newNameStyle;
      if (Object.keys(profilePatch).length > 0) {
        await updateProfile(profilePatch);
      }

      // Sync to GameState only when in a room (otherwise no GameState exists)
      if (
        isInRoom &&
        (newAvatarUrl !== undefined ||
          newFrame !== undefined ||
          newFlair !== undefined ||
          newNameStyle !== undefined)
      ) {
        const result = await facade.updatePlayerProfile(
          undefined,
          newAvatarUrl,
          newFrame,
          newFlair,
          newNameStyle,
        );
        if (!result.success) {
          settingsLog.warn('Avatar/frame/flair sync to GameState failed:', result.reason);
        }
      }

      toast.success('形象已更新');
      navigation.goBack();
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      settingsLog.error('Avatar/frame save failed:', message, e);
      showErrorAlert('保存失败', message);
    } finally {
      setSaving(false);
    }
  }, [
    selected,
    selectedFrame,
    selectedFlair,
    selectedNameStyle,
    user?.customAvatarUrl,
    updateProfile,
    facade,
    isInRoom,
    navigation,
  ]);

  const handleUpgrade = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const keyExtractor = useCallback((item: AvatarCellItem) => item.key, []);

  const frameKeyExtractor = useCallback((item: FrameGridItem) => item.id, []);
  const flairKeyExtractor = useCallback((item: FlairGridItem) => item.id, []);
  const nameStyleKeyExtractor = useCallback((item: NameStyleGridItem) => item.id, []);

  const renderFrameItem = useCallback(
    ({ item }: ListRenderItemInfo<FrameGridItem>) => (
      <FrameCell
        item={item}
        selectedFrame={selectedFrame}
        previewAvatarUrl={previewAvatarUrl}
        uid={user?.uid ?? 'anonymous'}
        onPress={handlePressFrame}
        styles={styles}
      />
    ),
    [selectedFrame, previewAvatarUrl, user?.uid, handlePressFrame, styles],
  );

  const renderFlairItem = useCallback(
    ({ item }: ListRenderItemInfo<FlairGridItem>) => (
      <FlairCell
        item={item}
        selectedFlair={selectedFlair}
        previewAvatarUrl={previewAvatarUrl}
        uid={user?.uid ?? 'anonymous'}
        onPress={handlePressFlair}
        styles={styles}
      />
    ),
    [selectedFlair, previewAvatarUrl, user?.uid, handlePressFlair, styles],
  );

  const renderNameStyleItem = useCallback(
    ({ item }: ListRenderItemInfo<NameStyleGridItem>) => (
      <NameStyleCell
        item={item}
        selectedNameStyle={selectedNameStyle}
        onPress={handlePressNameStyle}
        styles={styles}
      />
    ),
    [selectedNameStyle, handlePressNameStyle, styles],
  );

  // ── Avatar cell rendering ──

  const wolfPawIcon = useMemo(() => getAvatarIcon(user?.uid ?? 'anonymous'), [user?.uid]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<AvatarCellItem>) => {
      if (item.type === 'placeholder') {
        return <View style={styles.pickerItem} />;
      }

      if (item.type === 'default') {
        return (
          <TouchableOpacity
            style={[styles.pickerItem, selected === 'default' && styles.pickerItemSelected]}
            onPress={handlePressDefault}
            activeOpacity={0.7}
          >
            <View style={styles.pickerItemWolfPawContainer}>
              <Image
                source={wolfPawIcon.image}
                style={styles.pickerItemWolfPawIcon}
                tintColor={wolfPawIcon.color}
                resizeMode="contain"
              />
            </View>
            {isDefaultActive && selected !== 'default' && (
              <View style={styles.pickerCheckBadge}>
                <Ionicons
                  name="checkmark"
                  size={componentSizes.icon.xs}
                  color={colors.textInverse}
                />
              </View>
            )}
          </TouchableOpacity>
        );
      }

      if (item.type === 'custom') {
        return (
          <TouchableOpacity
            style={[styles.pickerItem, selected === 'custom' && styles.pickerItemSelected]}
            onPress={handlePressCustom}
            activeOpacity={0.7}
          >
            <ExpoImage
              source={{ uri: user!.customAvatarUrl! }}
              style={styles.pickerItemImage}
              contentFit="cover"
              cachePolicy="disk"
            />
            {isCustomActive && selected !== 'custom' && (
              <View style={styles.pickerCheckBadge}>
                <Ionicons
                  name="checkmark"
                  size={componentSizes.icon.xs}
                  color={colors.textInverse}
                />
              </View>
            )}
          </TouchableOpacity>
        );
      }

      // type === 'builtin'
      const isCurrentlyUsed = item.index === currentBuiltinIndex;
      const isSelected = item.index === selected;
      const imageSource = getAvatarThumbByIndex(item.index);
      const roleId = AVATAR_KEYS[item.index];
      const locked = !!roleId && !unlockedAvatars.has(roleId);

      return (
        <AvatarCell
          index={item.index}
          imageSource={imageSource}
          isSelected={isSelected}
          isCurrentlyUsed={isCurrentlyUsed}
          locked={locked}
          onPress={handlePressBuiltin}
          onLongPress={handleLongPress}
          styles={styles}
          colors={colors}
        />
      );
    },
    [
      currentBuiltinIndex,
      selected,
      unlockedAvatars,
      isDefaultActive,
      isCustomActive,
      wolfPawIcon,
      user,
      handlePressDefault,
      handlePressCustom,
      handlePressBuiltin,
      handleLongPress,
      styles,
    ],
  );

  // ── Render sections ──

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + layout.headerPaddingV }]}>
        <Button variant="icon" onPress={handleGoBack}>
          <Ionicons name="chevron-back" size={componentSizes.icon.lg} color={colors.text} />
        </Button>
        <Text style={styles.headerTitle}>选择形象</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Hero preview */}
      <View style={styles.heroPreview}>
        <View style={styles.heroPreviewLeft}>
          <View>
            <AvatarWithFrame
              value={user?.uid ?? 'anonymous'}
              size={HERO_PREVIEW_SIZE}
              avatarUrl={previewAvatarUrl}
              frameId={effectiveFrame}
            />
            {(() => {
              const effectiveFlair =
                selectedFlair === 'none' ? null : (selectedFlair ?? currentFlairId);
              const flairConfig = effectiveFlair ? getFlairById(effectiveFlair) : null;
              if (!flairConfig) return null;
              const FlairComp = flairConfig.Component;
              return <FlairComp size={HERO_PREVIEW_SIZE} borderRadius={HERO_PREVIEW_SIZE / 2} />;
            })()}
          </View>
        </View>
        <View style={styles.heroPreviewRight}>
          <Text style={styles.heroFrameLabel}>当前框：{frameLabel}</Text>
          {!readOnly && (
            <Button
              variant="secondary"
              size="sm"
              icon={
                <Ionicons
                  name={UI_ICONS.CAMERA}
                  size={componentSizes.icon.sm}
                  color={colors.primary}
                />
              }
              onPress={handleUpload}
              textColor={colors.primary}
              style={styles.heroUploadBtn}
            >
              {user?.customAvatarUrl ? '更换自定义' : '上传自定义'}
            </Button>
          )}
          {readOnly && (
            <Text style={[styles.heroFrameLabel, { color: colors.textMuted }]}>绑定后可上传</Text>
          )}
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.pickerTabBar}>
        <TouchableOpacity
          style={[styles.pickerTab, activeTab === 'avatar' && styles.pickerTabActive]}
          onPress={() => {
            setActiveTab('avatar');
            setRarityFilter('all');
          }}
          activeOpacity={fixed.activeOpacity}
        >
          <Text
            style={[styles.pickerTabText, activeTab === 'avatar' && styles.pickerTabTextActive]}
          >
            头像
          </Text>
          {activeTab === 'avatar' && <View style={styles.pickerTabIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pickerTab, activeTab === 'frame' && styles.pickerTabActive]}
          onPress={() => {
            setActiveTab('frame');
            setRarityFilter('all');
          }}
          activeOpacity={fixed.activeOpacity}
        >
          <Text style={[styles.pickerTabText, activeTab === 'frame' && styles.pickerTabTextActive]}>
            头像框
          </Text>
          {activeTab === 'frame' && <View style={styles.pickerTabIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pickerTab, activeTab === 'flair' && styles.pickerTabActive]}
          onPress={() => {
            setActiveTab('flair');
            setRarityFilter('all');
          }}
          activeOpacity={fixed.activeOpacity}
        >
          <Text style={[styles.pickerTabText, activeTab === 'flair' && styles.pickerTabTextActive]}>
            座位装饰
          </Text>
          {activeTab === 'flair' && <View style={styles.pickerTabIndicator} />}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pickerTab, activeTab === 'nameStyle' && styles.pickerTabActive]}
          onPress={() => {
            setActiveTab('nameStyle');
            setRarityFilter('all');
          }}
          activeOpacity={fixed.activeOpacity}
        >
          <Text
            style={[styles.pickerTabText, activeTab === 'nameStyle' && styles.pickerTabTextActive]}
          >
            名字特效
          </Text>
          {activeTab === 'nameStyle' && <View style={styles.pickerTabIndicator} />}
        </TouchableOpacity>
      </View>

      {/* Rarity sub-tab bar */}
      <View style={styles.rarityTabBar}>
        {[
          { key: 'all' as RarityFilter, label: '全部' },
          ...RARITY_ORDER.map((r) => ({ key: r as RarityFilter, label: RARITY_VISUAL[r].label })),
        ].map((rt) => {
          const isActive = rt.key === rarityFilter;
          const visual = rt.key !== 'all' ? RARITY_VISUAL[rt.key] : null;
          const activeColor = visual?.color ?? colors.primary;
          const activeShadow =
            visual?.chipShadow ?? `0px 2px 8px ${withAlpha(colors.primary, 0.3)}`;
          return (
            <Pressable
              key={rt.key}
              style={[
                styles.rarityTab,
                isActive && {
                  backgroundColor: activeColor,
                  boxShadow: activeShadow,
                },
              ]}
              onPress={() => setRarityFilter(rt.key)}
            >
              <Text style={[styles.rarityTabText, isActive && styles.rarityTabTextActive]}>
                {rt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tab content */}
      <View style={styles.content}>
        {activeTab === 'avatar' ? (
          <FlatList
            key="avatar"
            data={filteredAvatarData}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={NUM_COLUMNS}
            contentContainerStyle={styles.pickerGrid}
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            maxToRenderPerBatch={16}
            windowSize={5}
          />
        ) : activeTab === 'frame' ? (
          <FlatList
            key="frame"
            data={filteredFrameData}
            renderItem={renderFrameItem}
            keyExtractor={frameKeyExtractor}
            numColumns={FRAME_NUM_COLUMNS}
            columnWrapperStyle={styles.frameColumnWrapper}
            contentContainerStyle={styles.frameGridContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={9}
            maxToRenderPerBatch={6}
            windowSize={5}
          />
        ) : activeTab === 'flair' ? (
          <FlatList
            key="flair"
            data={filteredFlairData}
            renderItem={renderFlairItem}
            keyExtractor={flairKeyExtractor}
            numColumns={FRAME_NUM_COLUMNS}
            columnWrapperStyle={styles.frameColumnWrapper}
            contentContainerStyle={styles.frameGridContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={9}
            maxToRenderPerBatch={6}
            windowSize={5}
          />
        ) : activeTab === 'nameStyle' ? (
          <FlatList
            key="nameStyle"
            data={filteredNameStyleData}
            renderItem={renderNameStyleItem}
            keyExtractor={nameStyleKeyExtractor}
            numColumns={FRAME_NUM_COLUMNS}
            columnWrapperStyle={styles.frameColumnWrapper}
            contentContainerStyle={styles.frameGridContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={9}
            maxToRenderPerBatch={6}
            windowSize={5}
          />
        ) : null}
      </View>

      {/* Footer */}
      <View style={[styles.pickerFooter, insets.bottom > 0 && { paddingBottom: insets.bottom }]}>
        {readOnly ? (
          <View style={styles.pickerUpgradeCard}>
            <Text style={styles.pickerUpgradeTitle}>绑定邮箱，解锁自定义形象</Text>
            <View style={styles.pickerUpgradeBenefits}>
              <Text style={styles.pickerUpgradeBenefit}>· 选择任意头像</Text>
              <Text style={styles.pickerUpgradeBenefit}>· 上传自定义头像</Text>
              <Text style={styles.pickerUpgradeBenefit}>· 装备头像框</Text>
              <Text style={styles.pickerUpgradeBenefit}>· 设置昵称</Text>
            </View>
            <Button variant="primary" onPress={handleUpgrade}>
              {user ? '立即绑定' : '立即注册'}
            </Button>
          </View>
        ) : (
          <Button
            variant="primary"
            onPress={handleConfirm}
            disabled={!hasSelection}
            loading={saving}
          >
            {hasSelection ? '确认使用' : '未做更改'}
          </Button>
        )}
      </View>

      {/* Long-press preview overlay */}
      {previewIndex !== null && (
        <Pressable style={styles.pickerPreviewOverlay} onPress={handleClosePreview}>
          <Image
            source={getAvatarImageByIndex(previewIndex) as ImageSourcePropType}
            style={styles.pickerPreviewImage}
            resizeMode="cover"
          />
        </Pressable>
      )}
    </SafeAreaView>
  );
};

// ─── Individual avatar cell (memoized to avoid re-renders on scroll) ──────────

interface AvatarCellProps {
  index: number;
  imageSource: number;
  isSelected: boolean;
  isCurrentlyUsed: boolean;
  locked: boolean;
  onPress: (index: number) => void;
  onLongPress: (index: number) => void;
  styles: AvatarPickerScreenStyles;
  colors: { textInverse: string; textMuted: string };
}

const AvatarCell = memo<AvatarCellProps>(
  ({ index, imageSource, isSelected, isCurrentlyUsed, locked, onPress, onLongPress, styles }) => {
    const handlePress = useCallback(() => {
      onPress(index);
    }, [onPress, index]);

    const handleLongPress = useCallback(() => {
      onLongPress(index);
    }, [onLongPress, index]);

    return (
      <TouchableOpacity
        style={[
          styles.pickerItem,
          isSelected && styles.pickerItemSelected,
          locked && styles.pickerItemLocked,
        ]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.7}
      >
        <Image
          source={imageSource as ImageSourcePropType}
          style={styles.pickerItemImage}
          resizeMode="cover"
        />
        {locked && (
          <View style={styles.pickerItemLockOverlay}>
            <Ionicons name="lock-closed" size={componentSizes.icon.sm} color={colors.textMuted} />
          </View>
        )}
        {isCurrentlyUsed && !isSelected && !locked && (
          <View style={styles.pickerCheckBadge}>
            <Ionicons name="checkmark" size={componentSizes.icon.xs} color={colors.textInverse} />
          </View>
        )}
      </TouchableOpacity>
    );
  },
);

AvatarCell.displayName = 'AvatarCell';

// ─── Frame grid cell (memoized for FlatList virtualization) ───────────────────

interface FrameCellProps {
  item: FrameGridItem;
  selectedFrame: FrameId | 'none' | null;
  previewAvatarUrl: string | null | undefined;
  uid: string;
  onPress: (id: FrameId | 'none') => void;
  styles: AvatarPickerScreenStyles;
}

const FrameCell = memo<FrameCellProps>(
  ({ item, selectedFrame, previewAvatarUrl, uid, onPress, styles }) => {
    const handlePress = useCallback(() => onPress(item.id), [onPress, item.id]);
    const isSelected = selectedFrame === item.id;

    return (
      <TouchableOpacity
        style={[
          styles.frameGridCell,
          isSelected && styles.frameGridCellSelected,
          !isSelected && item.isActive && selectedFrame === null && styles.frameGridCellActive,
          !item.unlocked && styles.frameGridCellLocked,
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {item.id === 'none' ? (
          <View
            style={[
              styles.frameGridNoFrame,
              { width: FRAME_GRID_CELL_SIZE, height: FRAME_GRID_CELL_SIZE },
            ]}
          >
            <Ionicons
              name="close-circle-outline"
              size={componentSizes.icon.xl}
              color={colors.textMuted}
            />
          </View>
        ) : (
          <AvatarWithFrame
            value={uid}
            size={FRAME_GRID_CELL_SIZE}
            avatarUrl={previewAvatarUrl}
            frameId={item.id}
          />
        )}
        <Text style={[styles.frameGridName, isSelected && styles.frameGridNameSelected]}>
          {item.unlocked ? item.name : '???'}
        </Text>
      </TouchableOpacity>
    );
  },
);

FrameCell.displayName = 'FrameCell';

// ─── Flair grid cell (memoized for FlatList virtualization) ───────────────────

interface FlairCellProps {
  item: FlairGridItem;
  selectedFlair: FlairId | 'none' | null;
  previewAvatarUrl: string | null | undefined;
  uid: string;
  onPress: (id: FlairId | 'none') => void;
  styles: AvatarPickerScreenStyles;
}

const FlairCell = memo<FlairCellProps>(
  ({ item, selectedFlair, previewAvatarUrl, uid, onPress, styles }) => {
    const handlePress = useCallback(() => onPress(item.id), [onPress, item.id]);
    const isSelected = selectedFlair === item.id;
    const FlairComponent = item.id !== 'none' ? getFlairById(item.id)?.Component : undefined;

    return (
      <TouchableOpacity
        style={[
          styles.frameGridCell,
          isSelected && styles.frameGridCellSelected,
          !isSelected && item.isActive && selectedFlair === null && styles.frameGridCellActive,
          !item.unlocked && styles.frameGridCellLocked,
        ]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {item.id === 'none' ? (
          <View
            style={[
              styles.frameGridNoFrame,
              { width: FRAME_GRID_CELL_SIZE, height: FRAME_GRID_CELL_SIZE },
            ]}
          >
            <Ionicons
              name="close-circle-outline"
              size={componentSizes.icon.xl}
              color={colors.textMuted}
            />
          </View>
        ) : (
          <View
            style={[
              styles.flairPreviewCell,
              { width: FRAME_GRID_CELL_SIZE, height: FRAME_GRID_CELL_SIZE },
            ]}
          >
            {FlairComponent && (
              <FlairComponent size={FRAME_GRID_CELL_SIZE} borderRadius={borderRadiusToken.medium} />
            )}
            <AvatarWithFrame
              value={uid}
              size={FRAME_GRID_CELL_SIZE - 8}
              avatarUrl={previewAvatarUrl}
            />
          </View>
        )}
        <Text style={[styles.frameGridName, isSelected && styles.frameGridNameSelected]}>
          {item.unlocked ? item.name : '???'}
        </Text>
      </TouchableOpacity>
    );
  },
);

FlairCell.displayName = 'FlairCell';

// ─── NameStyle grid cell (memoized for FlatList virtualization) ───────────────

interface NameStyleCellProps {
  item: NameStyleGridItem;
  selectedNameStyle: NameStyleId | 'none' | null;
  onPress: (id: NameStyleId | 'none') => void;
  styles: AvatarPickerScreenStyles;
}

const NameStyleCell = memo<NameStyleCellProps>(({ item, selectedNameStyle, onPress, styles }) => {
  const handlePress = useCallback(() => onPress(item.id), [onPress, item.id]);
  const isSelected = selectedNameStyle === item.id;

  return (
    <TouchableOpacity
      style={[
        styles.frameGridCell,
        isSelected && styles.frameGridCellSelected,
        !isSelected && item.isActive && selectedNameStyle === null && styles.frameGridCellActive,
        !item.unlocked && styles.frameGridCellLocked,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {item.id === 'none' ? (
        <View
          style={[
            styles.frameGridNoFrame,
            { width: FRAME_GRID_CELL_SIZE, height: FRAME_GRID_CELL_SIZE },
          ]}
        >
          <Ionicons
            name="close-circle-outline"
            size={componentSizes.icon.xl}
            color={colors.textMuted}
          />
        </View>
      ) : (
        <View
          style={[
            styles.nameStylePreviewCell,
            { width: FRAME_GRID_CELL_SIZE, height: FRAME_GRID_CELL_SIZE },
          ]}
        >
          <NameStyleText styleId={item.id} style={styles.nameStylePreviewText}>
            {item.name}
          </NameStyleText>
        </View>
      )}
      <Text style={[styles.frameGridName, isSelected && styles.frameGridNameSelected]}>
        {item.unlocked ? item.name : '???'}
      </Text>
    </TouchableOpacity>
  );
});

NameStyleCell.displayName = 'NameStyleCell';
