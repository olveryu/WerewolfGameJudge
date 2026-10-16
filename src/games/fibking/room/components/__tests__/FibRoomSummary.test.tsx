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
        playerCount={4}
        preparationStage={preparationStage}
        preparationFailureCode={null}
      />,
    );

    expect(view.getByTestId(TESTIDS.fibPreparationStatus)).toHaveTextContent(label);
  });

  it('shows the inventory-exhausted failure line', () => {
    const view = render(
      <FibRoomSummary
        phase="preparationFailed"
        playerCount={4}
        preparationStage={null}
        preparationFailureCode={'inventoryExhausted' satisfies FibPreparationFailureCode}
      />,
    );

    expect(view.getByTestId(TESTIDS.fibPreparationStatus)).toHaveTextContent(
      '本桌新题已用完，请等待题库更新',
    );
  });

  it('shows no failure line for a plain selection failure (the retry lives on the host console)', () => {
    const view = render(
      <FibRoomSummary
        phase="preparationFailed"
        playerCount={4}
        preparationStage={null}
        preparationFailureCode={'selectionFailed' satisfies FibPreparationFailureCode}
      />,
    );

    expect(view.queryByTestId(TESTIDS.fibPreparationStatus)).toBeNull();
    expect(view.queryByText(/暂无可用词语/)).toBeNull();
  });

  it('hides preparation status outside the preparing phases', () => {
    const view = render(
      <FibRoomSummary
        phase="preparing"
        playerCount={4}
        preparationStage={FIB_PREPARATION_STAGES.finalizing}
        preparationFailureCode={null}
      />,
    );

    view.rerender(
      <FibRoomSummary
        phase="ongoing"
        playerCount={4}
        preparationStage={null}
        preparationFailureCode={null}
      />,
    );

    expect(view.queryByTestId(TESTIDS.fibPreparationStatus)).toBeNull();
  });
});
