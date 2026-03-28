/**
 * AvatarPickerSheet - 头像选择器（底部 Modal）
 *
 * 两个 Tab：「头像」（自定义 + 内置 4 列网格）和「头像框」（3×2 大尺寸试穿网格）。
 * 顶部 Hero 预览区实时合成头像 + 框效果，两个 Tab 共享。
 * 支持选中 + 确认保存 + 长按预览。渲染 UI 并上报 intent，不 import service。
 */
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageSourcePropType,
  ListRenderItemInfo,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { AVATAR_FRAMES, type FrameId } from '@/components/avatarFrames';
import { AvatarWithFrame } from '@/components/AvatarWithFrame';
import { UI_ICONS } from '@/config/iconTokens';
import { componentSizes, fixed, ThemeColors } from '@/theme';
import { AVATAR_IMAGES, getAvatarImageByIndex, makeBuiltinAvatarUrl } from '@/utils/avatar';

/** Stable style to let ScrollView fill remaining space inside maxHeight parent */
const scrollViewFlex = { flex: 1 } as const;

import { SettingsScreenStyles } from './styles';

const NUM_COLUMNS = 4;
/** Size for frame grid cells in frame tab (3×2 layout) */
const FRAME_GRID_CELL_SIZE = 72;
/** Hero preview avatar size */
const HERO_PREVIEW_SIZE = 120;

/** Selection state: a builtin index, 'custom' for the uploaded avatar, or null */
type Selection = number | 'custom' | null;
type PickerTab = 'avatar' | 'frame';

interface AvatarPickerSheetProps {
  visible: boolean;
  /** Currently active builtin avatar index (0-based), or -1 if not builtin */
  currentIndex: number;
  /** Persisted remote URL of the custom-uploaded avatar, if any */
  customAvatarUrl?: string;
  /** Currently active avatar frame ID */
  currentFrameId: string | null;
  /** uid for Avatar fallback rendering */
  uid: string;
  /** Current avatarUrl for frame preview thumbnails */
  currentAvatarUrl?: string | null;
  saving: boolean;
  /** Read-only browse mode for anonymous users (no selection, shows upgrade CTA). */
  readOnly?: boolean;
  onSelect: (index: number) => void;
  /** Called when user selects their existing custom avatar */
  onSelectCustom: () => void;
  onUpload: () => void;
  /** Called when user selects a frame (null = remove frame) */
  onSelectFrame: (frameId: FrameId | null) => void;
  /** Called when user taps the upgrade CTA in readOnly mode. */
  onUpgrade?: () => void;
  onClose: () => void;
  styles: SettingsScreenStyles;
  colors: ThemeColors;
}

interface BuiltinCellItem {
  key: string;
  /** Real avatar index, or -1 for trailing placeholder */
  index: number;
}

