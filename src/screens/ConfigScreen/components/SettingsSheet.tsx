/**
 * SettingsSheet - 配置页设置面板（动画 + BGM）
 *
 * 底部滑出 Modal，动画和 BGM 均使用 chip 平铺选择，一次点击即选中。
 * 渲染 UI 并通过回调上报 onSelect，不 import service，不包含业务逻辑判断。
 */
import { memo, useCallback } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

import { TESTIDS } from '@/testids';

import type { DropdownOption } from './Dropdown';
import type { ConfigScreenStyles } from './styles';

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  roleRevealAnimation: string;
  bgmValue: string;
  animationOptions: DropdownOption[];
  bgmOptions: DropdownOption[];
  onAnimationChange: (value: string) => void;
  onBgmChange: (value: string) => void;
  styles: ConfigScreenStyles;
}

export const SettingsSheet = memo(function SettingsSheet({
  visible,
  onClose,
  roleRevealAnimation,
  bgmValue,
  animationOptions,
  bgmOptions,
  onAnimationChange,
  onBgmChange,
  styles,
}: SettingsSheetProps) {
  const handleAnimSelect = useCallback(
    (value: string) => {
      onAnimationChange(value);
    },
    [onAnimationChange],
  );

  const handleBgmSelect = useCallback(
    (value: string) => {
      onBgmChange(value);
    },
    [onBgmChange],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.settingsSheetOverlay}
        activeOpacity={1}
        onPress={onClose}
        testID={TESTIDS.configSettingsOverlay}
      >
        <View
          style={styles.settingsSheetContent}
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <View style={styles.settingsSheetHandle} />
          <Text style={styles.settingsSheetTitle}>设置</Text>

          {/* Animation chips */}
          <View style={styles.settingsChipGroup}>
            <Text style={styles.settingsChipGroupLabel}>动画</Text>
            <View style={styles.settingsChipWrap}>
              {animationOptions.map((opt) => {
                const selected = opt.value === roleRevealAnimation;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.settingsChip, selected && styles.settingsChipSelected]}
                    onPress={() => handleAnimSelect(opt.value)}
                    activeOpacity={0.7}
                    testID={`${TESTIDS.configAnimation}-option-${opt.value}`}
                  >
                    <Text
                      style={[styles.settingsChipText, selected && styles.settingsChipTextSelected]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* BGM chips */}
          <View style={styles.settingsChipGroup}>
            <Text style={styles.settingsChipGroupLabel}>BGM</Text>
            <View style={styles.settingsChipWrap}>
              {bgmOptions.map((opt) => {
                const selected = opt.value === bgmValue;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.settingsChip, selected && styles.settingsChipSelected]}
                    onPress={() => handleBgmSelect(opt.value)}
                    activeOpacity={0.7}
                    testID={`${TESTIDS.configBgm}-option-${opt.value}`}
                  >
                    <Text
                      style={[styles.settingsChipText, selected && styles.settingsChipTextSelected]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
});
