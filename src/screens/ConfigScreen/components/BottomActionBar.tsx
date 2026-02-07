/**
 * BottomActionBar - Settings row pinned at screen bottom
 *
 * Shows Template + Animation + BGM dropdowns in a compact row.
 *
 * Performance: Memoized, receives pre-created styles from parent.
 */
import React, { memo } from 'react';
import { View } from 'react-native';
import { Dropdown, DropdownOption } from './Dropdown';
import { ConfigScreenStyles } from './styles';

export interface BottomActionBarProps {
  templateValue: string;
  templateOptions: DropdownOption[];
  onTemplateChange: (v: string) => void;
  animationValue: string;
  animationOptions: DropdownOption[];
  onAnimationChange: (v: string) => void;
  bgmValue: string;
  bgmOptions: DropdownOption[];
  onBgmChange: (v: string) => void;
  styles: ConfigScreenStyles;
}

const arePropsEqual = (prev: BottomActionBarProps, next: BottomActionBarProps): boolean => {
  return (
    prev.templateValue === next.templateValue &&
    prev.animationValue === next.animationValue &&
    prev.bgmValue === next.bgmValue &&
    prev.styles === next.styles &&
    prev.templateOptions.length === next.templateOptions.length
  );
};

export const BottomActionBar = memo<BottomActionBarProps>(
  ({
    templateValue,
    templateOptions,
    onTemplateChange,
    animationValue,
    animationOptions,
    onAnimationChange,
    bgmValue,
    bgmOptions,
    onBgmChange,
    styles,
  }) => {
    return (
      <View style={styles.bottomBar}>
        <Dropdown
          label="板子"
          value={templateValue}
          options={templateOptions}
          onSelect={onTemplateChange}
          styles={styles}
        />
        <Dropdown
          label="动画"
          value={animationValue}
          options={animationOptions}
          onSelect={onAnimationChange}
          styles={styles}
        />
        <Dropdown
          label="BGM"
          value={bgmValue}
          options={bgmOptions}
          onSelect={onBgmChange}
          styles={styles}
        />
      </View>
    );
  },
  arePropsEqual,
);

BottomActionBar.displayName = 'BottomActionBar';
