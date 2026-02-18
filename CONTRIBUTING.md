# Contributing to WerewolfGameJudge

感谢你对本项目的关注！欢迎任何形式的贡献。

## Getting Started

1. Fork 本仓库
2. Clone 到本地：`git clone https://github.com/<your-username>/WerewolfGameJudge.git`
3. 安装依赖：`pnpm install`
4. 创建分支：`git checkout -b feat/your-feature`

## Development

```bash
pnpm run web          # 启动 Web 开发服务器
pnpm run quality      # 一键跑 typecheck + lint + format + test
pnpm exec tsc --noEmit        # 类型检查
pnpm run lint                  # ESLint
pnpm exec jest --no-coverage --forceExit  # 单元/集成测试
```

## Commit Convention

本项目使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <description>
```

| Type       | 用途     |
| ---------- | -------- |
| `feat`     | 新功能   |
| `fix`      | Bug 修复 |
| `refactor` | 重构     |
| `test`     | 测试     |
| `docs`     | 文档     |
| `chore`    | 杂务     |

commit message 会被 `commitlint` 自动校验。

## Pull Request

1. 确保 `pnpm run quality` 全部通过
2. PR 标题遵循 Conventional Commits 格式
3. 简要描述变更内容和动机

## 测试门禁 | Test Gates

提交前请确认以下约束：

- 所有 board UI tests 禁止 `.skip`（All board UI tests forbid `.skip`）
- `assertCoverage([...])` 必须使用字面量数组（Must use literal arrays）
- Contract tests 强制 schema/resolver/nightStep 三层对齐（Enforce alignment）
- Night-1-only 红线检测：禁止跨夜状态（No cross-night state）

## Reporting Issues

请使用 GitHub Issues，选择对应模板（Bug Report / Feature Request）。

## License

贡献的代码将遵循本项目的 [MIT License](LICENSE)。
