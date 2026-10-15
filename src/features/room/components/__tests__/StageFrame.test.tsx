/** Stage frame contract: the header stays pinned outside the scrolling content. */

import { render, within } from '@testing-library/react-native';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { STAGE_FRAME_MAX_WIDTH, StageFrame } from '../StageFrame';

describe('StageFrame', () => {
  it('renders the header outside the scroll area and the content inside it', () => {
    const view = render(
      <StageFrame
        header={
          <View>
            <Text>阶段标题</Text>
          </View>
        }
      >
        <Text>阶段内容</Text>
      </StageFrame>,
    );
    const { UNSAFE_getByType: getByType } = view;
    const scroller = within(getByType(ScrollView));
    expect(scroller.getByText('阶段内容')).toBeVisible();
    expect(scroller.queryByText('阶段标题')).toBeNull();
    expect(view.getByText('阶段标题')).toBeVisible();
  });

  it('applies the testID to the width-limited column that wraps header and content', () => {
    const view = render(
      <StageFrame testID="stage-frame" header={<Text>阶段标题</Text>}>
        <Text>阶段内容</Text>
      </StageFrame>,
    );
    const column = within(view.getByTestId('stage-frame'));
    expect(column.getByText('阶段标题')).toBeVisible();
    expect(column.getByText('阶段内容')).toBeVisible();
    expect(StyleSheet.flatten(view.getByTestId('stage-frame').props.style)).toEqual(
      expect.objectContaining({ maxWidth: STAGE_FRAME_MAX_WIDTH }),
    );
  });

  it('forwards the scroll behaviour props to the scroll area', () => {
    const view = render(
      <StageFrame
        header={<Text>阶段标题</Text>}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text>阶段内容</Text>
      </StageFrame>,
    );
    const { UNSAFE_getByType: getByType } = view;
    expect(getByType(ScrollView).props.showsVerticalScrollIndicator).toBe(false);
    expect(getByType(ScrollView).props.keyboardShouldPersistTaps).toBe('handled');
  });
});
