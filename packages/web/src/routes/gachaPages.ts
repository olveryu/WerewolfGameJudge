/**
 * The Gacha and Shard Exchange pages ship as one lazy chunk: they share the reward previews and
 * gacha queries, and one chunk keeps the start-up entry's preload map to one entry for both (home
 * budget). The capsule machine stays in its own PixiJS chunk.
 */
export { GachaPage } from '@/routes/gacha/GachaPage';
export { ShardExchangePage } from '@/routes/shardExchange/ShardExchangePage';
