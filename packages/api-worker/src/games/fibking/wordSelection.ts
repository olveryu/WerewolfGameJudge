/** Idempotent D1 pool selection with a deterministic local-bank fallback. */

import {
  FIB_WORD_SOURCES,
  type FibSelectWordEffect,
} from '@game-judge/game-engine/games/fibking/public';
import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import { z } from 'zod';

import { sha256Hex } from '../../platform/crypto/sha256Hex';
import type { WorkerEffectRoomIdentity } from '../../platform/gameModules/runtimeGameModule';
import type { fibRoundWordSelections } from './dbSchema';
import { FIB_WORD_SELECTION_TIERS } from './dbSchema';
import { parseFibWordCandidate } from './wordProviders/candidate';
import { LOCAL_FIB_WORD_BANK } from './wordProviders/localWordBank';
import {
  FIB_WORD_CATEGORIES,
  type FibWordCandidate,
  type FibWordCategory,
} from './wordProviders/types';

const SELECTION_HASH_HEX_LENGTH = 8;
const MAX_SELECTION_KEY = 0x7fffffff;

type FibRoundWordSelection = typeof fibRoundWordSelections.$inferSelect;
type FibWordSelectionTier = (typeof FIB_WORD_SELECTION_TIERS)[number];

interface RawSelectionRow {
  readonly room_id: FibRoundWordSelection['roomId'];
  readonly room_creation_id: FibRoundWordSelection['roomCreationId'];
  readonly effect_id: FibRoundWordSelection['effectId'];
  readonly round_id: FibRoundWordSelection['roundId'];
  readonly request_fingerprint: FibRoundWordSelection['requestFingerprint'];
  readonly word_id: FibRoundWordSelection['wordId'];
  readonly word: FibRoundWordSelection['word'];
  readonly core_meaning: FibRoundWordSelection['coreMeaning'];
  readonly usage_note: FibRoundWordSelection['usageNote'];
  readonly source: FibRoundWordSelection['source'];
  readonly selection_tier: FibRoundWordSelection['selectionTier'];
}

interface PoolWordRow {
  readonly id: string;
  readonly word: string;
  readonly core_meaning: string;
  readonly usage_note: string;
  readonly source: 'gemini' | 'local';
}

export interface SelectFibWordInput {
  readonly db: D1Database;
  readonly roomIdentity: WorkerEffectRoomIdentity;
  readonly effectId: string;
  readonly effect: FibSelectWordEffect;
  readonly participantUserIds: readonly string[];
}

export interface SelectedFibWord extends FibWordCandidate {
  readonly wordId: string | null;
  readonly selectionTier: FibWordSelectionTier;
}

const selectionRowSchema: z.ZodType<RawSelectionRow> = z.strictObject({
  room_id: z.string().min(1),
  room_creation_id: z.string().min(1),
  effect_id: z.string().min(1),
  round_id: z.string().min(1),
  request_fingerprint: z.string().length(64),
  word_id: z.string().min(1).nullable(),
  word: z.string(),
  core_meaning: z.string(),
  usage_note: z.string(),
  source: z.enum(FIB_WORD_SOURCES),
  selection_tier: z.enum(FIB_WORD_SELECTION_TIERS),
});

const poolWordRowSchema: z.ZodType<PoolWordRow> = z.strictObject({
  id: z.string().min(1),
  word: z.string(),
  core_meaning: z.string(),
  usage_note: z.string(),
  source: z.enum(FIB_WORD_SOURCES),
});

function serializeStrings(values: readonly string[]): string {
  return JSON.stringify([...new Set(values)].sort());
}

async function selectionValue(seed: string): Promise<number> {
  if (seed.length === 0) throw new Error('Fib word selection seed must be non-empty');
  const hash = await sha256Hex(seed);
  return Number.parseInt(hash.slice(0, SELECTION_HASH_HEX_LENGTH), 16) & MAX_SELECTION_KEY;
}

