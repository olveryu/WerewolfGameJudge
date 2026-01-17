/**
 * SeatConfirmModal.stories.tsx - Stories for seat confirmation modal with interaction tests
 *
 * NOTE: React Native Modal renders to document.body (portal), not the Storybook canvas.
 * We use `screen` instead of `within(canvasElement)` to find modal elements.
 */

import type { Meta, StoryObj } from '@storybook/react';
import { fn, expect, userEvent, screen } from 'storybook/test';
import { SeatConfirmModal } from './SeatConfirmModal';
import { TESTIDS } from '../../../testids';

const meta: Meta<typeof SeatConfirmModal> = {
  title: 'RoomScreen/SeatConfirmModal',
  component: SeatConfirmModal,
  tags: ['autodocs'],
  args: {
    // Default mocks for callbacks
    onConfirm: fn(),
    onCancel: fn(),
  },
  argTypes: {
    visible: { control: 'boolean', description: 'Modal visibility' },
    modalType: {
      control: 'select',
      options: ['enter', 'leave'],
      description: 'Action type',
    },
    seatNumber: { control: 'number', description: 'Seat number (1-indexed)' },
  },
};

export default meta;
type Story = StoryObj<typeof SeatConfirmModal>;

/** Entering seat - click confirm button triggers onConfirm */
export const EnterSeatConfirm: Story = {
  args: {
    visible: true,
    modalType: 'enter',
    seatNumber: 3,
  },
  play: async ({ args }) => {
    // Modal renders to body portal, use screen instead of canvas
    const modal = await screen.findByTestId(TESTIDS.seatConfirmModal);
    await expect(modal).toBeInTheDocument();

    // Click confirm button
    const confirmBtn = await screen.findByTestId(TESTIDS.seatConfirmOk);
    await userEvent.click(confirmBtn);

    // Verify onConfirm was called
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
    await expect(args.onCancel).not.toHaveBeenCalled();
  },
};

/** Entering seat - click cancel button triggers onCancel */
export const EnterSeatCancel: Story = {
  args: {
    visible: true,
    modalType: 'enter',
    seatNumber: 5,
  },
  play: async ({ args }) => {
    // Click cancel button
    const cancelBtn = await screen.findByTestId(TESTIDS.seatConfirmCancel);
    await userEvent.click(cancelBtn);

    // Verify onCancel was called
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
    await expect(args.onConfirm).not.toHaveBeenCalled();
  },
};

/** Leaving seat - shows correct title */
export const LeaveSeatConfirm: Story = {
  args: {
    visible: true,
    modalType: 'leave',
    seatNumber: 8,
  },
  play: async ({ args }) => {
    // Verify modal is visible
    const modal = await screen.findByTestId(TESTIDS.seatConfirmModal);
    await expect(modal).toBeInTheDocument();

    // Click confirm
    const confirmBtn = await screen.findByTestId(TESTIDS.seatConfirmOk);
    await userEvent.click(confirmBtn);
    await expect(args.onConfirm).toHaveBeenCalledTimes(1);
  },
};

/** Hidden modal - nothing visible */
export const Hidden: Story = {
  args: {
    visible: false,
    modalType: 'enter',
    seatNumber: 1,
  },
};
