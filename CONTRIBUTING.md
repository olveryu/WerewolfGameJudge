# Contributing to WerewolfGameJudge

感谢你对本项目的关注！欢迎任何形式的贡献。

## Getting Started

1. Fork 本仓库
2. Clone 到本地：`git clone https://github.com/<your-username>/WerewolfGameJudge.git`
3. 安装依赖：`pnpm install`
4. 创建分支：`git checkout -b feat/your-feature`

## Development

```bash
pnpm run dev           # 启动 Cloudflare Worker + Expo Web 开发服务器（推荐）
pnpm run web           # 仅启动 Expo Web
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

## Windows 开发者注意事项

- 换行符（EOL）和 Git：Windows 与 Unix 风格的换行符不同，若你在 Windows 上工作且看到大量“未更改但被修改”的文件，通常是 EOL 导致。仓库已添加 `.gitattributes` 来统一处理文本文件（将在仓库内保存为 LF），本地 Git 会根据 `core.autocrlf` 将其转换为适合本机的格式。

- 常见处理步骤（当看到大量文件被标记为修改时）：

```bash
# 在确保无未提交重要更改的前提下运行：
git add --renormalize .
git commit -m "chore: normalize line endings"
```

- Husky 钩子在不同平台上的注意事项：
  - 有些钩子可能包含平台专属的 `source` 路径（例如 macOS 上的 `/opt/homebrew/opt/asdf/libexec/asdf.sh`），这会在 Windows 上导致钩子失败并阻止 commit/push。
  - 解决办法（优先选项）：在钩子脚本中加入存在性检查来优雅降级，例如：

```sh
if [ -f /opt/homebrew/opt/asdf/libexec/asdf.sh ]; then
	. /opt/homebrew/opt/asdf/libexec/asdf.sh
fi
```

    - 临时绕过（不推荐长期使用）：在本地需要快速提交时可使用 `--no-verify` 跳过钩子，例如 `git commit --no-verify` 或 `git push --no-verify` ——但这会跳过 lint / 测试钩子，请谨慎使用。

- 开发环境建议：
  - 保持 `pnpm install` 后的钩子依赖（`husky`, `lint-staged`, `commitlint`）可用。
  - 如果你在 Windows 上开发，建议设置 `git config --global core.autocrlf true`（如习惯 CRLF），并遵循仓库的 `.gitattributes`。

如需我为你的本地环境执行 EOL 规范化或帮你修改本地钩子脚本以兼容 Windows，我可以代劳。
