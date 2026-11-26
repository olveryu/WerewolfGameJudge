/** 聚会工具账号自有的 D1 表：已保存身份方案。 */

import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { users } from '../../features/account/dbSchema';

/**
 * 账号保存的身份方案。`name` 与 `normalized_name` 都是规范化（去首尾空白、
 * NFC）后的名称；同名判断只用 `normalized_name`，区分大小写。
 * `(owner_user_id, normalized_name)` 唯一索引同时承担按账号列表的查询。
 */
export const toolboxIdentityPresets = sqliteTable(
  'toolbox_identity_presets',
  {
    id: text('id').primaryKey(),
    ownerUserId: text('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    configJson: text('config_json').notNull(),
    version: integer('version').notNull(),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_toolbox_identity_presets_owner_name').on(
      table.ownerUserId,
      table.normalizedName,
    ),
  ],
);
