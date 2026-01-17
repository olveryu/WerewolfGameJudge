/**
 * SeatConfirmModal.stories.tsx - Stories for seat confirmation modal with interaction tests
 */

import type { Meta, StoryObj } from '@storybook/react';
import { fn, expect, userEvent, within } from 'storybook/test';
import { SeatConfirmModal } from './SeatConfirmModal';

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
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify modal shows correct message
    const message = canvas.getByText('确定在3号位入座?');
    await expect(message).toBeInTheDocument();

    // Click confirm button
    const confirmBtn = canvas.getByText('确定');
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
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // Click cancel button
    const cancelBtn = canvas.getByText('取消');
    await userEvent.click(cancelBtn);

    // Verify onCancel was called
    await expect(args.onCancel).toHaveBeenCalledTimes(1);
    await expect(args.onConfirm).not.toHaveBeenCalled();
  },
};

/** Leaving seat - shows correct message */
export const LeaveSeatConfirm: Story = {
  args: {
    visible: true,
    modalType: 'leave',
    seatNumber: 8,
  },
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);

    // Verify modal shows "站起" title and correct message
    const title = canvas.getByText('站起');
    await expect(title).toBeInTheDocument();
    
    const message = canvas.getByText('确定从8号位站起?');
    await expect(message).toBeInTheDocument();

    // Click confirm
    const confirmBtn = canvas.getByText('确定');
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
