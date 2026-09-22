/** Shared page layout, guide hierarchy and callback contracts. */
import { fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';

import { componentSizes } from '@/theme/tokens';

import { GameGuide, GameGuideSection, GameNotice, RuleItem } from '../GameGuide';
import { GameScreen, GameScreenContent, GameScreenFooter } from '../GameScreen';
import { GameSettingsStepper } from '../GameSettings';

const styles = StyleSheet.create({ content: { opacity: 0.5 } });

describe('Shared game pages', () => {
  it('forwards count editing and increment intent while preserving the caller minimum gate', () => {
    const onDecrement = jest.fn();
    const onIncrement = jest.fn();
    const onChangeText = jest.fn();
    const view = render(
      <GameSettingsStepper
        label="玩家人数"
        onDecrement={onDecrement}
        onIncrement={onIncrement}
        isDecrementDisabled
        value="4"
        onChangeText={onChangeText}
      />,
    );
    fireEvent.press(view.getByRole('button', { name: '减少人数' }));
    expect(onDecrement).not.toHaveBeenCalled();
    fireEvent.press(view.getByRole('button', { name: '增加人数' }));
    expect(onIncrement).toHaveBeenCalledTimes(1);
    fireEvent.changeText(view.getByLabelText('玩家人数'), '');
    expect(onChangeText).toHaveBeenCalledWith('');
  });

  it.each([true, false])('keeps count geometry fixed when editable is %s', (isEditable) => {
    const view = render(
      <GameSettingsStepper
        label="玩家人数"
        value="8"
        onChangeText={isEditable ? jest.fn() : undefined}
        onDecrement={jest.fn()}
        onIncrement={jest.fn()}
        testID="count"
      />,
    );
    expect(view.getByTestId('count')).toHaveStyle({
      width: componentSizes.button.lg,
      height: componentSizes.button.md,
      lineHeight: componentSizes.button.md,
      flexShrink: 0,
      textAlign: 'center',
      paddingVertical: 0,
    });
  });

  it('keeps primary actions outside scrolling content and preserves caller scroll props', () => {
    const view = render(
      <GameScreen
        header={<Text>设置</Text>}
        footer={
          <GameScreenFooter>
            <Text>保存</Text>
          </GameScreenFooter>
        }
      >
        <GameScreenContent testID="content" style={styles.content}>
          <Text>玩家人数</Text>
        </GameScreenContent>
      </GameScreen>,
    );
    expect(within(view.getByTestId('content')).getByText('玩家人数')).toBeVisible();
    expect(within(view.getByTestId('content')).queryByText('保存')).toBeNull();
    expect(view.getByTestId('content')).toHaveStyle({ flex: 1, opacity: 0.5 });
    expect(view.getByText('保存')).toBeVisible();
  });

  it('renders guide content with heading levels and forwards back navigation', () => {
    const onBack = jest.fn();
    const view = render(
      <GameGuide title="玩法" heading="游戏目标" intro="说明" onBack={onBack}>
        <GameGuideSection title="流程">
          <RuleItem icon="eye-outline" title="查看词卡" description="确认后开始描述" />
        </GameGuideSection>
        <GameNotice text="出局后不能继续投票" />
      </GameGuide>,
    );
    expect(view.getByRole('header', { name: '游戏目标' })).toHaveProp('aria-level', 1);
    expect(view.getByRole('header', { name: '流程' })).toHaveProp('aria-level', 2);
    expect(view.getByText('确认后开始描述')).toBeVisible();
    expect(view.getByText('出局后不能继续投票')).toBeVisible();
    fireEvent.press(view.getByRole('button', { name: '返回' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
