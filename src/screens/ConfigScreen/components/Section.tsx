/**
 * Section - role group container (memoized)
 *
 * Accepts title + children (RoleChip list). Only renders the section UI; does not import services, contains no business logic.
 */
import type React from 'react';
import { memo } from 'react';
import { Text, View } from 'react-native';

import { type ConfigScreenStyles } from './styles';

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
