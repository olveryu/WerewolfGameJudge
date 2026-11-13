import type { GameStatsSettlement } from './settleGameRewards';
import { createGameStatsStatement } from './settlementLedger';

/** The owner supplies a fixed mapping between public field names and SQL columns. */
export function countGameStats<T extends { readonly userId: string }>(
  facts: readonly T[],
  table: string,
  increments: (fact: T) => Readonly<Record<string, number>>,
): GameStatsSettlement<T> {
  return {
    facts,
    createStatement: (db, settlementId, fact) =>
      createGameStatsStatement(db, settlementId, fact.userId, table, {}, increments(fact)),
  };
}

export function roleGameStats<
  T extends { readonly userId: string; readonly role: string; readonly won: boolean },
>(facts: readonly T[], table: string): GameStatsSettlement<T> {
  return {
    facts,
    createStatement: (db, settlementId, fact) =>
      createGameStatsStatement(
        db,
        settlementId,
        fact.userId,
        table,
        { role: fact.role },
        {
          games_played: 1,
          wins: fact.won ? 1 : 0,
        },
      ),
  };
}

export async function readCountGameStats(
  db: D1Database,
  userId: string,
  table: string,
  columns: Readonly<Record<string, string>>,
): Promise<Record<string, unknown>> {
  const projection = Object.entries(columns).map(([field, column]) => `${column} AS ${field}`);
  const row = await db
    .prepare(`SELECT ${projection.join(', ')} FROM ${table} WHERE user_id = ?1`)
    .bind(userId)
    .first<Record<string, unknown>>();
  return row ?? Object.fromEntries(Object.keys(columns).map((field) => [field, 0]));
}

export async function readRoleGameStats(db: D1Database, userId: string, table: string) {
  const result = await db
    .prepare(
      `SELECT role, games_played AS gamesPlayed, wins FROM ${table} WHERE user_id = ?1 ORDER BY role`,
    )
    .bind(userId)
    .all<{ role: string; gamesPlayed: number; wins: number }>();
  return {
    gamesPlayed: result.results.reduce((sum, role) => sum + role.gamesPlayed, 0),
    roles: result.results,
  };
}
