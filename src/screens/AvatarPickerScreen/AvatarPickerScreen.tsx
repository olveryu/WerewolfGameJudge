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
import { Image as ExpoImage } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  ImageSourcePropType,
  ListRenderItemInfo,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AVATAR_FRAMES, type FrameId } from '@/components/avatarFrames';
import { AvatarWithFrame } from '@/components/AvatarWithFrame';
import { Button } from '@/components/Button';
import { UI_ICONS } from '@/config/iconTokens';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { useGameFacade } from '@/contexts/GameFacadeContext';
import { RootStackParamList } from '@/navigation/types';
import { componentSizes, fixed, layout, useColors } from '@/theme';
import { showAlert } from '@/utils/alert';
import { showErrorAlert } from '@/utils/alertPresets';
import {
  AVATAR_IMAGES,
  AVATAR_KEYS,
  BUILTIN_AVATAR_PREFIX,
  getAvatarImageByIndex,
  getAvatarThumbByIndex,
  isBuiltinAvatarUrl,
  makeBuiltinAvatarUrl,
} from '@/utils/avatar';
import { getErrorMessage } from '@/utils/errorUtils';
import { settingsLog } from '@/utils/logger';

import { type AvatarPickerScreenStyles, createAvatarPickerScreenStyles } from './components';

/** Stable style to let ScrollView fill remaining space */
const scrollViewFlex = { flex: 1 } as const;

const NUM_COLUMNS = 4;
const FRAME_GRID_CELL_SIZE = 72;
const HERO_PREVIEW_SIZE = 80;

type Selection = number | 'custom' | null;
type PickerTab = 'avatar' | 'frame';

interface BuiltinCellItem {
  key: string;
  index: number;
}

