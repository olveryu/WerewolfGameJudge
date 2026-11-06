/**
 * DrawGuess drawing phase: the guess log scrolls internally in the body
 * while the composer stays pinned in the task-frame footer.
 *
 * This renders the production arrangement from `DrawGuessDrawingView`
 * (same two components in the same `RoomTaskFrame` slots); the screen
 * shell above it contributes only non-scrolling `RoomShell` views, so
 * the ancestor rule is pinned here instead of behind the full room
 * session harness.
 */

import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { RoomTaskFrame } from '@/features/room/components/RoomTaskFrame';
import {
  assertNoScrollingAncestor,
  assertNotDescendantOf,
  assertSharesPinnedFooter,
  getPinnedFooterAncestor,
} from '@/test-utils/noScrollingAncestor';

import { DrawGuessGuessComposer } from '../DrawGuessGuessComposer';
import { DrawGuessGuessLog } from '../DrawGuessGuessLog';

describe('DrawGuess drawing-phase composition', () => {
  it('pins the composer in the footer while the guess log scrolls in the body', () => {
    const view = render(
      <RoomTaskFrame
        header={<Text>作画</Text>}
        footer={
          <DrawGuessGuessComposer
            draft=""
            onDraftChange={() => undefined}
            isLocked={false}
            canGuess
            onSubmitGuess={async () => true}
          />
        }
        maxWidth={430}
      >
        <DrawGuessGuessLog
          messages={[
            { seat: 1, displayName: '玩家1', text: '猫', correct: false, at: 1000 },
            { seat: 2, displayName: '玩家2', text: null, correct: true, at: 2000 },
          ]}
          viewerSeat={0}
        />
      </RoomTaskFrame>,
    );

    const input = view.getByLabelText('猜词输入框');
    assertNoScrollingAncestor(input);
    assertSharesPinnedFooter(input, view.getByLabelText('发送猜词'));
    // The scrolling log stays in the body: it must not sit inside the footer.
    assertNotDescendantOf(view.getByLabelText('猜词消息'), getPinnedFooterAncestor(input));
  });
});
