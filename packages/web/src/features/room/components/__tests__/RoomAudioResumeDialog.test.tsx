/** RoomAudioResumeDialog: the shared post-rejoin gate copy and its single continue action. */
import { fireEvent, render, screen } from '@testing-library/react';

import {
  ROOM_AUDIO_RESUME_BUTTON,
  ROOM_AUDIO_RESUME_MESSAGE,
  ROOM_AUDIO_RESUME_TITLE,
  RoomAudioResumeDialog,
} from '../RoomAudioResumeDialog';

describe('RoomAudioResumeDialog', () => {
  it('renders the werewolf resume copy and continues on the button', () => {
    const onContinue = vi.fn();
    render(<RoomAudioResumeDialog visible onContinue={onContinue} />);
    expect(screen.getByRole('alertdialog', { name: ROOM_AUDIO_RESUME_TITLE })).toBeInTheDocument();
    expect(screen.getByText(ROOM_AUDIO_RESUME_MESSAGE)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: ROOM_AUDIO_RESUME_BUTTON }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it('renders nothing while hidden', () => {
    render(<RoomAudioResumeDialog visible={false} onContinue={vi.fn()} />);
    expect(screen.queryByText(ROOM_AUDIO_RESUME_TITLE)).toBeNull();
  });
});
