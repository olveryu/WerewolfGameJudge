/** FibKing room summary preparation-state rendering tests. */

import {
  FIB_PREPARATION_STAGES,
  type FibPreparationFailureCode,
} from '@game-judge/game-engine/games/fibking/public';
import { render } from '@testing-library/react-native';

import { TESTIDS } from '@/testids';

import { FibRoomSummary } from '../FibRoomSummary';

describe('FibRoomSummary', () => {
  it.each([
    [FIB_PREPARATION_STAGES.queued, '等待选取词语'],
    [FIB_PREPARATION_STAGES.selecting, '正在选取中文词语'],
    [FIB_PREPARATION_STAGES.finalizing, '正在检查词语和释义'],
  ] as const)('shows the authoritative %s preparation stage', (preparationStage, label) => {
    const view = render(
      <FibRoomSummary
        phase="preparing"
        occupiedSeatCount={4}
        playerCount={4}
        preparationStage={preparationStage}
        preparationFailureCode={null}
        onOpenRules={jest.fn()}
      />,
    );

    expect(view.getByTestId(TESTIDS.fibPreparationStatus)).toHaveTextContent(label);
  });

  it.each([['selectionFailed', '暂无可用词语，请重新准备']] satisfies readonly (readonly [
    FibPreparationFailureCode,
    string,
  ])[])('shows the Chinese %s preparation failure', (preparationFailureCode, label) => {
    const view = render(
      <FibRoomSummary
        phase="preparationFailed"
        occupiedSeatCount={4}
        playerCount={4}
        preparationStage={null}
        preparationFailureCode={preparationFailureCode}
        onOpenRules={jest.fn()}
      />,
    );

    expect(view.getByTestId(TESTIDS.fibPreparationStatus)).toHaveTextContent(label);
  });

  it('hides preparation status outside the preparing phases', () => {
    const view = render(
      <FibRoomSummary
        phase="preparing"
        occupiedSeatCount={4}
        playerCount={4}
        preparationStage={FIB_PREPARATION_STAGES.finalizing}
        preparationFailureCode={null}
        onOpenRules={jest.fn()}
      />,
    );

    view.rerender(
      <FibRoomSummary
        phase="ongoing"
        occupiedSeatCount={4}
        playerCount={4}
        preparationStage={null}
        preparationFailureCode={null}
        onOpenRules={jest.fn()}
      />,
    );

    expect(view.queryByTestId(TESTIDS.fibPreparationStatus)).toBeNull();
  });
});
