import { secrethitlerEngine } from '@game-judge/game-engine/games/secrethitler/public';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import { createPreviewRoomLink, createPreviewServices } from '../../preview/offlineServices';
import { PreviewApp, PreviewScreen, readPreviewScreenParameters } from '../../preview/PreviewApp';
import { getPreviewGame } from '../../preview/previewGames';
import { buildSecrethitlerTestLobby } from '../test-utils/secrethitlerState';

vi.mock('@/features/product/components/ResidentPreview', () => ({
  ResidentAvatarTile: () => null,
  ResidentSceneLayer: () => null,
}));

const room = {
  roomCode: '1234',
  roomId: 'preview-room',
  gameType: 'secrethitler',
  hostUserId: 'host',
  createdAt: new Date('2026-01-01T00:00:00Z'),
} as const;

describe('offline game preview', () => {
  it('updates only its in-memory room and rejects an unauthorized command', async () => {
    const fetchSpy = vi.spyOn(window, 'fetch');
    const hostLink = createPreviewRoomLink({
      initialState: buildSecrethitlerTestLobby(),
      identity: { room, userId: 'host' },
      engine: secrethitlerEngine,
      project: (state) => state,
    });
    const listener = vi.fn();
    hostLink.subscribe(listener);
    const result = await hostLink.dispatch(
      { type: 'secrethitler.roles.assign' },
      { controlledSeat: null, label: '分配角色', durable: false },
    );
    expect(result.kind).toBe('committed');
    expect(hostLink.getSnapshot().room?.state.phase.kind).toBe('viewing');
    expect(listener).toHaveBeenCalledOnce();

    const playerLink = createPreviewRoomLink({
      initialState: buildSecrethitlerTestLobby(),
      identity: { room, userId: 'u1' },
      engine: secrethitlerEngine,
      project: (state) => state,
    });
    const rejected = await playerLink.dispatch(
      { type: 'secrethitler.roles.assign' },
      { controlledSeat: null, label: '分配角色', durable: false },
    );
    expect(rejected.kind).toBe('rejected');
    expect(playerLink.getSnapshot().room?.state.phase.kind).toBe('lobby');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('explicitly refuses unsupported service operations', async () => {
    const services = createPreviewServices('host');
    await expect(services.roomDirectory.getRoom('1234')).rejects.toThrow('不支持离线预览');
    await expect(services.loadRoomLinks()).rejects.toThrow('不支持离线预览');
  });

  it('rejects unknown preview games, phases and viewers', () => {
    expect(() =>
      readPreviewScreenParameters('?game=missing&phase=lobby&viewer=0&page=room'),
    ).toThrow('Unknown preview game');
    expect(() =>
      readPreviewScreenParameters('?game=secrethitler&phase=lobby&viewer=99&page=room'),
    ).toThrow('无效的预览阶段或视角');
    expect(() =>
      readPreviewScreenParameters(
        '?game=toolbox&phase=preparing&viewer=host&page=room&otherPlayers=2&seatedOthers=3',
      ),
    ).toThrow('无效的预览人数');
    expect(
      readPreviewScreenParameters(
        '?game=toolbox&phase=preparing&viewer=host&page=room&otherPlayers=120&seatedOthers=95',
      ).population,
    ).toEqual({ otherPlayers: 120, seatedOthers: 95 });
  });

  it('opens the actual home and configuration screens', async () => {
    const game = getPreviewGame('secrethitler');
    const { unmount } = render(<PreviewScreen game={game} phase="lobby" viewer="0" page="home" />);
    expect(await screen.findByText('狼人面杀电子裁判助手')).toBeInTheDocument();
    const closeAnnouncement = screen.queryByRole('button', { name: '关闭公告' });
    if (closeAnnouncement !== null) fireEvent.click(closeAnnouncement);
    unmount();
    render(<PreviewScreen game={game} phase="lobby" viewer="2" page="config" />);
    expect(await screen.findByText('秘密希特勒设置')).toBeInTheDocument();
  });

  it('keeps state controls outside the page frame', async () => {
    render(<PreviewApp />);
    fireEvent.click(screen.getByRole('button', { name: '房间' }));
    fireEvent.change(screen.getByLabelText('阶段'), { target: { value: 'voting' } });
    fireEvent.change(screen.getByLabelText('视角'), { target: { value: '2' } });
    await waitFor(() =>
      expect(screen.getByTitle('游戏页面预览')).toHaveAttribute(
        'src',
        '?embedded=1&game=secrethitler&phase=voting&viewer=2&page=room',
      ),
    );
  });

  it('renders the real toolbox dice dialog against engine-applied commands', async () => {
    const game = getPreviewGame('toolbox');
    render(<PreviewScreen game={game} phase="active" viewer="u1" page="room" />);
    expect(await screen.findByText('本次参与中')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '骰子' }));
    const dialog = await screen.findByRole('dialog', { name: '我的骰盅' });
    expect(within(dialog).getByLabelText('骰子数量')).toHaveValue('5');
    expect(within(dialog).getByText('还没有摇骰')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByLabelText('音效'));
    fireEvent.click(within(dialog).getByRole('button', { name: '摇骰' }));
    expect(
      await within(dialog).findByText('骰盅已摇好，点击骰盅查看', {}, { timeout: 2500 }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole('list', { name: '我的骰子' })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '掀开骰盅' }));
    expect(await within(dialog).findByText('只有你能看到骰子')).toBeInTheDocument();
    expect(within(dialog).getByRole('list', { name: '我的骰子' }).children).toHaveLength(5);
    fireEvent.click(within(dialog).getByRole('button', { name: '盖上骰盅' }));
    expect(within(dialog).queryByRole('list', { name: '我的骰子' })).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '掀开骰盅' }));
    expect(within(dialog).queryByRole('button', { name: '亮骰' })).not.toBeInTheDocument();
  });

  it('keeps held dice and never lowers the count below them', async () => {
    const game = getPreviewGame('toolbox');
    render(<PreviewScreen game={game} phase="revealed" viewer="u1" page="room" />);
    fireEvent.click(await screen.findByRole('button', { name: '骰子' }));
    const dialog = await screen.findByRole('dialog', { name: '我的骰盅' });
    fireEvent.click(within(dialog).getByRole('button', { name: /^第1颗骰子/ }));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: /^第1颗骰子/ })).toHaveAttribute(
        'aria-pressed',
        'true',
      ),
    );
    expect(within(dialog).getByText('下次摇骰生效 · 已固定 1 颗')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText('骰子数量'), { target: { value: '1' } });
    await waitFor(() => expect(within(dialog).getByLabelText('骰子数量')).toHaveValue('1'));
    expect(within(dialog).getByRole('button', { name: '减少骰子数量' })).toBeDisabled();
    expect(within(dialog).getByText('取消固定后可继续减少数量')).toBeInTheDocument();
  });

  it('draws private identity cards from the shared deck', async () => {
    const game = getPreviewGame('toolbox');
    render(<PreviewScreen game={game} phase="active" viewer="u1" page="room" />);
    fireEvent.click(await screen.findByRole('button', { name: '抽牌' }));
    const dialog = await screen.findByRole('dialog', { name: '抽身份' });
    expect(within(dialog).getByText('已抽 0 / 1 张 · 牌堆剩余 6 张')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '抽一张身份牌' }));
    expect(await within(dialog).findByText('已抽完你的身份牌')).toBeInTheDocument();
    expect(within(dialog).getByText('已抽 1 / 1 张 · 牌堆剩余 5 张')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: '抽一张身份牌' })).toBeDisabled();
  });

  it('restarts back to preparation keeping the host seat', async () => {
    const game = getPreviewGame('toolbox');
    render(<PreviewScreen game={game} phase="drawn" viewer="host" page="room" />);
    fireEvent.click(await screen.findByRole('button', { name: /主持管理/ }));
    expect(screen.queryByRole('button', { name: '重开身份牌' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '重新开始' }));
    const confirm = await screen.findByRole('alertdialog', { name: '重新开始？' });
    fireEvent.click(within(confirm).getByRole('button', { name: '重新开始' }));
    expect(await screen.findByText('已入座')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消入座' })).toBeInTheDocument();
  });

  it('lets only the host start, and seats join through the shared hand', async () => {
    const game = getPreviewGame('toolbox');
    const { unmount } = render(
      <PreviewScreen game={game} phase="preparing" viewer="spectator" page="room" />,
    );
    expect(await screen.findByText('请入座')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '入座' }));
    expect(await screen.findByText('已入座')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消入座' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /主持管理/ })).not.toBeInTheDocument();
    unmount();
    render(<PreviewScreen game={game} phase="preparing" viewer="host" page="room" />);
    fireEvent.click(await screen.findByRole('button', { name: /主持管理/ }));
    expect(screen.getByRole('button', { name: '清空座位' })).toBeInTheDocument();
  });

  it('keeps spectators from using tools after the session starts', async () => {
    const game = getPreviewGame('toolbox');
    render(<PreviewScreen game={game} phase="drawn" viewer="spectator" page="room" />);
    expect(await screen.findByText('观看中')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '骰子' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '抽牌' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '入座' })).not.toBeInTheDocument();
  });

  it('requires a tool before creating a room in the real configuration screen', async () => {
    const game = getPreviewGame('toolbox');
    render(<PreviewScreen game={game} phase="preparing" viewer="host" page="config" />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /骰子/ }));
    expect(screen.getByText('请至少选择一个工具')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建房间' })).toBeDisabled();
  });

  it('configures identity cards in a dialog opened from the entry card', async () => {
    const game = getPreviewGame('toolbox');
    render(<PreviewScreen game={game} phase="preparing" viewer="host" page="config" />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /身份牌/ }));
    expect(screen.getByText('请先配置身份牌')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建房间' })).toBeDisabled();
    expect(screen.queryByLabelText('身份名称')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /身份配置/ }));
    const dialog = await screen.findByRole('dialog', { name: '配置抽身份' });
    fireEvent.change(within(dialog).getByLabelText('身份名称'), { target: { value: '侦探' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '完成' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: /侦探×1/ })).toBeInTheDocument();
    expect(screen.queryByText('请先配置身份牌')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建房间' })).toBeEnabled();
  });

  it('applies the simulated population to the engine-built room', async () => {
    const game = getPreviewGame('toolbox');
    render(
      <PreviewScreen
        game={game}
        phase="preparing"
        viewer="spectator"
        page="room"
        population={{ otherPlayers: 120, seatedOthers: 95 }}
      />,
    );
    expect(await screen.findByText('已入座 97 人')).toBeInTheDocument();
    expect(screen.getByText('聚会工具（123人）')).toBeInTheDocument();
  });
});
