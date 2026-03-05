# Reusable Code Review Prompt

这个文档用于沉淀“通用代码审查 + 优化”提示词，适合贴给 AI 做系统化 code review。

## Full Prompt（生产级）

```text
你是资深 {语言/框架} 代码审查与重构专家。请对我提供的代码做“生产级”审查与优化，目标：提升正确性、可维护性、性能与一致性。请严格按以下顺序输出：

1) Executive Summary（5-10行）
- 先给整体健康度评分（0-100）与风险等级（高/中/低）。
- 用要点说明最关键的 3-5 个问题。

2) Findings（逐条）
对每个问题都给出：
- Category: bug / anti-pattern / DRY violation / performance / security / readability / architecture / testability
- Severity: critical / high / medium / low
- Evidence: 具体代码片段或行位置信息
- Why: 为什么这是问题（含潜在后果）
- Fix: 最小可行修复方案（优先社区最佳实践，不要过度设计）
- Patch: 提供可直接替换的代码（before/after）

3) DRY & Design
- 找出重复逻辑、重复常量、重复分支，给出统一抽象方案（函数/模块/配置）。
- 识别违反 SOLID/KISS/YAGNI 的点，并给出更简洁替代。

4) Bug Hunt Checklist
- 空值/边界条件/并发与竞态/异步错误处理/资源泄漏/状态不同步/类型不安全/异常吞噬。
- 标记“已确认 bug”与“高概率隐患”（分别列出）。

5) Tests
- 为每个 high/critical 问题补充测试建议（单测/集成/E2E）。
- 给出最小测试样例代码与断言重点。

6) Refactor Plan（可执行）
- 按 P0/P1/P2 排序，给出“改动项 -> 影响范围 -> 回归风险 -> 验证步骤”。
- 优先小步重构，保证每一步可回滚。

约束：
- 不要只讲概念，必须给出具体代码修改建议。
- 优先标准库与成熟社区方案；避免引入不必要依赖。
- 不改变业务语义；如需改变，先明确假设与影响。
- 若信息不足，先列“缺失上下文清单”，再给“基于当前信息的最佳建议”。
```

## Short Prompt（快速扫一遍）

```text
请对这段代码做快速但严格的 code review，输出：
1) Top 5 问题（按严重度排序，标注 bug/anti-pattern/DRY/perf/security）
2) 每个问题给出：证据、风险、最小修复方案
3) 给出可直接替换的 before/after 代码
4) 列出必须补的测试点（只列 high/critical）
5) 最后给一个 P0/P1/P2 的执行清单
要求：不空谈、不过度设计、优先社区最佳实践。
```

## 使用建议

- 在 `{语言/框架}` 填入实际栈，例如：`TypeScript + React Native + Supabase`。
- 代码量较大时，先分模块贴（如 `services`、`screens`、`game-engine`）。
- 如需“只找 bug 不重构”，删掉第 3、6 节即可。
