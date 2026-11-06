/**
 * StructuredDescriptionView.test.tsx - Tests for structured description rendering
 *
 * Ported case-by-case from the werewolf RoleDescriptionView suite: the shared
 * renderer takes caller-built DescriptionField[] instead of a RoleDescription,
 * so each case below builds the fields the werewolf adapter would produce for
 * the same RoleDescription input (labels/icons/tones per the adapter mapping).
 */
import { render } from '@testing-library/react-native';

import { StructuredDescriptionView } from '@/features/room/components/StructuredDescriptionView';
import type { DescriptionField } from '@/features/room/model/RevealRoleData';

// Mock theme
jest.mock('@/theme', () => ({
  colors: {
    surface: '#1C1C1F',
    text: '#F0F0F3',
    textSecondary: '#9898A8',
    textMuted: '#5E5E6E',
    border: '#2C2C32',
    warning: '#FBBF24',
    success: '#34D399',
  },
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

describe('StructuredDescriptionView', () => {
  describe('Mode A (single field)', () => {
    it('renders "技能介绍" title and centered text for single skill field', () => {
      const fields: readonly DescriptionField[] = [
        {
          label: '主动技能',
          icon: 'flash-outline',
          content: '每晚与狼队友共同选择一名玩家进行袭击',
        },
      ];
      const { getByText } = render(
        <StructuredDescriptionView
          fields={fields}
          descriptionFallback="fallback"
          factionColor={factionColor}
        />,
      );
      expect(getByText('技能介绍')).toBeTruthy();
      expect(getByText('每晚与狼队友共同选择一名玩家进行袭击')).toBeTruthy();
    });

    it('falls back to descriptionFallback when fields is undefined', () => {
      const { getByText } = render(
        <StructuredDescriptionView
          fields={undefined}
          descriptionFallback="没有特殊技能"
          factionColor={factionColor}
        />,
      );
      expect(getByText('技能介绍')).toBeTruthy();
      expect(getByText('没有特殊技能')).toBeTruthy();
    });

    it('uses single field text even if the field is passive (not skill)', () => {
      const fields: readonly DescriptionField[] = [
        { label: '被动特性', icon: 'shield-outline', content: '永久免疫夜间伤害' },
      ];
      const { getByText } = render(
        <StructuredDescriptionView
          fields={fields}
          descriptionFallback="fallback"
          factionColor={factionColor}
        />,
      );
      expect(getByText('永久免疫夜间伤害')).toBeTruthy();
    });
  });

  describe('Mode B (multiple fields)', () => {
    const witchFields: readonly DescriptionField[] = [
      {
        label: '主动技能',
        icon: 'flash-outline',
        content: '每晚可救活被狼人袭击的玩家或毒杀一名玩家',
      },
      { label: '被动特性', icon: 'shield-outline', content: '拥有一瓶解药和一瓶毒药' },
      {
        label: '限制条件',
        icon: 'close-circle-outline',
        tone: 'warning',
        content: '每瓶药限用一次；不能自救',
      },
    ];

    it('renders section labels with icons', () => {
      const { getByText } = render(
        <StructuredDescriptionView
          fields={witchFields}
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
        <StructuredDescriptionView
          fields={witchFields}
          descriptionFallback="fallback"
          factionColor={factionColor}
        />,
      );
      expect(getByText('每晚可救活被狼人袭击的玩家或毒杀一名玩家')).toBeTruthy();
      expect(getByText('拥有一瓶解药和一瓶毒药')).toBeTruthy();
    });

    it('does not show "技能介绍" title in Mode B', () => {
      const { queryByText } = render(
        <StructuredDescriptionView
          fields={witchFields}
          descriptionFallback="fallback"
          factionColor={factionColor}
        />,
      );
      expect(queryByText('技能介绍')).toBeNull();
    });

    it('splits semicolon-separated text into bullet items', () => {
      const { getAllByText, getByText } = render(
        <StructuredDescriptionView
          fields={witchFields}
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
    it('renders fields in the order given: skill → passive → trigger → restriction → special → winCondition', () => {
      const fields: readonly DescriptionField[] = [
        { label: '主动技能', icon: 'flash-outline', content: '首夜获知自身阵营' },
        { label: '被动特性', icon: 'shield-outline', content: '预言家查验为好人' },
        { label: '触发效果', icon: 'locate-outline', content: '出局可刺杀一名玩家' },
        { label: '特殊规则', icon: 'star-outline', content: '绑定机制' },
        {
          label: '胜利条件',
          icon: 'trophy-outline',
          tone: 'success',
          content: '屠城胜利',
        },
      ];
      const { getAllByText, getByText } = render(
        <StructuredDescriptionView
          fields={fields}
          descriptionFallback="fallback"
          factionColor={factionColor}
        />,
      );
      // All labels must be present
      expect(getByText('主动技能')).toBeTruthy();
      expect(getByText('被动特性')).toBeTruthy();
      expect(getByText('触发效果')).toBeTruthy();
      expect(getByText('特殊规则')).toBeTruthy();
      expect(getByText('胜利条件')).toBeTruthy();
      // The fields API renders sections in array order; assert the rendered
      // label sequence matches the order the caller supplied.
      const renderedLabels = getAllByText(/^(主动技能|被动特性|触发效果|特殊规则|胜利条件)$/).map(
        (node) => String(node.props.children),
      );
      expect(renderedLabels).toEqual(['主动技能', '被动特性', '触发效果', '特殊规则', '胜利条件']);
    });
  });

  describe('no bullet single clause', () => {
    it('does not show bullet for single-clause restriction', () => {
      const fields: readonly DescriptionField[] = [
        { label: '主动技能', icon: 'flash-outline', content: '白天可自爆并带走一名玩家' },
        {
          label: '限制条件',
          icon: 'close-circle-outline',
          tone: 'warning',
          content: '非自爆出局时不能发动技能',
        },
      ];
      const { queryAllByText } = render(
        <StructuredDescriptionView
          fields={fields}
          descriptionFallback="fallback"
          factionColor={factionColor}
        />,
      );
      // Single clause — no bullet dots
      expect(queryAllByText('•')).toHaveLength(0);
    });
  });
});
