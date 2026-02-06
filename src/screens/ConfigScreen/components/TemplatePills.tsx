/**
 * TemplatePills - Compact inline template selector pills
 *
 * Horizontal scrollable row of pill-shaped buttons for template selection.
 * More compact than the old TemplateCarousel (single line, no card structure).
 *
 * Performance: Memoized, receives pre-created styles from parent.
 */
import React, { memo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { ConfigScreenStyles } from './styles';

export interface TemplatePillData {
  name: string;
  count: number;
}

export interface TemplatePillsProps {
  templates: TemplatePillData[];
  selectedTemplate: string;
  onSelect: (templateName: string) => void;
  styles: ConfigScreenStyles;
  accentColor: string;
}

const arePropsEqual = (prev: TemplatePillsProps, next: TemplatePillsProps): boolean => {
  return (
    prev.selectedTemplate === next.selectedTemplate &&
    prev.templates.length === next.templates.length &&
    prev.accentColor === next.accentColor &&
    prev.styles === next.styles
  );
};

const PillItem = memo<{
  name: string;
  isSelected: boolean;
  onPress: (name: string) => void;
  styles: ConfigScreenStyles;
  accentColor: string;
}>(({ name, isSelected, onPress, styles, accentColor }) => {
  const handlePress = useCallback(() => onPress(name), [name, onPress]);

  return (
    <TouchableOpacity
      testID={`config-template-pill-${name}`}
      style={[
        styles.templatePill,
        isSelected && styles.templatePillSelected,
      ]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.templatePillText,
          isSelected && styles.templatePillTextSelected,
        ]}
        numberOfLines={1}
      >
        {name}
      </Text>
    </TouchableOpacity>
  );
});

PillItem.displayName = 'PillItem';

export const TemplatePills = memo<TemplatePillsProps>(
  ({ templates, selectedTemplate, onSelect, styles, accentColor }) => {
    return (
      <View style={styles.templatePillsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.templatePillsContent}
        >
          {templates.map((t) => (
            <PillItem
              key={t.name}
              name={t.name}
              isSelected={t.name === selectedTemplate}
              onPress={onSelect}
              styles={styles}
              accentColor={accentColor}
            />
          ))}
          <PillItem
            key="__custom__"
            name="自定义"
            isSelected={selectedTemplate === '__custom__'}
            onPress={onSelect}
            styles={styles}
            accentColor={accentColor}
          />
        </ScrollView>
      </View>
    );
  },
  arePropsEqual,
);

TemplatePills.displayName = 'TemplatePills';