/** Select a category stably so retries and concurrent rooms do not share mutable random state. */
export async function selectFibWordCategory(selectionSeed: string): Promise<FibWordCategory> {
  const value = await selectionValue(selectionSeed);
  const category = FIB_WORD_CATEGORIES[value % FIB_WORD_CATEGORIES.length];
  if (category === undefined) {
    throw new Error('[FAIL-FAST] Fib word category selection produced no value');
  }
  return category;
}

async function readSelection(
  db: D1Database,
  roomId: string,
  effectId: string,
): Promise<RawSelectionRow | null> {
  const row = await db
    .prepare(
      `SELECT room_id, room_creation_id, effect_id, round_id, request_fingerprint,
        word_id, word, core_meaning, usage_note, source, selection_tier
       FROM fib_round_word_selections
       WHERE room_id = ? AND effect_id = ?`,
    )
    .bind(roomId, effectId)
    .first();
  return row === null ? null : selectionRowSchema.parse(row);
}

function parseMatchingSelection(
  row: RawSelectionRow,
  input: SelectFibWordInput,
  requestFingerprint: string,
): SelectedFibWord {
  if (
    row.room_id !== input.roomIdentity.roomId ||
    row.room_creation_id !== input.roomIdentity.creationId ||
    row.effect_id !== input.effectId ||
    row.round_id !== input.effect.payload.roundId ||
    row.request_fingerprint !== requestFingerprint
  ) {
    throw new Error(
      `[FAIL-FAST] Fib word selection identity conflict for effect ${input.effectId}`,
    );
  }
  const candidate = parseFibWordCandidate(
    {
      word: row.word,
      definition: { coreMeaning: row.core_meaning, usageNote: row.usage_note },
    },
    row.source,
    input.effect.payload.avoidWords,
  );
  return { ...candidate, wordId: row.word_id, selectionTier: row.selection_tier };
}

async function selectPoolWord(
  db: D1Database,
  category: FibWordCategory | null,
  requireUnseen: boolean,
  preferOldestExposure: boolean,
  selectionKey: number,
  avoidWords: readonly string[],
  participantUserIds: readonly string[],
): Promise<PoolWordRow | null> {
  const row = await db
    .prepare(
      `SELECT word_entry.id, word_entry.word, word_entry.core_meaning,
        word_entry.usage_note, word_entry.source
       FROM fib_words AS word_entry
       WHERE word_entry.status = 'active'
         AND (? IS NULL OR word_entry.category = ?)
         AND NOT EXISTS (
           SELECT 1 FROM json_each(?) AS avoided
           WHERE avoided.type = 'text' AND avoided.value = word_entry.word
         )
         AND (
           ? = 0 OR NOT EXISTS (
             SELECT 1
             FROM fib_word_exposures AS exposure
             INNER JOIN json_each(?) AS participant
               ON participant.type = 'text' AND participant.value = exposure.user_id
             WHERE exposure.word = word_entry.word
           )
         )
       ORDER BY
         CASE WHEN ? = 1 THEN COALESCE((
           SELECT MAX(exposure.last_seen_at)
           FROM fib_word_exposures AS exposure
           INNER JOIN json_each(?) AS participant
             ON participant.type = 'text' AND participant.value = exposure.user_id
           WHERE exposure.word = word_entry.word
         ), '') END ASC,
         CASE WHEN word_entry.selection_key >= ? THEN 0 ELSE 1 END,
         word_entry.selection_key,
         word_entry.id
       LIMIT 1`,
    )
    .bind(
      category,
      category,
      serializeStrings(avoidWords),
      requireUnseen ? 1 : 0,
      serializeStrings(participantUserIds),
      preferOldestExposure ? 1 : 0,
      serializeStrings(participantUserIds),
      selectionKey,
    )
    .first();
  return row === null ? null : poolWordRowSchema.parse(row);
}