export const AvatarPickerScreen: React.FC = () => {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createAvatarPickerScreenStyles(colors), [colors]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'AvatarPicker'>>();
  const { user, updateProfile, uploadAvatar } = useAuth();
  const facade = useGameFacade();

  const readOnly = !user || (user.isAnonymous ?? false);

  // Resolve current builtin avatar index (-1 if not builtin)
  const currentBuiltinIndex = useMemo(() => {
    if (!user?.avatarUrl || !isBuiltinAvatarUrl(user.avatarUrl)) return -1;
    const key = user.avatarUrl.slice(BUILTIN_AVATAR_PREFIX.length);
    return AVATAR_KEYS.indexOf(key);
  }, [user?.avatarUrl]);

  const currentFrameId = user?.avatarFrame ?? null;

  // ── Local selection state ──

  const [selected, setSelected] = useState<Selection>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [selectedFrame, setSelectedFrame] = useState<FrameId | 'none' | null>(null);
  const [activeTab, setActiveTab] = useState<PickerTab>('avatar');
  const [saving, setSaving] = useState(false);

  // ── Derived state ──

  const isCustomActive = currentBuiltinIndex === -1 && !!user?.customAvatarUrl;

  const previewAvatarUrl =
    selected === 'custom'
      ? user?.customAvatarUrl
      : typeof selected === 'number'
        ? makeBuiltinAvatarUrl(selected)
        : user?.avatarUrl;

  const effectiveFrame =
    selectedFrame === 'none' ? null : (selectedFrame ?? currentFrameId ?? null);

  const frameLabel = effectiveFrame
    ? (AVATAR_FRAMES.find((f) => f.id === effectiveFrame)?.name ?? '')
    : '无框';

  const hasSelection = selected !== null || selectedFrame !== null;

  const isNoFrameActive = !currentFrameId;
  const isNoFrameSelected = selectedFrame === 'none';

  // ── Grid data ──

  const data: BuiltinCellItem[] = useMemo(() => {
    const items: BuiltinCellItem[] = AVATAR_IMAGES.map((_, i) => ({
      key: String(i),
      index: i,
    }));
    const remainder = items.length % NUM_COLUMNS;
    if (remainder !== 0) {
      for (let i = 0; i < NUM_COLUMNS - remainder; i++) {
        items.push({ key: `placeholder-${i}`, index: -1 });
      }
    }
    return items;
  }, []);

  // ── Handlers ──

  const handleGoBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [navigation]);

  const handlePressBuiltin = useCallback(
    (index: number) => {
      if (readOnly) return;
      setSelected(index);
    },
    [readOnly],
  );

  const handlePressCustom = useCallback(() => {
    setSelected('custom');
  }, []);

  const handlePressFrame = useCallback(
    (frameId: FrameId | 'none') => {
      if (readOnly) return;
      setSelectedFrame(frameId);
    },
    [readOnly],
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
        showAlert('需要相册权限才能选择头像');
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
          showAlert('头像已更新');

          facade
            .updatePlayerProfile(undefined, url)
            .catch((err: unknown) => settingsLog.warn('Avatar sync to GameState failed:', err));

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
  }, [uploadAvatar, facade, navigation]);

  const handleConfirm = useCallback(async () => {
    setSaving(true);
    try {
      // Resolve new avatar URL (if changed)
      let newAvatarUrl: string | undefined;
      if (selected === 'custom') {
        newAvatarUrl = user?.customAvatarUrl ?? undefined;
      } else if (selected !== null) {
        newAvatarUrl = makeBuiltinAvatarUrl(selected);
      }

      // Resolve new frame (if changed)
      let newFrame: string | undefined;
      if (selectedFrame === 'none') {
        newFrame = '';
      } else if (selectedFrame !== null) {
        newFrame = selectedFrame;
      }

      // Persist to auth profile
      const profilePatch: Record<string, string> = {};
      if (newAvatarUrl !== undefined) profilePatch.avatarUrl = newAvatarUrl;
      if (newFrame !== undefined) profilePatch.avatarFrame = newFrame;
      if (Object.keys(profilePatch).length > 0) {
        await updateProfile(profilePatch);
      }

      // Single awaited call to sync both fields to GameState
      if (newAvatarUrl !== undefined || newFrame !== undefined) {
        const result = await facade.updatePlayerProfile(undefined, newAvatarUrl, newFrame);
        if (!result.success) {
          settingsLog.warn('Avatar/frame sync to GameState failed:', result.reason);
        }
      }

      showAlert('形象已更新');
      navigation.goBack();
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      settingsLog.error('Avatar/frame save failed:', message, e);
      showErrorAlert('保存失败', message);
    } finally {
      setSaving(false);
    }
  }, [selected, selectedFrame, user?.customAvatarUrl, updateProfile, facade, navigation]);

  const handleUpgrade = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const keyExtractor = useCallback((item: BuiltinCellItem) => item.key, []);

  // ── List header for avatar tab ──

  const listHeader = useMemo(
    () => (
      <>
        {!readOnly && (
          <>
            <Text style={styles.pickerSectionTitle}>我的头像</Text>
            <View style={styles.pickerCustomSection}>
              <View style={styles.pickerCustomRow}>
                {user?.customAvatarUrl && (
                  <TouchableOpacity
                    style={[
                      styles.pickerCustomItem,
                      selected === 'custom' && styles.pickerItemSelected,
                    ]}
                    onPress={handlePressCustom}
                    activeOpacity={0.7}
                  >
                    <ExpoImage
                      source={{ uri: user.customAvatarUrl }}
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
                )}
                <TouchableOpacity style={styles.pickerCustomUploadItem} onPress={handleUpload}>
                  <Ionicons
                    name={UI_ICONS.CAMERA}
                    size={componentSizes.icon.xl}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>
              </View>
            </View>
          </>
        )}
        <Text style={styles.pickerSectionTitle}>内置头像</Text>
      </>
    ),
    [
      user?.customAvatarUrl,
      selected,
      isCustomActive,
      readOnly,
      handlePressCustom,
      handleUpload,
      styles,
      colors,
    ],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<BuiltinCellItem>) => {
      if (item.index === -1) {
        return <View style={styles.pickerItem} />;
      }

      const isCurrentlyUsed = item.index === currentBuiltinIndex;
      const isSelected = item.index === selected;
      const imageSource = getAvatarThumbByIndex(item.index);

      return (
        <AvatarCell
          index={item.index}
          imageSource={imageSource}
          isSelected={isSelected}
          isCurrentlyUsed={isCurrentlyUsed}
          onPress={handlePressBuiltin}
          onLongPress={handleLongPress}
          styles={styles}
          colors={colors}
        />
      );
    },
    [currentBuiltinIndex, selected, handlePressBuiltin, handleLongPress, styles, colors],
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
          <AvatarWithFrame
            value={user?.uid ?? 'anonymous'}
            size={HERO_PREVIEW_SIZE}
            avatarUrl={previewAvatarUrl}
            frameId={effectiveFrame}
          />
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
          onPress={() => setActiveTab('avatar')}
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
          onPress={() => setActiveTab('frame')}
          activeOpacity={fixed.activeOpacity}
        >
          <Text style={[styles.pickerTabText, activeTab === 'frame' && styles.pickerTabTextActive]}>
            头像框
          </Text>
          {activeTab === 'frame' && <View style={styles.pickerTabIndicator} />}
        </TouchableOpacity>
      </View>

      {/* Tab content */}
      <View style={styles.content}>
        {activeTab === 'avatar' ? (
          <FlatList
            data={data}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            numColumns={NUM_COLUMNS}
            ListHeaderComponent={listHeader}
            contentContainerStyle={styles.pickerGrid}
            showsVerticalScrollIndicator={false}
            initialNumToRender={20}
            maxToRenderPerBatch={16}
            windowSize={5}
          />
        ) : (
          <ScrollView
            style={scrollViewFlex}
            contentContainerStyle={styles.frameGrid}
            showsVerticalScrollIndicator={false}
          >
            {/* "None" option */}
            <TouchableOpacity
              style={[
                styles.frameGridCell,
                isNoFrameSelected && styles.frameGridCellSelected,
                !isNoFrameSelected &&
                  isNoFrameActive &&
                  selectedFrame === null &&
                  styles.frameGridCellActive,
              ]}
              onPress={() => handlePressFrame('none')}
              activeOpacity={0.7}
            >
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
              <Text
                style={[styles.frameGridName, isNoFrameSelected && styles.frameGridNameSelected]}
              >
                无
              </Text>
            </TouchableOpacity>

            {/* Frame options */}
            {AVATAR_FRAMES.map((frame) => {
              const isActive = currentFrameId === frame.id;
              const isFrameSelected = selectedFrame === frame.id;
              return (
                <TouchableOpacity
                  key={frame.id}
                  style={[
                    styles.frameGridCell,
                    isFrameSelected && styles.frameGridCellSelected,
                    !isFrameSelected &&
                      isActive &&
                      selectedFrame === null &&
                      styles.frameGridCellActive,
                  ]}
                  onPress={() => handlePressFrame(frame.id)}
                  activeOpacity={0.7}
                >
                  <AvatarWithFrame
                    value={user?.uid ?? 'anonymous'}
                    size={FRAME_GRID_CELL_SIZE}
                    avatarUrl={previewAvatarUrl}
                    frameId={frame.id}
                  />
                  <Text
                    style={[styles.frameGridName, isFrameSelected && styles.frameGridNameSelected]}
                  >
                    {frame.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
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
  onPress: (index: number) => void;
  onLongPress: (index: number) => void;
  styles: AvatarPickerScreenStyles;
  colors: { textInverse: string };
}

const AvatarCell = memo<AvatarCellProps>(
  ({ index, imageSource, isSelected, isCurrentlyUsed, onPress, onLongPress, styles, colors }) => {
    const handlePress = useCallback(() => {
      onPress(index);
    }, [onPress, index]);

    const handleLongPress = useCallback(() => {
      onLongPress(index);
    }, [onLongPress, index]);

    return (
      <TouchableOpacity
        style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        activeOpacity={0.7}
      >
        <Image
          source={imageSource as ImageSourcePropType}
          style={styles.pickerItemImage}
          resizeMode="cover"
        />
        {isCurrentlyUsed && !isSelected && (
          <View style={styles.pickerCheckBadge}>
            <Ionicons name="checkmark" size={componentSizes.icon.xs} color={colors.textInverse} />
          </View>
        )}
      </TouchableOpacity>
    );
  },
);

AvatarCell.displayName = 'AvatarCell';
