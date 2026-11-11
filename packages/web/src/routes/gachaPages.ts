/**
 * The Gacha and Shard Exchange pages share the reward previews and gacha queries, so one barrel
 * re-exports both. They ship in the start-up entry since v4 D11 removed route lazy-loading.
 * The capsule machine stays in its own PixiJS chunk.
 */
export { GachaPage } from '@/routes/gacha/GachaPage';
export { ShardExchangePage } from '@/routes/shardExchange/ShardExchangePage';