async function findPoolSelection(
  input: SelectFibWordInput,
  category: FibWordCategory,
  key: number,
): Promise<{ readonly row: PoolWordRow; readonly tier: FibWordSelectionTier } | null> {
  const tiers = [
    { category, requireUnseen: true, preferOldest: false, tier: 'category_unseen' },
    { category: null, requireUnseen: true, preferOldest: false, tier: 'any_unseen' },
    { category, requireUnseen: false, preferOldest: true, tier: 'category_recent' },
    { category: null, requireUnseen: false, preferOldest: true, tier: 'any_active' },
  ] as const;
  for (const tier of tiers) {
    const row = await selectPoolWord(
      input.db,
      tier.category,
      tier.requireUnseen,
      tier.preferOldest,
      key,
      input.effect.payload.avoidWords,
      input.participantUserIds,
    );
    if (row !== null) return { row, tier: tier.tier };
  }
  return null;
}

async function selectLocalFallback(
  effect: FibSelectWordEffect,
  key: number,
): Promise<SelectedFibWord> {
  const eligible = LOCAL_FIB_WORD_BANK.filter(
    (candidate) => !effect.payload.avoidWords.includes(candidate.word),
  );
  const selected = eligible[key % eligible.length];
  if (selected === undefined) {
    throw new Error('[FAIL-FAST] Fib local word bank has no unused candidate');
  }
  return {
    ...parseFibWordCandidate(selected, 'local', effect.payload.avoidWords),
    wordId: null,
    selectionTier: 'local_fallback',
  };
}

async function persistSelection(
  input: SelectFibWordInput,
  requestFingerprint: string,
  selected: SelectedFibWord,
): Promise<void> {
  await input.db
    .prepare(
      `INSERT INTO fib_round_word_selections (
         room_id, room_creation_id, effect_id, round_id, request_fingerprint,
         word_id, word, core_meaning, usage_note, source, selection_tier, selected_at
       )
       SELECT room.id, room.creation_id, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
       FROM rooms AS room
       WHERE room.id = ? AND room.code = ? AND room.creation_id = ?
         AND (
           ? IS NULL OR EXISTS (
             SELECT 1 FROM fib_words
             WHERE fib_words.id = ? AND fib_words.status = 'active'
           )
         )
       ON CONFLICT (room_id, effect_id) DO NOTHING`,
    )
    .bind(
      input.effectId,
      input.effect.payload.roundId,
      requestFingerprint,
      selected.wordId,
      selected.word,
      selected.definition.coreMeaning,
      selected.definition.usageNote,
      selected.source,
      selected.selectionTier,
      new Date().toISOString(),
      input.roomIdentity.roomId,
      input.roomIdentity.roomCode,
      input.roomIdentity.creationId,
      selected.wordId,
      selected.wordId,
    )
    .run();
}

/** Return the first persisted selection for an effect, or atomically establish one. */
export async function getOrCreateFibWordSelection(
  input: SelectFibWordInput,
): Promise<SelectedFibWord> {
  const requestFingerprint = await sha256Hex(
    canonicalJson({
      roundId: input.effect.payload.roundId,
      avoidWords: input.effect.payload.avoidWords,
    }),
  );
  const existing = await readSelection(input.db, input.roomIdentity.roomId, input.effectId);
  if (existing !== null) return parseMatchingSelection(existing, input, requestFingerprint);

  const key = await selectionValue(input.effect.payload.roundId);
  const category = await selectFibWordCategory(input.effect.payload.roundId);
  const poolSelection = await findPoolSelection(input, category, key);
  const selected =
    poolSelection === null
      ? await selectLocalFallback(input.effect, key)
      : {
          ...parseFibWordCandidate(
            {
              word: poolSelection.row.word,
              definition: {
                coreMeaning: poolSelection.row.core_meaning,
                usageNote: poolSelection.row.usage_note,
              },
            },
            poolSelection.row.source,
            input.effect.payload.avoidWords,
          ),
          wordId: poolSelection.row.id,
          selectionTier: poolSelection.tier,
        };

  await persistSelection(input, requestFingerprint, selected);
  const stored = await readSelection(input.db, input.roomIdentity.roomId, input.effectId);
  if (stored === null) {
    throw new Error(
      `[FAIL-FAST] Fib word selection was not persisted for effect ${input.effectId}`,
    );
  }
  return parseMatchingSelection(stored, input, requestFingerprint);
}
