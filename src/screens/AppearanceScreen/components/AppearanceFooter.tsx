import React from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';

import type { AppearanceScreenStyles } from './styles';

interface AppearanceFooterProps {
  readOnly: boolean;
  hasSelection: boolean;
  saving: boolean;
  hasUser: boolean;
  onConfirm: () => void;
  onUpgrade: () => void;
  styles: AppearanceScreenStyles;
}

export const AppearanceFooter: React.FC<AppearanceFooterProps> = ({
  readOnly,
  hasSelection,
  saving,
  hasUser,
  onConfirm,
  onUpgrade,
  styles,
}) => {
  if (readOnly) {
    return (
      <View style={styles.pickerUpgradeCard}>
        <Text style={styles.pickerUpgradeTitle}>绑定邮箱，解锁自定义形象</Text>
        <View style={styles.pickerUpgradeBenefits}>
          <Text style={styles.pickerUpgradeBenefit}>· 选择任意头像</Text>
          <Text style={styles.pickerUpgradeBenefit}>· 上传自定义头像</Text>
          <Text style={styles.pickerUpgradeBenefit}>· 装备头像框</Text>
          <Text style={styles.pickerUpgradeBenefit}>· 设置昵称</Text>
        </View>
        <Button variant="primary" onPress={onUpgrade}>
          {hasUser ? '立即绑定' : '立即注册'}
        </Button>
      </View>
    );
  }

  return (
    <Button
      variant="primary"
      onPress={onConfirm}
      disabled={!hasSelection}
      fireWhenDisabled
      loading={saving}
    >
      {hasSelection ? '确认使用' : '未做更改'}
    </Button>
  );
};