export const AvatarPickerSheet = memo<AvatarPickerSheetProps>(
  ({
    visible,
    currentIndex,
    customAvatarUrl,
    currentFrameId,
    uid,
    currentAvatarUrl,
    saving,
    readOnly,
    onSelect,
    onSelectCustom,
    onUpload,
    onSelectFrame,
    onUpgrade,
    onClose,
    styles,
    colors,
  }) => {
    const [selected, setSelected] = useState<Selection>(null);
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    /** Frame selection: FrameId, 'none' for explicit no-frame, or null (unchanged) */
    const [selectedFrame, setSelectedFrame] = useState<FrameId | 'none' | null>(null);
    const [activeTab, setActiveTab] = useState<PickerTab>('avatar');

    // Reset selection when sheet opens
    const effectiveSelected: Selection = visible ? selected : null;

    const handleOpen = useCallback(() => {
      setSelected(null);
      setPreviewIndex(null);
      setSelectedFrame(null);
      setActiveTab('avatar');
    }, []);

    const handleLongPress = useCallback((index: number) => {
      setPreviewIndex(index);
    }, []);

    const handleClosePreview = useCallback(() => {
      setPreviewIndex(null);
    }, []);

    const data: BuiltinCellItem[] = useMemo(() => {
      const items: BuiltinCellItem[] = AVATAR_IMAGES.map((_, i) => ({
        key: String(i),
        index: i,
      }));
      // Pad with placeholders so the last row is full and cells don't stretch
      const remainder = items.length % NUM_COLUMNS;
      if (remainder !== 0) {
        for (let i = 0; i < NUM_COLUMNS - remainder; i++) {
          items.push({ key: `placeholder-${i}`, index: -1 });
        }
      }
      return items;
    }, []);

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

    const effectiveFrame = visible ? selectedFrame : null;

    const handleConfirm = useCallback(() => {
      // Fire avatar selection
      if (effectiveSelected === 'custom') {
        onSelectCustom();
      } else if (effectiveSelected !== null) {
        onSelect(effectiveSelected);
      }
      // Fire frame selection (independent of avatar)
      if (effectiveFrame === 'none') {
        onSelectFrame(null);
      } else if (effectiveFrame !== null) {
        onSelectFrame(effectiveFrame);
      }
    }, [effectiveSelected, effectiveFrame, onSelect, onSelectCustom, onSelectFrame]);

    const keyExtractor = useCallback((item: BuiltinCellItem) => item.key, []);

    // Whether the current active avatar is the custom upload
    const isCustomActive = currentIndex === -1 && !!customAvatarUrl;

    // Compute preview avatar URL for hero based on current selection
    const previewAvatarUrl =
      effectiveSelected === 'custom'
        ? customAvatarUrl
        : typeof effectiveSelected === 'number'
          ? makeBuiltinAvatarUrl(effectiveSelected)
          : currentAvatarUrl;

    // Compute effective frame ID for hero preview
    const previewFrameId =
      effectiveFrame === 'none' ? null : (effectiveFrame ?? currentFrameId ?? null);

    // Frame label for hero
    const frameLabel = previewFrameId
      ? (AVATAR_FRAMES.find((f) => f.id === previewFrameId)?.name ?? '')
      : '无框';

    const hasSelection = effectiveSelected !== null || effectiveFrame !== null;

    const isNoFrameActive = !currentFrameId;
    const isNoFrameSelected = effectiveFrame === 'none';

    // ── List header for avatar tab: "我的头像" section + "内置头像" title ──

    const listHeader = useMemo(
      () => (
        <>
          {!readOnly && (
            <>
              <Text style={styles.pickerSectionTitle}>我的头像</Text>
              <View style={styles.pickerCustomSection}>
                <View style={styles.pickerCustomRow}>
                  {customAvatarUrl && (
                    <TouchableOpacity
                      style={[
                        styles.pickerCustomItem,
                        effectiveSelected === 'custom' && styles.pickerItemSelected,
                      ]}
                      onPress={handlePressCustom}
                      activeOpacity={0.7}
                    >
                      <ExpoImage
                        source={{ uri: customAvatarUrl }}
                        style={styles.pickerItemImage}
                        contentFit="cover"
                        cachePolicy="disk"
                      />
                      {isCustomActive && effectiveSelected !== 'custom' && (
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
                  <TouchableOpacity style={styles.pickerCustomUploadItem} onPress={onUpload}>
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
        customAvatarUrl,
        effectiveSelected,
        isCustomActive,
        readOnly,
        handlePressCustom,
        onUpload,
        styles,
        colors,
      ],
    );

    const renderItem = useCallback(
      ({ item }: ListRenderItemInfo<BuiltinCellItem>) => {
        // Placeholder cell — invisible spacer to keep last-row cells aligned
        if (item.index === -1) {
          return <View style={styles.pickerItem} />;
        }

        const isCurrentlyUsed = item.index === currentIndex;
        const isSelected = item.index === effectiveSelected;
        const imageSource = getAvatarImageByIndex(item.index);

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
      [currentIndex, effectiveSelected, handlePressBuiltin, handleLongPress, styles, colors],
    );

    // ── Render helpers ──

    const renderHeroPreview = () => (
      <View style={styles.heroPreview}>
        <View style={styles.heroPreviewLeft}>
          <AvatarWithFrame
            value={uid}
            size={HERO_PREVIEW_SIZE}
            avatarUrl={previewAvatarUrl}
            frameId={previewFrameId}
          />
        </View>
        <View style={styles.heroPreviewRight}>
          <Text style={styles.heroFrameLabel}>当前框：{frameLabel}</Text>
          {!readOnly && (
            <TouchableOpacity
              style={styles.heroUploadBtn}
              onPress={onUpload}
              activeOpacity={fixed.activeOpacity}
            >
              <Ionicons
                name={UI_ICONS.CAMERA}
                size={componentSizes.icon.sm}
                color={colors.primary}
              />
              <Text style={styles.heroUploadBtnText}>
                {customAvatarUrl ? '更换自定义' : '上传自定义'}
              </Text>
            </TouchableOpacity>
          )}
          {readOnly && (
            <Text style={[styles.heroFrameLabel, { color: colors.textMuted }]}>绑定后可上传</Text>
          )}
        </View>
      </View>
    );

    const renderTabBar = () => (
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
    );

    const renderFrameTab = () => (
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
              effectiveFrame === null &&
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
          <Text style={[styles.frameGridName, isNoFrameSelected && styles.frameGridNameSelected]}>
            无
          </Text>
        </TouchableOpacity>

        {/* Frame options with avatar preview */}
        {AVATAR_FRAMES.map((frame) => {
          const isActive = currentFrameId === frame.id;
          const isFrameSelected = effectiveFrame === frame.id;
          return (
            <TouchableOpacity
              key={frame.id}
              style={[
                styles.frameGridCell,
                isFrameSelected && styles.frameGridCellSelected,
                !isFrameSelected &&
                  isActive &&
                  effectiveFrame === null &&
                  styles.frameGridCellActive,
              ]}
              onPress={() => handlePressFrame(frame.id)}
              activeOpacity={0.7}
            >
              <AvatarWithFrame
                value={uid}
                size={FRAME_GRID_CELL_SIZE}
                avatarUrl={previewAvatarUrl}
                frameId={frame.id}
              />
              <Text style={[styles.frameGridName, isFrameSelected && styles.frameGridNameSelected]}>
                {frame.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );

    const renderFooter = () => (
      <View style={styles.pickerFooter}>
        {readOnly ? (
          <View style={styles.pickerUpgradeCard}>
            <Text style={styles.pickerUpgradeTitle}>绑定邮箱，解锁自定义形象</Text>
            <View style={styles.pickerUpgradeBenefits}>
              <Text style={styles.pickerUpgradeBenefit}>· 选择任意头像</Text>
              <Text style={styles.pickerUpgradeBenefit}>· 上传自定义头像</Text>
              <Text style={styles.pickerUpgradeBenefit}>· 装备头像框</Text>
              <Text style={styles.pickerUpgradeBenefit}>· 设置昵称</Text>
            </View>
            <TouchableOpacity
              style={styles.pickerConfirmBtn}
              onPress={onUpgrade}
              activeOpacity={fixed.activeOpacity}
            >
              <Text style={styles.pickerConfirmBtnText}>立即绑定</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.pickerConfirmBtn, !hasSelection && styles.pickerConfirmBtnDisabled]}
            onPress={handleConfirm}
            activeOpacity={hasSelection ? 0.7 : 1}
            accessibilityState={{ disabled: !hasSelection || saving }}
          >
            {saving ? (
              <ActivityIndicator color={colors.textInverse} />
            ) : (
              <Text style={styles.pickerConfirmBtnText}>
                {hasSelection ? '确认使用' : '未做更改'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}
        onShow={handleOpen}
      >
        <Pressable style={styles.pickerOverlay} onPress={onClose}>
          <Pressable style={styles.pickerSheet} onPress={undefined}>
            <View style={styles.pickerHandle} />
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>选择形象</Text>
              <TouchableOpacity style={styles.pickerCloseBtn} onPress={onClose}>
                <Ionicons name="close" size={componentSizes.icon.lg} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Hero preview — shared between both tabs */}
            {renderHeroPreview()}

            {/* Tab bar */}
            {renderTabBar()}

            {/* Tab content */}
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
              renderFrameTab()
            )}

            {/* Footer */}
            {renderFooter()}
          </Pressable>
        </Pressable>

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
      </Modal>
    );
  },
);

AvatarPickerSheet.displayName = 'AvatarPickerSheet';

// ─── Individual avatar cell (memoized to avoid re-renders on scroll) ──────────

interface AvatarCellProps {
  index: number;
  imageSource: number;
  isSelected: boolean;
  isCurrentlyUsed: boolean;
  onPress: (index: number) => void;
  onLongPress: (index: number) => void;
  styles: SettingsScreenStyles;
  colors: ThemeColors;
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
