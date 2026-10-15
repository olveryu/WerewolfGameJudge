/**
 * Room hook explicit interfaces — client contract (P-2b).
 *
 * Following the Werewolf P2-1 end state, every game's room hook
 * assembles all domain derivation in the hook and pins the result with
 * one named exported interface (paradigm: FibRoomScreenState). These
 * assertions stop the contract from silently degrading back to an
 * inferred flat bag or Screen-side derivation. One describe per batch.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

const SRC_ROOT = join(__dirname, '..');

function readSource(relativePath: string): string {
  const fullPath = join(SRC_ROOT, relativePath);
  if (!existsSync(fullPath)) throw new Error(`Expected source file to exist: ${relativePath}`);
  return readFileSync(fullPath, 'utf8');
}

/** The hook's final top-level return block must not spread sub-objects. */
function expectNoReturnSpread(hookSource: string): void {
  const returnStart = hookSource.lastIndexOf('\n  return {');
  if (returnStart < 0) throw new Error('Expected a top-level return block in the hook');
  const returnBlock = hookSource.slice(returnStart);
  expect(returnBlock).not.toMatch(/\.\.\.[a-zA-Z_[(]/);
}

describe('room hook interfaces — avalon (P-2b batch 1)', () => {
  it('the hook exports AvalonRoomScreenState and annotates its return', () => {
    const hook = readSource('games/avalon/room/hooks/useAvalonRoomState.ts');
    expect(hook).toMatch(/export interface AvalonRoomScreenState/);
    expect(hook).toMatch(/\): AvalonRoomScreenState \{/);
    expectNoReturnSpread(hook);
  });

  it('the per-viewer view model is assembled in the hook, not the Screen', () => {
    const hook = readSource('games/avalon/room/hooks/useAvalonRoomState.ts');
    expect(hook).toMatch(/getAvalonViewModel\(state, effectiveSeat\)/);
    const screen = readSource('games/avalon/room/AvalonRoomScreen.tsx');
    expect(screen).not.toMatch(/getAvalonViewModel/);
    expect(screen).toMatch(/screen\.viewModel/);
  });
});

describe('room hook interfaces — drawguess (P-2b batch 2)', () => {
  it('the hook exports DrawGuessRoomScreenState and annotates its return', () => {
    const hook = readSource('games/drawguess/room/hooks/useDrawGuessRoomState.ts');
    expect(hook).toMatch(/export interface DrawGuessRoomScreenState/);
    expect(hook).toMatch(/\): DrawGuessRoomScreenState \{/);
    expectNoReturnSpread(hook);
  });

  it('view model, stage deadline and tick are assembled in the hook, not the Screen', () => {
    const hook = readSource('games/drawguess/room/hooks/useDrawGuessRoomState.ts');
    expect(hook).toMatch(/getDrawGuessViewModel\(state, effectiveSeat, nowMs\)/);
    expect(hook).toMatch(/useStageDeadline\(\{/);
    expect(hook).toMatch(/useDrawGuessNowMs\(!isLobby\)/);
    const screen = readSource('games/drawguess/room/DrawGuessRoomScreen.tsx');
    expect(screen).not.toMatch(/getDrawGuessViewModel/);
    expect(screen).not.toMatch(/useStageDeadline/);
    expect(screen).not.toMatch(/useDrawGuessNowMs/);
    expect(screen).toMatch(/screen\.viewModel|viewModel, remainingSeconds/);
  });
});

describe('room hook interfaces — pictionary (P-2b batch 3)', () => {
  it('the hook exports PictionaryRoomScreenState and annotates its return', () => {
    const hook = readSource('games/pictionary/room/hooks/usePictionaryRoomScreenState.ts');
    expect(hook).toMatch(/export interface PictionaryRoomScreenState/);
    expect(hook).toMatch(/\): PictionaryRoomScreenState \{/);
    expectNoReturnSpread(hook);
  });

  it('the occupied seat count is assembled in the hook, not the Screen', () => {
    const hook = readSource('games/pictionary/room/hooks/usePictionaryRoomScreenState.ts');
    expect(hook).toMatch(/occupiedSeatCount: getPictionaryOccupiedSeatCount\(state\)/);
    const screen = readSource('games/pictionary/room/PictionaryRoomScreen.tsx');
    expect(screen).not.toMatch(/getPictionaryOccupiedSeatCount/);
    expect(screen).toMatch(/screen\.occupiedSeatCount/);
  });
});

describe('room hook interfaces — storyrelay (P-2b batch 4)', () => {
  it('the hook exports StoryRelayRoomScreenState and annotates its return', () => {
    const hook = readSource('games/storyrelay/room/hooks/useStoryRelayRoomState.ts');
    expect(hook).toMatch(/export interface StoryRelayRoomScreenState/);
    expect(hook).toMatch(/\): StoryRelayRoomScreenState \{/);
    expectNoReturnSpread(hook);
  });

  it('the Screen carries no derivation of its own and consumes the hook result', () => {
    const screen = readSource('games/storyrelay/room/StoryRelayRoomScreen.tsx');
    expect(screen).not.toMatch(/getStoryRelayOccupiedSeatCount/);
    expect(screen).not.toMatch(/useStageDeadline/);
    expect(screen).toMatch(/useStoryRelayRoomState\(props\)/);
  });
});

describe('room hook interfaces — undercover (P-2b batch 5)', () => {
  it('the hook exports UndercoverRoomScreenState and annotates its return', () => {
    const hook = readSource('games/undercover/room/hooks/useUndercoverRoomScreenState.ts');
    expect(hook).toMatch(/export interface UndercoverRoomScreenState/);
    expect(hook).toMatch(/\): UndercoverRoomScreenState \{/);
    expectNoReturnSpread(hook);
  });

  it('the round controls carry their own named contract', () => {
    const controls = readSource('games/undercover/room/hooks/useUndercoverRoundControls.ts');
    expect(controls).toMatch(/export interface UndercoverRoundControls/);
    expect(controls).toMatch(/\): UndercoverRoundControls \{/);
    expectNoReturnSpread(controls);
  });

  it('the reveal pool is assembled in the hook, not the Screen', () => {
    const hook = readSource('games/undercover/room/hooks/useUndercoverRoomScreenState.ts');
    expect(hook).toMatch(/getUndercoverRoleCounts\(state\.config\.numberOfPlayers/);
    const screen = readSource('games/undercover/room/UndercoverRoomScreen.tsx');
    expect(screen).not.toMatch(/getUndercoverRoleCounts/);
    expect(screen).toMatch(/revealPool/);
  });

  it('the BoardInfo role counts come from the engine counts via the hook', () => {
    const hook = readSource('games/undercover/room/hooks/useUndercoverRoomScreenState.ts');
    expect(hook).toMatch(/roleCounts = getUndercoverRoleCounts\(/);
    const screen = readSource('games/undercover/room/UndercoverRoomScreen.tsx');
    // AU-06: the Screen hands the hook's counts to the adapter factory,
    // which is where they are consumed into BoardInfo sections.
    expect(screen).toMatch(/createUndercoverBoardInfoSections\(\{[\s\S]*?roleCounts,/);
    const adapter = readSource('games/undercover/room/undercoverRoomAdapter.ts');
    expect(adapter).toMatch(/roleCounts\.undercover/);
    expect(adapter).toMatch(/roleCounts\.civilian/);
    expect(adapter).toMatch(/roleCounts\.blank/);
    expect(screen).not.toMatch(/numberOfPlayers - 1/);
  });
});

describe('stage deadline snapshot guard (AU-25/AU-47)', () => {
  // Every useStageDeadline consumer must gate expiry on the session
  // snapshot: phase ready, connection live, no command in flight, and
  // the snapshot revision still matching the rendered state. Without
  // the guard, a fast display tick re-dispatches expire until the next
  // snapshot lands (the Pictionary 250ms amplification).
  const consumers: ReadonlyArray<{ game: string; path: string }> = [
    { game: 'avalon', path: 'games/avalon/room/hooks/useAvalonRoomState.ts' },
    { game: 'drawguess', path: 'games/drawguess/room/hooks/useDrawGuessRoomState.ts' },
    { game: 'pictionary', path: 'games/pictionary/room/components/PictionaryStage.tsx' },
    { game: 'storyrelay', path: 'games/storyrelay/room/components/StoryRelayStage.tsx' },
  ];

  it.each(consumers)('$game expires through useStageDeadline', ({ path }) => {
    expect(readSource(path)).toMatch(/useStageDeadline\(\{/);
  });

  it.each(consumers)('$game shouldExpire carries the four snapshot conditions', ({ path }) => {
    const source = readSource(path);
    expect(source).toMatch(/getSnapshot\(\)/);
    expect(source).toMatch(/phase === 'ready'/);
    expect(source).toMatch(/connection === 'live'/);
    expect(source).toMatch(/pendingCommandCount === 0/);
    expect(source).toMatch(/snapshot\.state\.phaseRevision === state\.phaseRevision/);
  });
});

describe('werewolf view-model projection — AU-39', () => {
  it('the view model is assembled in useWerewolfRoom for the effective seat, not in the Screen', () => {
    const hook = readSource('games/werewolf/hooks/useWerewolfRoom.ts');
    expect(hook).toMatch(/getWerewolfViewModel\(snapshot, botControl\.effectiveSeat\)/);
    const screen = readSource('games/werewolf/room/WerewolfRoomScreen.tsx');
    expect(screen).not.toMatch(/getWerewolfViewModel/);
  });

  it('seat projections read wolf visibility from the view model, never local role rules', () => {
    const helpers = readSource('games/werewolf/room/werewolfRoom.helpers.ts');
    expect(helpers).toMatch(/viewModel\.night\.wolfVotesBySeat/);
    expect(helpers).toMatch(/isWolfPackPeer/);
    expect(helpers).not.toMatch(/canRoleSeeWolves/);
    const derived = readSource('games/werewolf/room/hooks/useRoomDerived.ts');
    expect(derived).toMatch(/buildSeatViewModels\(gameState, viewModel/);
    expect(derived).not.toMatch(/showWolves/);
  });

  it('night gating facts are read from viewModel.night by the executors', () => {
    const prompt = readSource('games/werewolf/room/executors/promptExecutor.ts');
    expect(prompt).toMatch(/viewModel\.night\.confirmStatus/);
    expect(prompt).not.toMatch(/gameState\.confirmStatus/);
    const groupConfirm = readSource('games/werewolf/room/executors/groupConfirmExecutor.ts');
    expect(groupConfirm).toMatch(/viewModel\.night\.reveals/);
    const playerContext = readSource('games/werewolf/components/AIChatBubble/playerContext.ts');
    expect(playerContext).toMatch(/viewModel\.myRole/);
    expect(playerContext).not.toMatch(/state\.players\[/);
  });

  /**
   * Regression scan: production sources under games/werewolf must not read
   * the raw night facts the projection owns. The projection is the single
   * place where confirm status, per-family ack arrays and reveal facts are
   * cropped per viewer; a client-side re-read reintroduces both the leak
   * surface and the duplicated schema→ack mappings AU-39 removed.
   *
   * Registered exceptions (review when adding one — new games/files may not
   * cite these as precedent):
   * - room/NightReview.helpers.ts reads the reveal FACTS
   *   (hypnotizedSeats / convertedSeat / loverSeats /
   *   seedWolfInfectionResult) to rebuild the post-game night recap from the
   *   final state. The recap is a historical record shown after the game
   *   ends, not a per-viewer live cropping decision.
   */
  const PROJECTION_FACT_EXCEPTIONS: Readonly<Record<string, readonly RegExp[]>> = {
    'games/werewolf/room/NightReview.helpers.ts': [
      /hypnotizedSeats|convertedSeat|loverSeats|seedWolfInfectionResult/,
    ],
  };

  const BANNED_PROJECTION_READS: readonly { pattern: RegExp; label: string }[] = [
    { pattern: /(gameState|state)\??\.confirmStatus/, label: 'raw confirmStatus read' },
    {
      pattern:
        /conversionRevealAcks|seedWolfInfectionRevealAcks|cupidLoversRevealAcks|piperRevealAcks/,
      label: 'per-family reveal ack array read',
    },
    {
      pattern: /hypnotizedSeats|convertedSeat|loverSeats|seedWolfInfectionResult/,
      label: 'raw reveal fact read',
    },
  ];

  function walkProductionSources(dir: string): string[] {
    const entries: string[] = [];
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name !== '__tests__') entries.push(...walkProductionSources(full));
      } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        entries.push(full);
      }
    }
    return entries;
  }

  it('no production source re-reads the raw facts the view model projects', () => {
    const root = join(SRC_ROOT, 'games/werewolf');
    const violations: string[] = [];
    for (const fullPath of walkProductionSources(root)) {
      const relativePath = fullPath
        .slice(SRC_ROOT.length + 1)
        .split('\\')
        .join('/');
      const source = readFileSync(fullPath, 'utf8');
      const exceptions = PROJECTION_FACT_EXCEPTIONS[relativePath] ?? [];
      for (const { pattern, label } of BANNED_PROJECTION_READS) {
        if (exceptions.some((exception) => exception.source === pattern.source)) continue;
        if (pattern.test(source)) violations.push(`${relativePath}: ${label}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
