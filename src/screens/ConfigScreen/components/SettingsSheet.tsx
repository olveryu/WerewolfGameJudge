/**
 * SettingsSheet - 配置页设置面板（动画 + BGM）
 *
 * 底部滑出 Modal，包含动画选择和 BGM 开关两个 Dropdown。
 * 渲染 UI 并通过回调上报 onSelect，不 import service，不包含业务逻辑判断。
 */
import { memo } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

import { TESTIDS } from '@/testids';

import { Dropdown, type DropdownOption } from './Dropdown';
import type { ConfigScreenStyles } from './styles';

export interface SettingsSheetProps {
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
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.settingsSheetOverlay}
        activeOpacity={1}
        onPress={onClose}
        testID={TESTIDS.configSettingsOverlay}
      >
        <View style={styles.settingsSheetContent}>
          <View style={styles.settingsSheetHandle} />
          <Text style={styles.settingsSheetTitle}>设置</Text>
          <View style={styles.settingsRow}>
            <Dropdown
              label="动画"
              value={roleRevealAnimation}
              options={animationOptions}
              onSelect={onAnimationChange}
              styles={styles}
              testID={TESTIDS.configAnimation}
            />
            <Dropdown
              label="BGM"
              value={bgmValue}
              options={bgmOptions}
              onSelect={onBgmChange}
              styles={styles}
              testID={TESTIDS.configBgm}
            />
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
});
