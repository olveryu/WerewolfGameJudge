/** 结算提示行：全员猜中清零时显示说明，否则不渲染。 */

import { render } from '@testing-library/react-native';

import {
  DRAWGUESS_DRAWER_ZEROED_NOTE,
  DrawGuessDrawerZeroedNote,
} from '../components/DrawGuessDrawerZeroedNote';

describe('DrawGuessDrawerZeroedNote', () => {
  it('renders the note when the drawer round gain was zeroed', () => {
    const view = render(<DrawGuessDrawerZeroedNote visible />);
    expect(view.getByText(DRAWGUESS_DRAWER_ZEROED_NOTE)).toBeVisible();
    expect(view.getByTestId('drawguess-drawer-zeroed-note')).toBeVisible();
  });

  it('renders nothing when the drawer round gain was not zeroed', () => {
    const view = render(<DrawGuessDrawerZeroedNote visible={false} />);
    expect(view.queryByText(DRAWGUESS_DRAWER_ZEROED_NOTE)).toBeNull();
    expect(view.queryByTestId('drawguess-drawer-zeroed-note')).toBeNull();
  });
});
