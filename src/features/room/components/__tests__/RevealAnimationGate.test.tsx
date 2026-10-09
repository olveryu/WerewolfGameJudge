import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import type { RevealRoleData } from '@/features/room/model/RevealRoleData';

import { RevealAnimationGate } from '../RevealAnimationGate';

const mockAnimatorProps = jest.fn<(props: unknown) => void, [unknown]>();

jest.mock('../RoleRevealEffects/RoleRevealAnimator', () => {
  const { Pressable, Text } = require('react-native') as typeof import('react-native');
  return {
    RoleRevealAnimator: (props: {
      readonly onComplete: () => void;
      readonly effectType: string;
      readonly role: RevealRoleData;
    }) => {
      mockAnimatorProps(props);
      return (
        <Pressable testID="animator" onPress={props.onComplete}>
          <Text>{`animating ${props.role.id} with ${props.effectType}`}</Text>
        </Pressable>
      );
    },
  };
});

const role: RevealRoleData = { id: 'seer', name: '预言家', alignment: 'god' };

function renderGate(overrides: Partial<Parameters<typeof RevealAnimationGate>[0]> = {}) {
  return render(
    <RevealAnimationGate
      visible
      effectType="tarot"
      shouldPlay
      role={role}
      onPlayComplete={overrides.onPlayComplete}
      {...overrides}
    >
      <Text>static card</Text>
    </RevealAnimationGate>,
  );
}

describe('RevealAnimationGate', () => {
  beforeEach(() => {
    mockAnimatorProps.mockClear();
  });

  it('plays the animator when equipped and the anchor says first view', () => {
    const view = renderGate();
    expect(view.getByTestId('animator')).toBeTruthy();
    expect(view.queryByText('static card')).toBeNull();
    expect(mockAnimatorProps).toHaveBeenCalledWith(
      expect.objectContaining({ effectType: 'tarot', role, visible: true }),
    );
  });

  it('renders the static card when there is no equipped effect', () => {
    const view = renderGate({ effectType: null });
    expect(view.queryByTestId('animator')).toBeNull();
    expect(view.getByText('static card')).toBeTruthy();
  });

  it('renders the static card when the server record says already viewed', () => {
    const view = renderGate({ shouldPlay: false });
    expect(view.queryByTestId('animator')).toBeNull();
    expect(view.getByText('static card')).toBeTruthy();
  });

  it('switches to the static card when the animation completes and notifies once', () => {
    const onPlayComplete = jest.fn<unknown, unknown[]>();
    const view = renderGate({ onPlayComplete });
    fireEvent.press(view.getByTestId('animator'));
    expect(view.queryByTestId('animator')).toBeNull();
    expect(view.getByText('static card')).toBeTruthy();
    expect(onPlayComplete).toHaveBeenCalledTimes(1);
  });

  it('resets after close so the next open re-evaluates the anchor', () => {
    const onPlayComplete = jest.fn<unknown, unknown[]>();
    const view = renderGate({ onPlayComplete });
    fireEvent.press(view.getByTestId('animator'));
    expect(view.getByText('static card')).toBeTruthy();

    view.rerender(
      <RevealAnimationGate visible={false} effectType="tarot" shouldPlay role={role}>
        <Text>static card</Text>
      </RevealAnimationGate>,
    );
    view.rerender(
      <RevealAnimationGate visible effectType="tarot" shouldPlay role={role}>
        <Text>static card</Text>
      </RevealAnimationGate>,
    );
    // The gate itself would play again; in production the server record
    // (shouldPlay=false once viewed) is what prevents the replay.
    expect(view.getByTestId('animator')).toBeTruthy();
  });
});
