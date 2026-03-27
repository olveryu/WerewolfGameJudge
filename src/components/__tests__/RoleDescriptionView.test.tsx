/**
 * RoleDescriptionView.test.tsx - Tests for structured role description rendering
 */
import { render } from '@testing-library/react-native';
import type { RoleDescription } from '@werewolf/game-engine/models/roles/spec/roleSpec.types';

import { RoleDescriptionView } from '@/components/RoleDescriptionView';

// Mock theme
jest.mock('../../theme', () => ({
  useColors: () => ({
    surface: '#1C1C1F',
    text: '#F0F0F3',
    textSecondary: '#9898A8',
    textMuted: '#5E5E6E',
    border: '#2C2C32',
    warning: '#FBBF24',
    success: '#34D399',
  }),
  withAlpha: (hex: string, _opacity: number) => `${hex}4D`,
  spacing: {
    micro: 2,
    tight: 4,
    small: 8,
    medium: 16,
    large: 24,
  },
  typography: {
    captionSmall: 10,
    caption: 12,
    secondary: 14,
    body: 16,
    weights: {
      normal: '400',
      medium: '500',
      semibold: '600',
      bold: '700',
    },
  },
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

const factionColor = '#A78BFA';

describe('RoleDescriptionView', () => {
  describe('Mode A (single field)', () => {
    it('renders "技能介绍" title and centered text for single skill field', () => {
      const desc: RoleDescription = { skill: '每晚与狼队友共同选择一名玩家进行袭击' };
      const { getByText } = render(
        <RoleDescriptionView
          structuredDescription={desc}
          descriptionFallback="fallback"
          factionColor={factionColor}
        />,
      );
      expect(getByText('技能介绍')).toBeTruthy();
      expect(getByText('每晚与狼队友共同选择一名玩家进行袭击')).toBeTruthy();
    });

    it('falls back to descriptionFallback when structuredDescription is undefined', () => {
      const { getByText } = render(
        <RoleDescriptionView
          structuredDescription={undefined}
          descriptionFallback="没有特殊技能"
          factionColor={factionColor}
        />,
      );
      expect(getByText('技能介绍')).toBeTruthy();
      expect(getByText('没有特殊技能')).toBeTruthy();
    });

    it('uses single field text even if key is passive (not skill)', () => {
      const desc: RoleDescription = { passive: '永久免疫夜间伤害' };
      const { getByText } = render(
        <RoleDescriptionView
          structuredDescription={desc}
          descriptionFallback="fallback"
          factionColor={factionColor}
        />,
      );
      expect(getByText('永久免疫夜间伤害')).toBeTruthy();
    });
  });

  describe('Mode B (multiple fields)', () => {
    const witchDesc: RoleDescription = {
      skill: '每晚可救活被狼人袭击的玩家或毒杀一名玩家',
      passive: '拥有一瓶解药和一瓶毒药',
      restriction: '每瓶药限用一次；不能自救',
    };

    it('renders section labels with icons', () => {
      const { getByText } = render(
        <RoleDescriptionView
          structuredDescription={witchDesc}
          descriptionFallback="fallback"
          factionColor={factionColor}
        />,
      );
      expect(getByText('主动技能')).toBeTruthy();
      expect(getByText('被动特性')).toBeTruthy();
      expect(getByText('限制条件')).toBeTruthy();
    });

    it('renders section body text', () => {
      const { getByText } = render(
        <RoleDescriptionView
          structuredDescription={witchDesc}
          descriptionFallback="fallback"
          factionColor={factionColor}
        />,
      );
      expect(getByText('每晚可救活被狼人袭击的玩家或毒杀一名玩家')).toBeTruthy();
      expect(getByText('拥有一瓶解药和一瓶毒药')).toBeTruthy();
    });

    it('does not show "技能介绍" title in Mode B', () => {
      const { queryByText } = render(
        <RoleDescriptionView
          structuredDescription={witchDesc}
          descriptionFallback="fallback"
          factionColor={factionColor}
        />,
      );
      expect(queryByText('技能介绍')).toBeNull();
    });

    it('splits semicolon-separated text into bullet items', () => {
      const { getAllByText, getByText } = render(
        <RoleDescriptionView
          structuredDescription={witchDesc}
          descriptionFallback="fallback"
          factionColor={factionColor}
        />,
      );
      // "每瓶药限用一次；不能自救" should be split into 2 bullets
      expect(getByText('每瓶药限用一次')).toBeTruthy();
      expect(getByText('不能自救')).toBeTruthy();
      // Two bullet dots for the restriction field
      const dots = getAllByText('•');
      expect(dots.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('field ordering', () => {
    it('renders fields in the correct order: skill → passive → trigger → restriction → special → winCondition', () => {
      const desc: RoleDescription = {
        winCondition: '屠城胜利',
        skill: '首夜获知自身阵营',
        passive: '预言家查验为好人',
        trigger: '出局可刺杀一名玩家',
        special: '绑定机制',
      };
      const { getByText } = render(
        <RoleDescriptionView
          structuredDescription={desc}
          descriptionFallback="fallback"
          factionColor={factionColor}
        />,
      );
      // All labels must be present (ordering is visual, hard to assert order in unit test)
      expect(getByText('主动技能')).toBeTruthy();
      expect(getByText('被动特性')).toBeTruthy();
      expect(getByText('触发效果')).toBeTruthy();
      expect(getByText('特殊规则')).toBeTruthy();
      expect(getByText('胜利条件')).toBeTruthy();
    });
  });

  describe('no bullet single clause', () => {
    it('does not show bullet for single-clause restriction', () => {
      const desc: RoleDescription = {
        skill: '白天可自爆并带走一名玩家',
        restriction: '非自爆出局时不能发动技能',
      };
      const { queryAllByText } = render(
        <RoleDescriptionView
          structuredDescription={desc}
          descriptionFallback="fallback"
          factionColor={factionColor}
        />,
      );
      // Single clause — no bullet dots
      expect(queryAllByText('•')).toHaveLength(0);
    });
  });
});
