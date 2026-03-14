/**
 * AvatarPickerSheet - 内置头像选择器（底部 Modal）
 *
 * 以 4 列网格展示全部内置头像，支持选中 + 确认保存。
 * 首格为"上传自定义"入口。渲染 UI 并上报 intent，不 import service。
 */
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageSourcePropType,
  ListRenderItemInfo,
  Modal,
  Pressable,
  TouchableOpacity,
  View,
} from 'react-native';

import { UI_ICONS } from '@/config/iconTokens';
import { componentSizes, ThemeColors, typography } from '@/theme';
import { AVATAR_IMAGES, getAvatarImageByIndex } from '@/utils/avatar';

import { SettingsScreenStyles } from './styles';

/** Sentinel value representing the "upload custom" cell at position 0 */
const UPLOAD_CELL_KEY = '__upload__';

const NUM_COLUMNS = 4;

interface AvatarPickerSheetProps {
  visible: boolean;
  /** Currently active avatar index (0-based), or -1 if not a builtin avatar */
  currentIndex: number;
  saving: boolean;
  onSelect: (index: number) => void;
  onUpload: () => void;
  onClose: () => void;
  styles: SettingsScreenStyles;
  colors: ThemeColors;
}

type CellItem = { key: string; index: number } | { key: typeof UPLOAD_CELL_KEY };

export const AvatarPickerSheet = memo<AvatarPickerSheetProps>(
  ({ visible, currentIndex, saving, onSelect, onUpload, onClose, styles, colors }) => {
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // Reset selection when sheet opens
    const effectiveSelected = visible ? selectedIndex : null;

    const handleOpen = useCallback(() => {
      setSelectedIndex(null);
    }, []);

    const data: CellItem[] = useMemo(
      () => [
        { key: UPLOAD_CELL_KEY },
        ...AVATAR_IMAGES.map((_, i) => ({ key: String(i), index: i })),
      ],
      [],
    );

    const handlePressItem = useCallback((index: number) => {
      setSelectedIndex(index);
    }, []);

    const handleConfirm = useCallback(() => {
      if (effectiveSelected !== null) {
        onSelect(effectiveSelected);
      }
    }, [effectiveSelected, onSelect]);

    const keyExtractor = useCallback((item: CellItem) => item.key, []);

    const renderItem = useCallback(
      ({ item }: ListRenderItemInfo<CellItem>) => {
        if (item.key === UPLOAD_CELL_KEY) {
          return (
            <TouchableOpacity style={styles.pickerUploadItem} onPress={onUpload}>
              <Ionicons
                name={UI_ICONS.CAMERA}
                size={componentSizes.icon.xl}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          );
        }

        const avatarItem = item as { key: string; index: number };
        const isCurrentlyUsed = avatarItem.index === currentIndex;
        const isSelected = avatarItem.index === effectiveSelected;
        const imageSource = getAvatarImageByIndex(avatarItem.index);

        return (
          <AvatarCell
            index={avatarItem.index}
            imageSource={imageSource}
            isSelected={isSelected}
            isCurrentlyUsed={isCurrentlyUsed}
            onPress={handlePressItem}
            styles={styles}
            colors={colors}
          />
        );
      },
      [currentIndex, effectiveSelected, handlePressItem, onUpload, styles, colors],
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
              contentContainerStyle={styles.pickerGrid}
              showsVerticalScrollIndicator={false}
              initialNumToRender={20}
              maxToRenderPerBatch={16}
              windowSize={5}
            />

            <View style={styles.pickerFooter}>
              <TouchableOpacity
                style={[styles.pickerConfirmBtn, !hasSelection && styles.pickerConfirmBtnDisabled]}
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
            </View>
          </Pressable>
        </Pressable>
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
  styles: SettingsScreenStyles;
  colors: ThemeColors;
}

const AvatarCell = memo<AvatarCellProps>(
  ({ index, imageSource, isSelected, isCurrentlyUsed, onPress, styles, colors }) => {
    const handlePress = useCallback(() => {
      onPress(index);
    }, [onPress, index]);

    return (
      <TouchableOpacity
        style={[styles.pickerItem, isSelected && styles.pickerItemSelected]}
        onPress={handlePress}
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
