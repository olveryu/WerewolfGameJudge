import { expect } from '@playwright/test';

import {
  type DecryptoCode,
  type DecryptoRoomPage,
  type DecryptoTeam,
} from '../pages/DecryptoRoomPage';

const teams = ['blue', 'purple'] as const;
export type DecryptoTeams = Readonly<Record<DecryptoTeam, readonly number[]>>;

/** Set up independent real seats and capture only the rendered team assignments. */
export async function setupDecryptoGame(
  rooms: readonly DecryptoRoomPage[],
  mode: 'fixed' | 'rotating',
): Promise<DecryptoTeams> {
  const host = rooms[0];
  if (host === undefined) throw new Error('Decrypto requires a host');
  await host.createGame(rooms.length, mode);
  await host.seatAt(0);
  const roomCode = await host.getRoomCode();
  await Promise.all(
    rooms.slice(1).map(async (room, index) => {
      await room.joinViaCode(roomCode);
      await room.seatAt(index + 1);
    }),
  );
  for (let seat = 0; seat < rooms.length; seat++) await host.expectSeatOccupied(seat);
  await host.startGame();
  const members = {
    blue: await host.members('blue', rooms.length),
    purple: await host.members('purple', rooms.length),
  };
  expect([...members.blue, ...members.purple].sort((first, second) => first - second)).toEqual(
    Array.from({ length: rooms.length }, (_, seat) => seat),
  );
  for (const team of teams) {
    expect(members[team].length).toBeGreaterThanOrEqual(2);
    if (mode === 'fixed') await host.chooseEncryptor(team, members[team][0]!);
  }
  await host.confirmTeams();
  return members;
}

function wrongCode(code: DecryptoCode): DecryptoCode {
  const unused = [1, 2, 3, 4].find((number) => !code.includes(number));
  if (unused === undefined) throw new Error('A code must leave one unused digit');
  return [unused, code[1], code[2]];
}

function playerAtSeat(
  rooms: readonly DecryptoRoomPage[],
  seat: number,
  context: string,
): DecryptoRoomPage {
  const player = rooms[seat];
  if (player === undefined)
    throw new Error(`${context}: no independent player context for seat ${seat + 1}`);
  return player;
}

/** Play one real round without early settlement: correct decoding, incorrect interception. */
export async function playDecryptoRound(
  rooms: readonly DecryptoRoomPage[],
  members: DecryptoTeams,
  round: number,
) {
  const host = playerAtSeat(rooms, 0, `Round ${round} host`);
  await Promise.all(rooms.map((room) => room.expectRound(round)));
  const encryptors = { blue: await host.encryptor('blue'), purple: await host.encryptor('purple') };
  for (const team of teams)
    if (!members[team].includes(encryptors[team]))
      throw new Error(
        `Round ${round} ${team}: encryptor seat ${encryptors[team] + 1} is not a team member`,
      );
  const encryptorPlayers = {
    blue: playerAtSeat(rooms, encryptors.blue, `Round ${round} blue encryptor`),
    purple: playerAtSeat(rooms, encryptors.purple, `Round ${round} purple encryptor`),
  };
  const words = {
    blue: await encryptorPlayers.blue.keywords(),
    purple: await encryptorPlayers.purple.keywords(),
  };
  expect(new Set([...words.blue, ...words.purple]).size).toBe(8);
  const codes = {
    blue: await encryptorPlayers.blue.password(),
    purple: await encryptorPlayers.purple.password(),
  };
  await Promise.all(
    teams.flatMap((team) =>
      members[team].map((seat) =>
        playerAtSeat(rooms, seat, `Round ${round} ${team} private view`).expectPrivateView(
          words[team],
          seat === encryptors[team],
        ),
      ),
    ),
  );
  await Promise.all(teams.map((team) => encryptorPlayers[team].submitClues(team, round)));
  await Promise.all(rooms.map((room) => room.expectRound(round, '解码与拦截')));
  function decoderFor(team: DecryptoTeam): DecryptoRoomPage {
    const seat = members[team].find((candidate) => candidate !== encryptors[team]);
    if (seat === undefined)
      throw new Error(
        `Round ${round} ${team}: no decoder distinct from encryptor seat ${encryptors[team] + 1}`,
      );
    return playerAtSeat(rooms, seat, `Round ${round} ${team} decoder`);
  }
  const decoders = { blue: decoderFor('blue'), purple: decoderFor('purple') };
  if (round === 1)
    await Promise.all(
      teams.map((team) =>
        decoders[team].expectNoFirstRoundIntercept(team === 'blue' ? 'purple' : 'blue'),
      ),
    );
  await Promise.all(
    teams.map(async (team) => {
      const decoder = decoders[team];
      await decoder.submitGuess(team, 'decode', codes[team]);
      if (round > 1) {
        const opponent = team === 'blue' ? 'purple' : 'blue';
        await decoder.submitGuess(opponent, 'intercept', wrongCode(codes[opponent]));
      }
    }),
  );
  if (round < 8) {
    await Promise.all(rooms.map((room) => room.expectRound(round, '本轮完成', 20_000)));
    await Promise.all(
      rooms.map(async (room) => {
        for (const team of teams) await room.expectPublicCode(team, codes[team]);
      }),
    );
  }
  return { encryptors, words };
}
