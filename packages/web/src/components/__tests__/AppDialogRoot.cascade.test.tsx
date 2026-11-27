/**
 * AppDialog.Root keeps a dialog open when the confirmation that opened it is removed, and
 * changes nothing else: dismissible dialogs still close with Escape and outside interactions,
 * and the role reveal still closes only when its effect completes.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent, { PointerEventsCheckLevel } from '@testing-library/user-event';
import { type ReactNode, useState } from 'react';

import { AlertHostSlot } from '@/components/AlertHostSlot';
import { BottomSheet } from '@/components/BottomSheet';
import { CenterDialog } from '@/components/CenterDialog';
import { RoleCardDialog } from '@/features/room/components/RoleCard';
import { RoleRevealAnimator } from '@/features/room/components/RoleRevealEffects/RoleRevealAnimator';
import { RoomDialog } from '@/features/room/components/RoomDialog';
import { confirmView } from '@/features/room/confirm';
import { TESTIDS } from '@/testids';
import { alertStore } from '@/utils/alert';
import { debugLogStore } from '@/utils/debugLogStore';

vi.mock('@/features/room/components/RoleRevealEffects/RevealEffectStage', () => ({
  default: ({ effectProps }: { effectProps: { onComplete: () => void } }) => (
    <button onClick={effectProps.onComplete}>finish effect</button>
  ),
  prefetchRevealEffect: vi.fn(),
}));

const ROLE = { id: 'seer', name: '预言家', alignment: 'god' } as const;
/** RoleRevealAnimator names its content `${testIDPrefix}-modal`; the others take this id. */
const CONTENT_ID = 'cascade-modal';

type Close = () => void;

interface Case {
  readonly name: string;
  readonly render: (onClose: Close) => ReactNode;
  readonly escape: boolean;
  readonly outside: boolean;
}

const CASES: readonly Case[] = [
  {
    name: 'RoleRevealAnimator',
    render: (onClose) => (
      <RoleRevealAnimator
        effectType="tarot"
        role={ROLE}
        onComplete={onClose}
        testIDPrefix="cascade"
      />
    ),
    escape: false,
    outside: false,
  },
  {
    name: 'CenterDialog',
    render: (onClose) => (
      <CenterDialog open onClose={onClose} title="详情" testId={CONTENT_ID}>
        内容
      </CenterDialog>
    ),
    escape: true,
    outside: true,
  },
  {
    name: 'BottomSheet',
    render: (onClose) => (
      <BottomSheet title="详情" onClose={onClose} testId={CONTENT_ID}>
        内容
      </BottomSheet>
    ),
    escape: true,
    outside: true,
  },
  {
    name: 'RoleCardDialog',
    render: (onClose) => <RoleCardDialog role={ROLE} onClose={onClose} testId={CONTENT_ID} />,
    escape: true,
    outside: true,
  },
  {
    name: 'RoomDialog',
    render: (onClose) => (
      <RoomDialog title="详情" testId={CONTENT_ID} onClose={onClose} dismissOnEscape footer={null}>
        内容
      </RoomDialog>
    ),
    escape: true,
    outside: false,
  },
  {
    // Guards the branch main's RoomDialog patch used to cover by itself: these cases were green
    // before the fix too, and keep the shared root from regressing what the patch held.
    name: 'RoomDialog without Escape',
    render: (onClose) => (
      <RoomDialog title="详情" testId={CONTENT_ID} onClose={onClose} footer={null}>
        内容
      </RoomDialog>
    ),
    escape: false,
    outside: false,
  },
];

/** A page whose button asks「查看身份？」and opens `dialog` from the confirmation's「查看」. */
function OpenedFromConfirmation({ dialog, onClose }: { dialog: Case; onClose: Close }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => confirmView({ label: '查看身份', onView: () => setOpen(true) })}>
        ask
      </button>
      {open &&
        dialog.render(() => {
          onClose();
          setOpen(false);
        })}
      <AlertHostSlot />
    </>
  );
}

