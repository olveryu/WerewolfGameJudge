/**
 * AvatarPickerSheet - 头像选择器（底部 Modal）
 *
 * 分两个区域：「我的头像」（已上传缩略图 + 上传按钮）和「内置头像」（4 列网格）。
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
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { UI_ICONS } from '@/config/iconTokens';
import { componentSizes, fixed, ThemeColors, typography } from '@/theme';
import { AVATAR_IMAGES, getAvatarImageByIndex } from '@/utils/avatar';

import { SettingsScreenStyles } from './styles';

const NUM_COLUMNS = 4;

/** Selection state: a builtin index, 'custom' for the uploaded avatar, or null */
type Selection = number | 'custom' | null;

interface AvatarPickerSheetProps {
  visible: boolean;
  /** Currently active builtin avatar index (0-based), or -1 if not builtin */
  currentIndex: number;
  /** Persisted remote URL of the custom-uploaded avatar, if any */
  customAvatarUrl?: string;
  saving: boolean;
  /** Read-only browse mode for anonymous users (no selection, shows upgrade CTA). */
  readOnly?: boolean;
  onSelect: (index: number) => void;
  /** Called when user selects their existing custom avatar */
  onSelectCustom: () => void;
  onUpload: () => void;
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
    saving,
    readOnly,
    onSelect,
    onSelectCustom,
    onUpload,
    onUpgrade,
    onClose,
    styles,
    colors,
  }) => {
    const [selected, setSelected] = useState<Selection>(null);
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);

    // Reset selection when sheet opens
    const effectiveSelected: Selection = visible ? selected : null;

    const handleOpen = useCallback(() => {
      setSelected(null);
      setPreviewIndex(null);
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

    const handleConfirm = useCallback(() => {
      if (effectiveSelected === 'custom') {
        onSelectCustom();
      } else if (effectiveSelected !== null) {
        onSelect(effectiveSelected);
      }
    }, [effectiveSelected, onSelect, onSelectCustom]);

    const keyExtractor = useCallback((item: BuiltinCellItem) => item.key, []);

    // Whether the current active avatar is the custom upload
    const isCustomActive = currentIndex === -1 && !!customAvatarUrl;

    // ── List header: "我的头像" section + "内置头像" title ──

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

    const hasSelection = effectiveSelected !== null;

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
              <Ionicons name="people-outline" size={typography.title} color={colors.text} />
              <TouchableOpacity style={styles.pickerCloseBtn} onPress={onClose}>
                <Ionicons name="close" size={componentSizes.icon.lg} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

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

            <View style={styles.pickerFooter}>
              {readOnly ? (
                <TouchableOpacity
                  style={styles.pickerConfirmBtn}
                  onPress={onUpgrade}
                  activeOpacity={fixed.activeOpacity}
                >
                  <Text style={styles.pickerConfirmBtnText}>绑定邮箱后可选择</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.pickerConfirmBtn,
                    !hasSelection && styles.pickerConfirmBtnDisabled,
                  ]}
                  onPress={handleConfirm}
                  activeOpacity={hasSelection ? 0.7 : 1}
                  accessibilityState={{ disabled: !hasSelection || saving }}
                >
                  {saving ? (
                    <ActivityIndicator color={colors.textInverse} />
                  ) : (
                    <Ionicons
                      name="checkmark"
                      size={componentSizes.icon.lg}
                      color={colors.textInverse}
                    />
                  )}
                </TouchableOpacity>
              )}
            </View>
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
