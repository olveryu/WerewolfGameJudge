/**
 * Section - Memoized section container for role groups
 *
 * Performance: Receives pre-created styles from parent.
 */
import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { ConfigScreenStyles } from './styles';

export interface SectionProps {
  title: string;
  children: React.ReactNode;
  styles: ConfigScreenStyles;
}

// Section is a container, children change often, so we use a simpler memo
// that only compares title and styles reference
const arePropsEqual = (prev: SectionProps, next: SectionProps): boolean => {
  return prev.title === next.title && prev.styles === next.styles;
  // children are complex and change when selection changes, so we let them re-render
};

export const Section = memo<SectionProps>(({ title, children, styles }) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chipContainer}>{children}</View>
    </View>
  );
}, arePropsEqual);

Section.displayName = 'Section';
