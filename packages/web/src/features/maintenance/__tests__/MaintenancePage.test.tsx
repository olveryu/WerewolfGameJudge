import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MaintenancePage } from '../MaintenancePage';

const configuration = {
  enabled: true,
  message: '系统维护中',
  endsAt: '2099-01-02T09:00:00+08:00',
};

afterEach(() => vi.useRealTimers());

describe('maintenance moon admin shortcut', () => {
  it('opens the admin password gate on the fourth click, not the first three', () => {
    const onOpenAdmin = vi.fn();
    render(<MaintenancePage configuration={configuration} onOpenAdmin={onOpenAdmin} />);
    const moon = screen.getByRole('button', { name: '进入管理后台（连续点击四次）' });
    for (let count = 0; count < 3; count++) fireEvent.click(moon);
    expect(onOpenAdmin).not.toHaveBeenCalled();
    fireEvent.click(moon);
    expect(onOpenAdmin).toHaveBeenCalledTimes(1);
    fireEvent.click(moon);
    expect(onOpenAdmin).toHaveBeenCalledTimes(1);
  });

  it('resets the gesture after a gap longer than three seconds', () => {
    vi.useFakeTimers();
    const onOpenAdmin = vi.fn();
    render(<MaintenancePage configuration={configuration} onOpenAdmin={onOpenAdmin} />);
    const moon = screen.getByRole('button', { name: '进入管理后台（连续点击四次）' });
    fireEvent.click(moon);
    fireEvent.click(moon);
    vi.advanceTimersByTime(3_001);
    fireEvent.click(moon);
    fireEvent.click(moon);
    expect(onOpenAdmin).not.toHaveBeenCalled();
    fireEvent.click(moon);
    fireEvent.click(moon);
    expect(onOpenAdmin).toHaveBeenCalledTimes(1);
  });

  it('does not navigate away while previewing the page in the editor', () => {
    const onOpenAdmin = vi.fn();
    render(<MaintenancePage configuration={configuration} onOpenAdmin={onOpenAdmin} preview />);
    const moon = screen.getByRole('button', { name: '进入管理后台（连续点击四次）' });
    expect(moon).toBeDisabled();
    for (let count = 0; count < 4; count++) fireEvent.click(moon);
    expect(onOpenAdmin).not.toHaveBeenCalled();
  });
});
