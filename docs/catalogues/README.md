# 玩家流程清单

这里是统一查阅入口。生成文件留在各自测试旁，不复制到文档目录；历史变化由 Git 保存。

<!-- catalogue-index:start -->

| 游戏与流程     | 当前清单                                                                                                       | 检查 ID              |
| -------------- | -------------------------------------------------------------------------------------------------------------- | -------------------- |
| 狼人杀首夜     | [清单](../../packages/game-engine/src/games/werewolf/__tests__/boards/__snapshots__/night-steps.catalogue.txt) | `werewolf-night`     |
| 狼人杀警长竞选 | [清单](../../packages/web/src/games/werewolf/room/day/__tests__/__snapshots__/sheriff-election.catalogue.txt)  | `werewolf-sheriff`   |
| 阿瓦隆夜晚     | [清单](../../packages/game-engine/src/games/avalon/__tests__/__snapshots__/night-steps.catalogue.txt)          | `avalon-night`       |
| 秘密希特勒首夜 | [清单](../../packages/game-engine/src/games/secrethitler/__tests__/__snapshots__/night-steps.catalogue.txt)    | `secrethitler-night` |

<!-- catalogue-index:end -->

## 修改流程

1. 在对应设计文档记录已确认的规则和文案；设计决定不是生成清单，生成结果也不是自动认可的规则。
2. 修改拥有规则的源码；新增条件同时增加通过正式命令打出的场景，不直接编辑生成清单。
3. 运行相关清单测试，或 `corepack pnpm run catalogue:check [检查 ID...]`。不指定 ID 时检查全部登记的清单。
4. 查看仓库根目录 `.catalogue-reports/<检查 ID>/`：
   - `candidate.txt`：本次执行产生的完整清单。
   - `baseline.txt`：当前基准；缺失时明确报告，不把第一次生成当成批准。
   - `difference.diff`：完整逐行差异。
   - `result.json`：检查状态、来源和报告位置。
5. 逐行报告差异；预期变更由用户确认，意外差异先查原因。确认后在本地运行：

   ```sh
   corepack pnpm run catalogue:update --reviewed werewolf-night
   ```

   只更新明确列出的 ID；CI 禁止更新。普通测试的 `-u` 不会更新这些基准。

6. 再运行相关行为测试和清单检查，与源码一起提交。Git 记录改前、改后；设计文档记录修改原因。

运行失败的包不会阻止命令尝试其他包的清单。测试在生成之前失败时，报告明确标成“未生成”，不是成功或空清单。
每次 PR 的 `catalogues` CI 检查上传完整报告，并进入 `ci-gate`；不自动改基准或提交。
本地普通清单测试同样生成候选和差异，不要求必须经过专用命令。

## 覆盖边界

清单来源是正式命令跑出的场景，不是手拼界面、浏览器截图或规范本身。
没被场景触发的条件仍可能遗漏；步骤覆盖和文案可达性检查不能穷举所有规则组合。
新增场景须覆盖批准规则引入的动作、不可用原因、视角、特殊条件和推进边界。
现有清单仍需按原设计流程审核；引入报告工具不代表重新批准了其中的全部文字。

## 生成器约定与已确认决定

2026-11-25 用户确认：

- 自动生成差异，确认后更新基准；历史保存在 Git，不按日期复制整份清单。
- 文档只提供统一入口，生成文件仍归各自测试。
- 本地相关测试和每次 PR 的 CI 都报告差异；不得自动覆盖基准。
- 未来 `night=narrated` 新游戏自动接共享步骤机制、正式对局清单和验收，不另设步骤开关。
- `night=none` 且 `guidedNarration=none` 不生成播报；其他阶段播报只在设计明确需要时声明，不给现有六个游戏加音频或迁移步骤。
- 空场景、示例步骤和未完成玩法不能冒充正式清单或上线验收。

设计记录和规则批准保留在游戏设计文档；集成报告必须列清单覆盖、差异审核和验证证据。
