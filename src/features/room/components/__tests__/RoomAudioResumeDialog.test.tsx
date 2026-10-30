/** RoomAudioResumeDialog: the shared post-rejoin gate copy and its single continue action. */
import { fireEvent, render } from '@testing-library/react-native';

import {
  ROOM_AUDIO_RESUME_BUTTON,
  ROOM_AUDIO_RESUME_MESSAGE,
  ROOM_AUDIO_RESUME_TITLE,
  RoomAudioResumeDialog,
} from '../RoomAudioResumeDialog';

describe('RoomAudioResumeDialog', () => {
  it('renders the werewolf resume copy and continues on the button', () => {
    const onContinue = jest.fn();
    const view = render(<RoomAudioResumeDialog visible onContinue={onContinue} />);
    expect(view.getByText(ROOM_AUDIO_RESUME_TITLE)).toBeTruthy();
    expect(view.getByText(ROOM_AUDIO_RESUME_MESSAGE)).toBeTruthy();
    fireEvent.press(view.getByText(ROOM_AUDIO_RESUME_BUTTON));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while hidden', () => {
    const view = render(<RoomAudioResumeDialog visible={false} onContinue={jest.fn()} />);
    expect(view.queryByText(ROOM_AUDIO_RESUME_TITLE)).toBeNull();
  });
});
