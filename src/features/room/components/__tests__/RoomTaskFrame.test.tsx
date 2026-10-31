/** Room task frame contract: no scrolling container, footer pinned, caps declared per game. */

import { render, within } from '@testing-library/react-native';
import {
  ScrollView,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';

import { spacing } from '@/theme';

import { RoomTaskFrame } from '../RoomTaskFrame';

describe('RoomTaskFrame', () => {
  it('renders header, body and footer with no ScrollView anywhere in the tree', () => {
    const view = render(
      <RoomTaskFrame header={<Text>任务标题</Text>} footer={<Text>底部操作</Text>} maxWidth={430}>
        <TextInput value="" onChangeText={() => undefined} accessibilityLabel="任务输入" />
        <Text>任务内容</Text>
      </RoomTaskFrame>,
    );
    expect(view.UNSAFE_queryAllByType(ScrollView)).toHaveLength(0);
    expect(view.getByText('任务标题')).toBeVisible();
    expect(view.getByText('任务内容')).toBeVisible();
    expect(view.getByText('底部操作')).toBeVisible();
    expect(view.getByLabelText('任务输入')).toBeVisible();
  });

  it('applies the testID and the game-declared max width to the task column', () => {
    const view = render(
      <RoomTaskFrame
        header={<Text>任务标题</Text>}
        footer={null}
        maxWidth={800}
        testID="task-frame"
      >
        <Text>任务内容</Text>
      </RoomTaskFrame>,
    );
    const column = within(view.getByTestId('task-frame'));
    expect(column.getByText('任务标题')).toBeVisible();
    expect(column.getByText('任务内容')).toBeVisible();
    expect(StyleSheet.flatten(view.getByTestId('task-frame').props.style)).toEqual(
      expect.objectContaining({ maxWidth: 800 }),
    );
  });

  it('omits the footer wrapper when the footer is null', () => {
    const withFooter = render(
      <RoomTaskFrame header={<Text>任务标题</Text>} footer={<Text>底部操作</Text>} maxWidth={430}>
        <Text>任务内容</Text>
      </RoomTaskFrame>,
    );
    const view = render(
      <RoomTaskFrame header={<Text>任务标题</Text>} footer={null} maxWidth={430}>
        <Text>任务内容</Text>
      </RoomTaskFrame>,
    );
    expect(view.queryByText('底部操作')).toBeNull();
    expect(view.getByText('任务内容')).toBeVisible();
    expect(view.UNSAFE_queryAllByType(View).length).toBe(
      withFooter.UNSAFE_queryAllByType(View).length - 1,
    );
  });

  it('merges the container and footer geometry overrides after the base styles', () => {
    const view = render(
      <RoomTaskFrame
        header={<Text>任务标题</Text>}
        footer={<Text>底部操作</Text>}
        maxWidth={430}
        testID="task-frame"
        containerStyle={{ paddingHorizontal: spacing.medium }}
        footerStyle={testStyles.footer}
      >
        <Text>任务内容</Text>
      </RoomTaskFrame>,
    );
    expect(StyleSheet.flatten(view.getByTestId('task-frame').props.style)).toEqual(
      expect.objectContaining({ paddingHorizontal: spacing.medium }),
    );
    const footerViews = view.UNSAFE_getAllByType(View).filter((node) => {
      const style = StyleSheet.flatten(
        (node.props as { readonly style?: StyleProp<ViewStyle> }).style,
      );
      return style !== undefined && style.borderTopWidth === 1;
    });
    expect(footerViews).toHaveLength(1);
    const footerView = footerViews.at(0);
    expect(footerView).toBeDefined();
    expect(StyleSheet.flatten(footerView?.props.style)).toEqual(
      expect.objectContaining({ borderTopWidth: 1, flexShrink: 0 }),
    );
  });
});

const testStyles = StyleSheet.create({
  footer: { borderTopWidth: 1 },
});
