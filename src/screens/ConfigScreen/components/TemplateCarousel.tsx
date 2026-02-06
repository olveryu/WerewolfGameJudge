/**
 * TemplateCarousel - Horizontal scrollable template cards
 *
 * Replaces the template Dropdown with visually richer cards.
 * Performance: Memoized, receives pre-created styles from parent.
 */
import React, { memo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { ConfigScreenStyles } from './styles';

export interface TemplateCardData {
  name: string;
  count: number;
}

export interface TemplateCarouselProps {
  templates: TemplateCardData[];
  selectedTemplate: string;
  onSelect: (templateName: string) => void;
  styles: ConfigScreenStyles;
}

const arePropsEqual = (prev: TemplateCarouselProps, next: TemplateCarouselProps): boolean => {
  return (
    prev.selectedTemplate === next.selectedTemplate &&
    prev.templates.length === next.templates.length &&
    prev.styles === next.styles
  );
};

const TemplateCardItem = memo<{
  name: string;
  count: number;
  isSelected: boolean;
  onPress: (name: string) => void;
  styles: ConfigScreenStyles;
}>(({ name, count, isSelected, onPress, styles }) => {
  const handlePress = useCallback(() => onPress(name), [name, onPress]);

  return (
    <TouchableOpacity
      testID={`config-template-card-${name}`}
      style={[styles.templateCard, isSelected && styles.templateCardSelected]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <Text
        style={[styles.templateCardName, isSelected && styles.templateCardNameSelected]}
        numberOfLines={1}
      >
        {name}
      </Text>
      <Text style={[styles.templateCardCount, isSelected && styles.templateCardCountSelected]}>
        {count}人
      </Text>
    </TouchableOpacity>
  );
});

TemplateCardItem.displayName = 'TemplateCardItem';

export const TemplateCarousel = memo<TemplateCarouselProps>(
  ({ templates, selectedTemplate, onSelect, styles }) => {
    return (
      <View style={styles.templateCarousel}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.templateCarouselContent}
        >
          {templates.map((t) => (
            <TemplateCardItem
              key={t.name}
              name={t.name}
              count={t.count}
              isSelected={t.name === selectedTemplate}
              onPress={onSelect}
              styles={styles}
            />
          ))}
          <TemplateCardItem
            key="__custom__"
            name="自定义"
            count={0}
            isSelected={selectedTemplate === '__custom__'}
            onPress={() => onSelect('__custom__')}
            styles={styles}
          />
        </ScrollView>
      </View>
    );
  },
  arePropsEqual,
);

TemplateCarousel.displayName = 'TemplateCarousel';
