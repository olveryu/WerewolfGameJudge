/**
 * Section - Memoized section container for role groups
 *
 * Performance: Receives pre-created styles from parent.
 * Note: We use default shallow comparison which includes children.
 * When children (RoleChips) change their props, React will create new
 * React elements, causing children reference to change and Section to re-render.
 */
import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { ConfigScreenStyles } from './styles';

export interface SectionProps {
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
