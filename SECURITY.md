# Security Policy

## Supported Versions

| Version  | Supported          |
| -------- | ------------------ |
| Latest   | :white_check_mark: |
| < Latest | :x:                |

本项目只维护最新版本。

## Reporting a Vulnerability

如果你发现安全漏洞，请 **不要** 在公开 Issue 中报告。

请发送邮件至 **olveryu@gmail.com**，包含：

- 漏洞描述
- 复现步骤
- 影响范围

我会在 48 小时内回复确认，并在修复后公开披露。

## Scope

本项目是一个 React Native (Expo) 跨平台应用，使用 Cloudflare Workers + Durable Objects + D1 作为后端。

安全相关的关注点：

- Cloudflare Workers 认证与授权（JWT）
- 客户端认证流程
- API Handler 的输入校验（Zod）
- 密码哈希存储（PBKDF2-SHA256）
- 依赖项中的已知漏洞（通过 Renovate 自动监控）
