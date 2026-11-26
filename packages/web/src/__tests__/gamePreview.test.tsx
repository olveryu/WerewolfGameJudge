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
    const hostLink = createPreviewRoomLink(buildSecrethitlerTestLobby(), { room, userId: 'host' });
    const listener = vi.fn();
    hostLink.subscribe(listener);
    const result = await hostLink.dispatch(
      { type: 'secrethitler.roles.assign' },
      { controlledSeat: null, label: '分配角色', durable: false },
    );
    expect(result.kind).toBe('committed');
    expect(hostLink.getSnapshot().room?.state.phase.kind).toBe('viewing');
    expect(listener).toHaveBeenCalledOnce();

    const playerLink = createPreviewRoomLink(buildSecrethitlerTestLobby(), { room, userId: 'u1' });
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
        '?game=dice&phase=lobby&viewer=0&page=room&otherPlayers=2&seatedOthers=3',
      ),
    ).toThrow('无效的预览人数');
    expect(
      readPreviewScreenParameters(
        '?game=dice&phase=lobby&viewer=0&page=room&otherPlayers=120&seatedOthers=95',
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

  it('lets a player roll and view a private adjustable cup without imposing rules', async () => {
    const game = getPreviewGame('dice');
    render(<PreviewScreen game={game} phase="playing" viewer="1" page="room" />);
    const diceCard = await screen.findByRole('button', { name: '骰子' });
    expect(screen.queryByRole('group', { name: '骰子数量' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '摇骰' })).not.toBeInTheDocument();
    fireEvent.click(diceCard);
    expect(await screen.findByRole('dialog', { name: '我的骰盅' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('group', { name: '骰子数量' })).getByText('5 颗'),
    ).toBeInTheDocument();
    expect(screen.getByText('还没有摇骰')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('音效'));

    fireEvent.click(screen.getByRole('button', { name: '摇骰' }));
    expect(screen.getByText('正在摇骰…')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: '我的骰子' })).not.toBeInTheDocument();
    expect(
      await screen.findByText('骰盅已摇好，点击骰盅查看', {}, { timeout: 2500 }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '掀开骰盅' }));
    expect(screen.getByRole('list', { name: '我的骰子' }).children).toHaveLength(5);
    expect(screen.getByText('只有你能看到骰子')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '盖上骰盅' }));
    expect(screen.queryByRole('list', { name: '我的骰子' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '掀开骰盅' }));
    expect(screen.queryByRole('button', { name: '亮骰' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '关闭详情' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '骰子' }));
    expect(await screen.findByText('只有你能看到骰子')).toBeInTheDocument();
    expect(screen.getByRole('list', { name: '我的骰子' }).children).toHaveLength(5);

    fireEvent.click(screen.getByRole('button', { name: '减少骰子数量' }));
    fireEvent.click(screen.getByRole('button', { name: '减少骰子数量' }));
    fireEvent.click(screen.getByRole('button', { name: '摇骰' }));
    expect(
      await screen.findByText('骰盅已摇好，点击骰盅查看', {}, { timeout: 2500 }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '掀开骰盅' }));
    expect(screen.getByRole('list', { name: '我的骰子' }).children).toHaveLength(3);
    expect(screen.getByText('只有你能看到骰子')).toBeInTheDocument();
  });

  it('retains selected dice when rerolling and never reduces the count below held dice', async () => {
    const game = getPreviewGame('dice');
    render(<PreviewScreen game={game} phase="open" viewer="1" page="room" />);
    fireEvent.click(await screen.findByRole('button', { name: '骰子' }));
    const decrease = await screen.findByRole('button', { name: '减少骰子数量' });
    for (let count = 0; count < 4; count++) fireEvent.click(decrease);
    fireEvent.click(await screen.findByRole('button', { name: '第2颗骰子 2点' }));
    fireEvent.click(screen.getByRole('button', { name: '第4颗骰子 4点' }));
    expect(screen.getByRole('button', { name: '第2颗骰子 2点' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(decrease).toBeDisabled();
    expect(
      within(screen.getByRole('group', { name: '骰子数量' })).getByText('2 颗'),
    ).toBeInTheDocument();
    expect(screen.getByText('取消固定后可继续减少数量')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '增加骰子数量' }));

    fireEvent.click(screen.getByRole('button', { name: '关闭详情' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '骰子' }));
    expect(await screen.findByRole('button', { name: '第2颗骰子 2点' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByLabelText('音效'));
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    fireEvent.click(screen.getByRole('button', { name: '摇骰' }));
    random.mockRestore();
    await screen.findByText('骰盅已摇好，点击骰盅查看', {}, { timeout: 2500 });
    fireEvent.click(screen.getByRole('button', { name: '掀开骰盅' }));
    expect(screen.getByRole('button', { name: '第1颗骰子 2点' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '第2颗骰子 4点' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: '第3颗骰子 6点' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByText('只有你能看到骰子')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '第1颗骰子 2点' }));
    expect(screen.getByRole('button', { name: '第1颗骰子 2点' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('lets only the host start the preview room', async () => {
    const game = getPreviewGame('dice');
    const { unmount } = render(<PreviewScreen game={game} phase="lobby" viewer="1" page="room" />);
    expect(await screen.findByText('等待开始')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '开始' })).not.toBeInTheDocument();
    unmount();
    render(<PreviewScreen game={game} phase="lobby" viewer="0" page="room" />);
    expect(await screen.findByText('骰子')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: '入座' }));
    fireEvent.click(await screen.findByRole('button', { name: /主持管理/ }));
    fireEvent.click(screen.getByRole('button', { name: /开始/ }));
    expect(screen.getByRole('button', { name: '骰子' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '抽牌' })).not.toBeInTheDocument();
  });

  it('requires a tool in the configuration and shows the chosen tool in the room', async () => {
    const game = getPreviewGame('dice');
    render(<PreviewScreen game={game} phase="lobby" viewer="0" page="config" />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /骰子/ }));
    expect(screen.getByRole('button', { name: '创建房间' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: /抽身份/ }));
    fireEvent.click(screen.getByRole('button', { name: '创建房间' }));
    expect(screen.getByText('本局道具')).toBeInTheDocument();
    expect(screen.getByText('抽身份')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: '入座' }));
    fireEvent.click(await screen.findByRole('button', { name: /主持管理/ }));
    fireEvent.click(screen.getByRole('button', { name: '开始' }));
    expect(await screen.findByRole('dialog', { name: '配置抽身份' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '骰子' })).not.toBeInTheDocument();
  });

  it('configures, saves, draws and resets identity cards in the local preview', async () => {
    const game = getPreviewGame('dice');
    render(<PreviewScreen game={game} phase="lobby" viewer="0" page="config" />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /抽身份/ }));
    fireEvent.click(screen.getByRole('button', { name: '创建房间' }));
    expect(screen.getByText('骰子、抽身份')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: '入座' }));
    fireEvent.click(await screen.findByRole('button', { name: /主持管理/ }));
    fireEvent.click(screen.getByRole('button', { name: /开始/ }));
    expect(await screen.findByRole('dialog', { name: '配置抽身份' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('身份名称'), { target: { value: '侦探' } });
    fireEvent.change(screen.getByLabelText('身份说明（可选）'), { target: { value: '寻找线索' } });
    fireEvent.change(screen.getByLabelText('每人抽牌数量'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('数量'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: '开始游戏' }));
    expect(screen.getByText('身份牌不足：4 人共需要 8 张。')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('数量'), { target: { value: '8' } });
    fireEvent.click(screen.getByText('身份方案（可选）'));
    fireEvent.change(screen.getByLabelText('方案名称'), { target: { value: '聚会方案' } });
    fireEvent.click(screen.getByRole('button', { name: '保存新方案' }));
    expect(screen.getByText('「聚会方案」已保存到本次预览。')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('身份名称'), { target: { value: '临时修改' } });
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /主持管理/ }));
    fireEvent.click(screen.getByRole('button', { name: /开始/ }));
    expect(await screen.findByLabelText('身份名称')).toHaveValue('临时修改');
    fireEvent.click(screen.getByText('身份方案（1 套）'));
    fireEvent.change(screen.getByLabelText('使用已保存的方案'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('使用已保存的方案'), { target: { value: '聚会方案' } });
    expect(screen.getByLabelText('身份名称')).toHaveValue('侦探');
    fireEvent.click(screen.getByRole('button', { name: '开始游戏' }));
    expect(screen.getByRole('button', { name: '骰子' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '抽牌' }));
    fireEvent.click(await screen.findByRole('button', { name: '抽一张身份牌' }));
    expect(screen.getByText('侦探')).toBeInTheDocument();
    expect(screen.getByText('寻找线索')).toBeInTheDocument();
    expect(screen.getByText('已抽 1 / 2 张 · 牌堆剩余 7 张')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '抽一张身份牌' }));
    expect(screen.getByRole('button', { name: '抽一张身份牌' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '完成' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '抽牌' }));
    expect(await screen.findAllByText('侦探')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '完成' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /主持管理/ }));
    fireEvent.click(screen.getByRole('button', { name: '重开身份牌' }));
    fireEvent.click(await screen.findByRole('button', { name: '继续配置' }));
    expect(await screen.findByRole('dialog', { name: '重开身份牌' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '确认重开' }));
    fireEvent.click(screen.getByRole('button', { name: '抽牌' }));
    expect(await screen.findByText('已抽 0 / 2 张 · 牌堆剩余 8 张')).toBeInTheDocument();
    expect(screen.queryByText('侦探')).not.toBeInTheDocument();
  });

  it('edits identities in tabs while keeping total and draw count in the footer', async () => {
    const game = getPreviewGame('dice');
    render(<PreviewScreen game={game} phase="lobby" viewer="0" page="config" />);
    fireEvent.click(await screen.findByRole('checkbox', { name: /抽身份/ }));
    fireEvent.click(screen.getByRole('button', { name: '创建房间' }));
    fireEvent.click(await screen.findByRole('button', { name: '入座' }));
    fireEvent.click(await screen.findByRole('button', { name: /主持管理/ }));
    fireEvent.click(screen.getByRole('button', { name: '开始' }));
    const dialog = await screen.findByRole('dialog', { name: '配置抽身份' });
    const footer = within(dialog).getByRole('contentinfo');
    expect(within(footer).getByLabelText('每人抽牌数量')).toBeInTheDocument();
    expect(within(footer).getByText('共 1 张 · 4 人需 4 张')).toBeInTheDocument();
    fireEvent.change(
      within(screen.getByRole('group', { name: '身份 1' })).getByLabelText('身份名称'),
      {
        target: { value: '侦探' },
      },
    );
    fireEvent.click(within(dialog).getByRole('button', { name: '添加身份' }));
    expect(within(dialog).getByRole('tab', { name: '身份 2' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    fireEvent.change(
      within(screen.getByRole('group', { name: '身份 2' })).getByLabelText('身份名称'),
      {
        target: { value: '旅人' },
      },
    );
    fireEvent.change(within(screen.getByRole('group', { name: '身份 2' })).getByLabelText('数量'), {
      target: { value: '3' },
    });

    expect(within(footer).getByText('共 4 张 · 4 人需 4 张')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('tab', { name: '侦探' }));
    expect(
      within(screen.getByRole('group', { name: '身份 1' })).getByLabelText('身份名称'),
    ).toHaveValue('侦探');
    fireEvent.change(
      within(screen.getByRole('group', { name: '身份 1' })).getByLabelText('身份名称'),
      {
        target: { value: '' },
      },
    );
    fireEvent.click(within(dialog).getByRole('tab', { name: '旅人' }));
    fireEvent.click(within(dialog).getByRole('button', { name: '开始游戏' }));
    expect(within(dialog).getByRole('tab', { name: '身份 1' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(within(footer).getByText('请填写每种身份的名称。')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: '删除身份 1' }));
    expect(within(dialog).getByRole('tab', { name: '旅人' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('lets the host join or leave and requires at least one participant to start', async () => {
    const game = getPreviewGame('dice');
    render(
      <PreviewScreen
        game={game}
        phase="lobby"
        viewer="0"
        page="room"
        population={{ otherPlayers: 0, seatedOthers: 0 }}
      />,
    );
    expect(await screen.findByText('0 人')).toBeInTheDocument();
    expect(screen.getByText('请入座')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /座位/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /主持管理/ }));
    expect(screen.getByRole('button', { name: '开始' })).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(screen.getByRole('button', { name: '返回' }));
    fireEvent.click(screen.getByRole('button', { name: '入座' }));
    expect(screen.getByText('已入座')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消入座' })).toBeInTheDocument();
    expect(screen.getAllByText('1 人')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '取消入座' }));
    expect(screen.getByText('0 人')).toBeInTheDocument();
    expect(screen.getByText('请入座')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '入座' }));
    fireEvent.click(screen.getByRole('button', { name: /主持管理/ }));
    fireEvent.click(screen.getByRole('button', { name: '开始' }));
    expect(screen.getByRole('button', { name: '骰子' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消入座' })).not.toBeInTheDocument();
  });

  it('keeps spectators from using tools after the game starts', async () => {
    const game = getPreviewGame('dice');
    render(<PreviewScreen game={game} phase="identity" viewer="2" page="room" />);
    expect(await screen.findByText('观看中')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '骰子' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '抽牌' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '入座' })).not.toBeInTheDocument();
  });

  it('lets an unseated host start for others but only watch', async () => {
    const game = getPreviewGame('dice');
    render(
      <PreviewScreen
        game={game}
        phase="lobby"
        viewer="0"
        page="room"
        population={{ otherPlayers: 1, seatedOthers: 1 }}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /主持管理/ }));
    fireEvent.click(screen.getByRole('button', { name: '开始' }));
    expect(screen.getByText('观看中')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '骰子' })).not.toBeInTheDocument();
  });

  it('shows simulated population without a fixed room size', async () => {
    const game = getPreviewGame('dice');
    render(
      <PreviewScreen
        game={game}
        phase="lobby"
        viewer="1"
        page="room"
        population={{ otherPlayers: 120, seatedOthers: 95 }}
      />,
    );
    expect(await screen.findByText('121 人')).toBeInTheDocument();
    expect(screen.getByText('95 人')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '入座' }));
    expect(screen.getByText('96 人')).toBeInTheDocument();
  });
});
