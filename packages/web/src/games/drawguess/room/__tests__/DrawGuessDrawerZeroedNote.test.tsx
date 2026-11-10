/** 结算提示行：全员猜中清零时显示说明，否则不渲染。 */

import { render, screen } from '@testing-library/react';

import {
  DRAWGUESS_DRAWER_ZEROED_NOTE,
  DrawGuessDrawerZeroedNote,
} from '../components/DrawGuessDrawerZeroedNote';

describe('DrawGuessDrawerZeroedNote', () => {
  it('renders the note when the drawer round gain was zeroed', () => {
    render(<DrawGuessDrawerZeroedNote visible />);
    expect(screen.getByTestId('drawguess-drawer-zeroed-note')).toHaveTextContent(
      DRAWGUESS_DRAWER_ZEROED_NOTE,
    );
  });

  it('renders nothing when the drawer round gain was not zeroed', () => {
    render(<DrawGuessDrawerZeroedNote visible={false} />);
    expect(screen.queryByText(DRAWGUESS_DRAWER_ZEROED_NOTE)).toBeNull();
    expect(screen.queryByTestId('drawguess-drawer-zeroed-note')).toBeNull();
  });
});
