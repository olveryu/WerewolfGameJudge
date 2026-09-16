import { fireEvent, render } from '@testing-library/react-native';

import { FashionTutorial } from '../FashionTutorial';

describe('FashionTutorial', () => {
  it('walks a player through evidence, ESG knowledge, governance choice, and completion', () => {
    const onComplete = jest.fn();
    const screen = render(
      <FashionTutorial topInset={0} onBack={jest.fn()} onComplete={onComplete} />,
    );

    expect(screen.getByText('第一天上班，三份文件')).toBeTruthy();
    fireEvent.press(screen.getByText('打开牛皮纸信封'));

    expect(screen.getByText('第一步 · 选择优先调查方向')).toBeTruthy();
    fireEvent.press(screen.getByText('先查深水埗布料采购（追踪标签造假的源头）'));

    expect(screen.getByText('强制阅读 · ESG 知识')).toBeTruthy();
    expect(screen.getByText('社会（S）')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: /我已阅读，并能说出 S 的定义/ }));

    expect(screen.getByText('第二步 · 会议室里的决定')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('选择 A'));

    expect(screen.getByText('成就：吹哨者')).toBeTruthy();
    fireEvent.press(screen.getByText('完成新手关卡，解锁正式 7 人游戏'));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
