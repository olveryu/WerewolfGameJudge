# AI Instruction 维护 SOP

> 一页纸流程：确保 `.github/instructions/*.md` 和项目文档不过期。

## 触发条件 → 必须更新的文件

| 变更类型              | 影响的 instruction / 文档         | 具体更新项                                                                                                                 |
| --------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **加新角色**          | `new-role.instructions.md`        | §参考角色索引表、§C2 `CurrentNightResults` 字段列表、`TargetConstraint` 枚举（如有新值）、`ResolverResult.result` 字段列表 |
|                       | `README.md`                       | 角色总数、阵营分组表                                                                                                       |
|                       | `NIGHT1_ROLE_ALIGNMENT_MATRIX.md` | NIGHT_STEPS 表、行为对齐节、UX-only 限制表、三层对齐表、日期、测试统计                                                     |
| **改 UI 组件/弹窗**   | `screens.instructions.md`         | §Overlay/Modal 表格、§底部按钮映射、§⋯菜单项                                                                               |
| **改 GameState 字段** | `services.instructions.md`        | §状态管理 Anti-drift                                                                                                       |
|                       | `game-engine.instructions.md`     | §normalizeState 提醒                                                                                                       |
| **改 Schema Kind**    | `new-role.instructions.md`        | §C4 Schema Kinds 列表、§步骤2 模板                                                                                         |
|                       | `screens.instructions.md`         | §Schema Kind→交互模式表                                                                                                    |
| **改 theme token**    | `screens.instructions.md`         | §Theme Token 规则                                                                                                          |
| **改测试规范**        | `tests.instructions.md`           | 对应规则                                                                                                                   |
| **加预设模板**        | `README.md`                       | Board UI Tests 行数                                                                                                        |

## 验证手段

1. **合约测试**（自动）：`pnpm run quality` 会通过 `specs.contract.test.ts` 检查 ROLE_SPECS/NIGHT_STEPS/RESOLVERS 对齐，新角色遗漏会在 CI 报错。
2. **硬编码数字对照**：instruction 中的计数（如"36 roles"、"27 steps"、"27 resolvers"）来源于合约测试中的断言值（`specs.contract.test.ts` → `toHaveLength(N)`）。两者必须同步更新。
3. **手动 checklist**（每次发版前/季度）：按上表检查最近变更是否遗漏了文档更新。

## 减少硬编码

instruction 中的计数旁标注来源，方便未来维护者定位：

```markdown
<!-- 派生自 specs.contract.test.ts: expect(getAllRoleIds()).toHaveLength(N) -->

当前为 36，新增角色后改为 37
```

不必将计数改为动态生成——instruction 是静态 markdown，合约测试已覆盖一致性。关键是更新时知道去哪里改。

## 历史文档管理

已完成的迁移/重构方案：顶部加 `> ⚠️ 历史文档 — 仅供参考，不反映当前代码状态` 标记。不删除。
