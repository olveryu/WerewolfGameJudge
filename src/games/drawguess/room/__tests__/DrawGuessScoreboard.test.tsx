/** 计分板：按总分排序、结算双列、自己一行高亮、终局不渲染本轮段。 */

import { render } from '@testing-library/react-native';
import { type StyleProp, StyleSheet, Text, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

import {
  DrawGuessScoreboard,
  type DrawGuessScoreboardRow,
} from '../components/DrawGuessScoreboard';

const rows: readonly DrawGuessScoreboardRow[] = [
  {
    seat: 0,
    displayName: '画手',
    isBot: false,
    isDrawer: true,
    isSelf: false,
    roundScore: 50,
    totalScore: 300,
  },
  {
    seat: 1,
    displayName: '我',
    isBot: false,
    isDrawer: false,
    isSelf: true,
    roundScore: 20,
    totalScore: 300,
  },
  {
    seat: 2,
    displayName: '后来者',
    isBot: false,
    isDrawer: false,
    isSelf: false,
    roundScore: 100,
    totalScore: 100,
  },
];

describe('DrawGuessScoreboard', () => {
  it('sorts by total score and shares the competition rank on a tie', () => {
    const view = render(<DrawGuessScoreboard title="本轮得分" competitionRanking rows={rows} />);
    expect(view.getAllByText('🥇')).toHaveLength(2);
    expect(view.getByText('🥉')).toBeVisible();
    const textOf = (node: { props: { children?: unknown } }): string => {
      const children = node.props.children;
      if (typeof children === 'string') return children;
      if (Array.isArray(children))
        return children.filter((child) => typeof child === 'string').join('');
      return '';
    };
    const texts = view.UNSAFE_getAllByType(Text).map(textOf);
    const order = ['画手 · 画手', '我', '后来者'].map((name) =>
      texts.findIndex((text) => text.startsWith(name)),
    );
    expect(order[0]).toBeGreaterThanOrEqual(0);
    const [first = -1, second = -1, third = -1] = order;
    expect(first).toBeLessThan(second);
    expect(second).toBeLessThan(third);
  });

  it('renders the round gain and the total on each settlement row', () => {
    const view = render(
      <DrawGuessScoreboard title="本轮得分" competitionRanking={false} rows={rows} />,
    );
    expect(view.getByText('+50 · 总分 300')).toBeVisible();
    expect(view.getByText('+20 · 总分 300')).toBeVisible();
    expect(view.getByText('+100 · 总分 100')).toBeVisible();
  });

  it('highlights the viewer row and renders totals only on the final board', () => {
    const view = render(
      <DrawGuessScoreboard
        title="最终排名"
        competitionRanking
        rows={rows.map((row) => ({ ...row, roundScore: null }))}
      />,
    );
    const selfName = view.getByText('我');
    const selfNameStyle = StyleSheet.flatten(
      (selfName.props as { readonly style?: StyleProp<ViewStyle> }).style,
    );
    expect(selfNameStyle).toEqual(expect.objectContaining({ color: colors.primary }));
    expect(view.getAllByText('300 分')).toHaveLength(2);
    expect(view.queryByText(/总分/)).toBeNull();
  });
});
