/** DebugPanel: the store opens it; level filter, search, copy, clear and close act on the logs. */
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { debugLogStore } from '@/utils/debugLogStore';

import { DebugPanelSlot } from '../DebugPanelSlot';

function seedLogs() {
  debugLogStore.addLog('[Room] joined 1234', 'log');
  debugLogStore.addLog('[Realtime] socket closed', 'warn');
  debugLogStore.addLog('[Room] command failed', 'error');
  debugLogStore.addLog('[Audio] queue drained', 'debug');
}

function logMessages(): string[] {
  return within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .map((row) => row.lastElementChild?.textContent ?? '');
}

beforeEach(() => {
  debugLogStore.clear();
  debugLogStore.setVisible(false);
});

it('stays unmounted until the store opens it, then lists every log', async () => {
  seedLogs();
  render(<DebugPanelSlot />);
  expect(screen.queryByRole('dialog')).toBeNull();

  act(() => debugLogStore.setVisible(true));

  expect(await screen.findByRole('dialog', { name: 'Debug Console' })).toBeInTheDocument();
  expect(logMessages()).toEqual([
    '[Room] joined 1234',
    '[Realtime] socket closed',
    '[Room] command failed',
    '[Audio] queue drained',
  ]);
  expect(screen.getByText('4 / 4 条')).toBeInTheDocument();
});

it('narrows the list by level and by case-insensitive search', async () => {
  const user = userEvent.setup();
  seedLogs();
  debugLogStore.setVisible(true);
  render(<DebugPanelSlot />);
  await screen.findByRole('dialog');

  await user.click(screen.getByRole('button', { name: 'ERR' }));
  expect(screen.getByRole('button', { name: 'ERR' })).toHaveAttribute('aria-pressed', 'true');
  expect(logMessages()).toEqual(['[Room] command failed']);

  await user.click(screen.getByRole('button', { name: 'ALL' }));
  await user.type(screen.getByPlaceholderText('搜索日志...'), 'room');
  expect(logMessages()).toEqual(['[Room] joined 1234', '[Room] command failed']);
  expect(screen.getByText('2 / 4 条')).toBeInTheDocument();
});

it('copies every log as timestamped lines', async () => {
  const user = userEvent.setup();
  debugLogStore.addLog('[Room] joined 1234', 'log');
  debugLogStore.addLog('[Room] command failed', 'error');
  debugLogStore.setVisible(true);
  render(<DebugPanelSlot />);
  await screen.findByRole('dialog');

  await user.click(screen.getByRole('button', { name: '复制日志' }));

  expect(await navigator.clipboard.readText()).toMatch(
    /^\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[LOG\] \[Room\] joined 1234\n\[\d{2}:\d{2}:\d{2}\.\d{3}\] \[ERROR\] \[Room\] command failed$/,
  );
  expect(screen.getByRole('button', { name: '已复制日志' })).toBeInTheDocument();
});

it('clears the logs and closes back into the store', async () => {
  const user = userEvent.setup();
  seedLogs();
  debugLogStore.setVisible(true);
  render(<DebugPanelSlot />);
  await screen.findByRole('dialog');

  await user.click(screen.getByRole('button', { name: '清空日志' }));
  expect(debugLogStore.getSnapshot().logs).toEqual([]);
  expect(screen.getByText('0 / 0 条')).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: '关闭' }));
  expect(debugLogStore.getSnapshot().visible).toBe(false);
});