/** zag handles an outside press on the next animation frame. */
function settle() {
  return new Promise((resolve) => setTimeout(resolve, 50));
}

async function openFromConfirmation(dialog: Case) {
  const onClose = vi.fn();
  // A modal dialog sets `pointer-events: none` on the page; a real outside press still lands.
  const user = userEvent.setup({ pointerEventsCheck: PointerEventsCheckLevel.Never });
  render(<OpenedFromConfirmation dialog={dialog} onClose={onClose} />);
  await user.click(screen.getByRole('button', { name: 'ask' }));
  await user.click(await screen.findByRole('button', { name: '查看' }));
  // The confirmation plays its exit, then its layer leaves the stack below the new dialog.
  await waitFor(() => expect(screen.queryByTestId(TESTIDS.alertModal)).not.toBeInTheDocument());
  expect(alertStore.getSnapshot()).toBeNull();
  // zag starts listening for outside presses a tick after the dialog mounts.
  await settle();
  // Still open, so a later close can only come from the Escape or outside press under test.
  expect(onClose).not.toHaveBeenCalled();
  return { onClose, user };
}

describe('AppDialog.Root', () => {
  it.each(CASES)(
    'keeps $name open after the confirmation that opened it closes',
    async (dialog) => {
      const addLog = vi.spyOn(debugLogStore, 'addLog');
      const { onClose } = await openFromConfirmation(dialog);

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByTestId(CONTENT_ID)).toBeInTheDocument();
      // The blocked cascade is logged with the dialog kept and the layer whose removal caused it.
      const kept = JSON.stringify({ dialog: CONTENT_ID, removedLayer: TESTIDS.alertModal });
      expect(
        addLog.mock.calls.filter(
          ([line]) =>
            line.includes('[Dialog]') && line.includes('Kept a dialog open') && line.includes(kept),
        ),
      ).toHaveLength(1);
      addLog.mockRestore();
    },
  );

  it.each(CASES)('closes $name with Escape only when it allows Escape', async (dialog) => {
    const { onClose, user } = await openFromConfirmation(dialog);

    // The key reaches zag: focus is trapped in the dialog and zag listens on its document.
    expect(screen.getByTestId(CONTENT_ID).contains(document.activeElement)).toBe(true);
    const keys: string[] = [];
    document.addEventListener('keydown', (event) => keys.push(event.key), { once: true });
    await user.keyboard('{Escape}');
    expect(keys).toEqual(['Escape']);

    if (dialog.escape) {
      expect(onClose).toHaveBeenCalledOnce();
    } else {
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByTestId(CONTENT_ID)).toBeInTheDocument();
    }
  });

  it.each(CASES)(
    'closes $name with an outside interaction only when it allows one',
    async (dialog) => {
      const { onClose, user } = await openFromConfirmation(dialog);

      // The press reaches zag's document listener, outside the dialog's content.
      const pressTargets: EventTarget[] = [];
      document.addEventListener(
        'pointerdown',
        (event) => {
          if (event.target !== null) pressTargets.push(event.target);
        },
        { once: true },
      );
      // zag ignores a press inside the content's box; jsdom boxes are all at the origin.
      await user.pointer({
        keys: '[MouseLeft]',
        target: document.body,
        coords: { clientX: 200, clientY: 200 },
      });

      expect(pressTargets).toEqual([document.body]);

      if (dialog.outside) {
        await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
      } else {
        await settle();
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByTestId(CONTENT_ID)).toBeInTheDocument();
      }
    },
  );

  it('ends the role reveal opened from the confirmation when its effect completes', async () => {
    const reveal = CASES[0];
    if (reveal === undefined) throw new Error('Missing reveal case');
    const { onClose, user } = await openFromConfirmation(reveal);

    await user.click(screen.getByRole('button', { name: 'finish effect' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByTestId(CONTENT_ID)).not.toBeInTheDocument();
  });
});
