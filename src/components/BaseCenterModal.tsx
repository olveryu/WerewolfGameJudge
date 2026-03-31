/**
 * BaseCenterModal — 居中弹窗基础组件
 *
 * 提供 overlay（dark backdrop）+ 居中 content box 的通用壳子。
 * 消费者通过 children 填充自定义内容，通过 contentStyle 覆盖尺寸/圆角/阴影等。
 * 不包含业务逻辑，不 import service。
 */
import React, { useMemo } from 'react';
import {
  Modal,
  type StyleProp,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
  type ViewStyle,
} from 'react-native';

import { borderRadius, spacing, useColors } from '@/theme';

interface BaseCenterModalProps {
  visible: boolean;
  onClose: () => void;
  /** 点击蒙层是否关闭 (default: false) */
  dismissOnOverlayPress?: boolean;
  animationType?: 'fade' | 'slide' | 'none';
  /** 内容区样式覆盖（width / maxHeight / borderRadius / padding / shadow 等） */
  contentStyle?: StyleProp<ViewStyle>;
  /** 内容区 testID */
  testID?: string;
  children: React.ReactNode;
}

export const BaseCenterModal: React.FC<BaseCenterModalProps> = ({
  visible,
  onClose,
  dismissOnOverlayPress = false,
  animationType = 'fade',
  contentStyle,
  testID,
  children,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onClose}>
      <TouchableWithoutFeedback
        onPress={dismissOnOverlayPress ? onClose : undefined}
        disabled={!dismissOnOverlayPress}
      >
        <View style={styles.overlay}>
          {/* Prevent content area touches from reaching overlay */}
          <TouchableWithoutFeedback>
            <View style={[styles.contentBox, contentStyle]} testID={testID}>
              {children}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

function createStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    contentBox: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      padding: spacing.large,
    },
  });
}
