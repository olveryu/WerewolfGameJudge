/**
 * BaseCenterModal — 居中弹窗基础组件
 *
 * 提供 overlay（dark backdrop）+ 居中 content box 的通用壳子。
 * 消费者通过 children 填充自定义内容，通过 contentStyle 覆盖尺寸/圆角/阴影等。
 * 不包含业务逻辑，不 import service。
 *
 * Overlay dismiss 使用 sibling 布局（Pressable absoluteFill 在 content 下层），
 * 而非 parent-wrapping 模式。这样 content children 的触摸事件不会被 overlay 拦截，
 * 兼容 web（DOM click bubble）和 native（responder system）。
 * 参考 RN 官方 Modal 文档示例。
 */
import React, { useMemo } from 'react';
import { Modal, Pressable, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';

import { borderRadius, colors, spacing, type ThemeColors } from '@/theme';

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
  const styles = useMemo(() => createStyles(colors), []);

  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Sibling Pressable behind content — only rendered when dismiss is enabled */}
        {dismissOnOverlayPress && <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />}
        <View style={[styles.contentBox, contentStyle]} testID={testID}>
          {children}
        </View>
      </View>
    </Modal>
  );
};

function createStyles(colors: ThemeColors) {
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
