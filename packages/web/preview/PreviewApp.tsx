import './preview.css';

import { useState } from 'react';

import { Select } from '@/components/Select';
import { TextField } from '@/components/TextField';

import {
  defaultPreviewPopulation,
  getPreviewGame,
  type PreviewGame,
  previewGames,
  type PreviewPage,
  type PreviewPopulation,
} from './previewGames';

function firstOption(options: readonly { readonly id: string }[], label: string): string {
  const first = options[0];
  if (first === undefined) throw new Error(`Preview has no ${label}`);
  return first.id;
}

/** Keeps controls outside the frame so production modal dialogs cannot block them. */
export function PreviewApp() {
  const initialGame = previewGames[0];
  if (initialGame === undefined) throw new Error('No preview games registered');
  const [gameId, setGameId] = useState(initialGame.id);
  const [phase, setPhase] = useState(() => firstOption(initialGame.phases, 'phases'));
  const [viewer, setViewer] = useState(() => firstOption(initialGame.viewers(phase), 'viewers'));
  const [page, setPage] = useState<PreviewPage>('home');
  const [population, setPopulation] = useState(defaultPreviewPopulation);
  const [otherPlayers, setOtherPlayers] = useState(String(defaultPreviewPopulation.otherPlayers));
  const [seatedOthers, setSeatedOthers] = useState(String(defaultPreviewPopulation.seatedOthers));
  const [populationError, setPopulationError] = useState('');
  const game = getPreviewGame(gameId);
  const parameters = new URLSearchParams({ embedded: '1', game: gameId, phase, viewer, page });
  if (game.supportsPopulation) {
    parameters.set('otherPlayers', String(population.otherPlayers));
    parameters.set('seatedOthers', String(population.seatedOthers));
  }
  const applyPopulation = () => {
    const others = Number(otherPlayers);
    const seated = Number(seatedOthers);
    if (
      !/^\d+$/.test(otherPlayers) ||
      !/^\d+$/.test(seatedOthers) ||
      !Number.isSafeInteger(others) ||
      !Number.isSafeInteger(seated) ||
      others >= Number.MAX_SAFE_INTEGER ||
      seated > others
    ) {
      setPopulationError('请输入有效人数，其他入座人数不能超过其他在场人数。');
      return;
    }
    setPopulationError('');
    setPopulation({ otherPlayers: others, seatedOthers: seated });
  };
  const changeGame = (id: string) => {
    const next = getPreviewGame(id);
    const nextPhase = firstOption(next.phases, 'phases');
    setGameId(id);
    setPhase(nextPhase);
    setViewer(firstOption(next.viewers(nextPhase), 'viewers'));
  };
  const changePhase = (nextPhase: string) => {
    const viewers = game.viewers(nextPhase);
    setPhase(nextPhase);
    if (!viewers.some((option) => option.id === viewer)) setViewer(firstOption(viewers, 'viewers'));
  };
  return (
    <>
      <nav className="preview-controls" aria-label="游戏预览控制">
        <strong>离线预览</strong>
        <label htmlFor="preview-game">
          游戏
          <Select
            id="preview-game"
            value={gameId}
            onChange={(event) => changeGame(event.target.value)}
          >
            {previewGames.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        <button type="button" onClick={() => setPage('home')}>
          首页
        </button>
        <button type="button" onClick={() => setPage('config')}>
          配置
        </button>
        <button type="button" onClick={() => setPage('room')}>
          房间
        </button>
        <label htmlFor="preview-phase">
          阶段
          <Select
            id="preview-phase"
            value={phase}
            onChange={(event) => changePhase(event.target.value)}
          >
            {game.phases.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        <label htmlFor="preview-viewer">
          视角
          <Select
            id="preview-viewer"
            value={viewer}
            onChange={(event) => setViewer(event.target.value)}
          >
            {game.viewers(phase).map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </Select>
        </label>
        {game.supportsPopulation && (
          <>
            <label htmlFor="preview-others">
              其他在场人数
              <span className="preview-number">
                <TextField
                  id="preview-others"
                  type="number"
                  min="0"
                  value={otherPlayers}
                  onChange={(event) => setOtherPlayers(event.currentTarget.value)}
                />
              </span>
            </label>
            <label htmlFor="preview-seated">
              其他入座人数
              <span className="preview-number">
                <TextField
                  id="preview-seated"
                  type="number"
                  min="0"
                  value={seatedOthers}
                  onChange={(event) => setSeatedOthers(event.currentTarget.value)}
                />
              </span>
            </label>
            <button type="button" onClick={applyPopulation}>
              应用模拟人数
            </button>
            <span>应用后重置预览</span>
            {populationError !== '' && <span role="alert">{populationError}</span>}
          </>
        )}
      </nav>
      <iframe className="preview-screen" title="游戏页面预览" src={`?${parameters.toString()}`} />
    </>
  );
}

/** Validates the frame's game, scenario and viewer before rendering. */
export function readPreviewScreenParameters(search: string): {
  readonly game: PreviewGame;
  readonly phase: string;
  readonly viewer: string;
  readonly page: PreviewPage;
  readonly population: PreviewPopulation;
} {
  const parameters = new URLSearchParams(search);
  const gameId = parameters.get('game');
  const phase = parameters.get('phase');
  const viewer = parameters.get('viewer');
  const page = parameters.get('page');
  const otherPlayers = parameters.get('otherPlayers');
  const seatedOthers = parameters.get('seatedOthers');
  if (
    gameId === null ||
    phase === null ||
    viewer === null ||
    (page !== 'home' && page !== 'config' && page !== 'room')
  ) {
    throw new Error('无效的预览页面参数');
  }
  const game = getPreviewGame(gameId);
  if (
    !game.phases.some((option) => option.id === phase) ||
    !game.viewers(phase).some((option) => option.id === viewer)
  ) {
    throw new Error('无效的预览阶段或视角');
  }
  let population = defaultPreviewPopulation;
  if (otherPlayers !== null || seatedOthers !== null) {
    if (
      otherPlayers === null ||
      seatedOthers === null ||
      !/^\d+$/.test(otherPlayers) ||
      !/^\d+$/.test(seatedOthers) ||
      !Number.isSafeInteger(Number(otherPlayers)) ||
      !Number.isSafeInteger(Number(seatedOthers)) ||
      Number(otherPlayers) >= Number.MAX_SAFE_INTEGER ||
      Number(seatedOthers) > Number(otherPlayers)
    )
      throw new Error('无效的预览人数');
    population = { otherPlayers: Number(otherPlayers), seatedOthers: Number(seatedOthers) };
  }
  return { game, phase, viewer, page, population };
}

/** Delegates the frame to the selected game's actual screens and scenario data. */
export function PreviewScreen({
  game,
  phase,
  viewer,
  page,
  population = defaultPreviewPopulation,
}: {
  readonly game: PreviewGame;
  readonly phase: string;
  readonly viewer: string;
  readonly page: PreviewPage;
  readonly population?: PreviewPopulation;
}) {
  return <game.Screen phase={phase} viewer={viewer} page={page} population={population} />;
}
