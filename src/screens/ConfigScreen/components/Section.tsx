/**
 * Section - 角色分组容器（Memoized）
 *
 * 接收 title + children（RoleChip 列表）。仅渲染分区 UI，不 import service，不包含业务逻辑判断。
 */
import React, { memo } from 'react';
import { Text, View } from 'react-native';

import { ConfigScreenStyles } from './styles';

interface SectionProps {
  title: string;
  children: React.ReactNode;
  styles: ConfigScreenStyles;
}

export const Section = memo<SectionProps>(({ title, children, styles }) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>
        <View style={styles.chipContainer}>{children}</View>
      </View>
    </View>
  );
});

Section.displayName = 'Section';
