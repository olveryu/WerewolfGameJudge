# 隐私说明 / Privacy Notice

**生效日期 / Effective date:** 2026-08-31

## 中文

本说明适用于 Werewolf Game Judge（狼人杀电子法官）的官方部署，包括
[werewolfgamer.com](https://werewolfgamer.com)、官方移动应用和微信小程序。第三方分支、修改版及自行部署的实例由各自运营者负责，并不受本说明约束。

本项目不出售个人信息，也不使用个人信息投放定向广告。为提供账号、联机游戏、AI、错误监控、邮件和反馈功能，应用会处理下述数据，并使用本说明列出的外部服务。

### 1. 我们处理的数据

| 类别           | 数据示例                                                                                                                                   | 用途                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| 账号与认证     | 用户 ID、邮箱、密码哈希、昵称、微信 OpenID、会话令牌、账号创建和更新时间、最近访问的国家/地区代码及 Cloudflare 数据中心代码                | 注册、登录、找回密码、微信登录、会话安全和账号管理 |
| 个人资料与成长 | 头像及自定义头像、外观配置、XP、等级、对局数、抽奖券、碎片、已解锁物品和奖励时间                                                           | 展示个人资料、保存成长进度并发放游戏奖励           |
| 房间与游戏     | 房间 ID 和房间码、参与者、玩家昵称及头像、板子配置、游戏状态、操作、结算结果和连接事件                                                     | 创建和加入房间、同步实时状态、恢复连接并结算游戏   |
| 用户提供的内容 | 自定义头像、临时分享图片、AI 对话、反馈及追问                                                                                              | 提供用户主动选择的上传、AI、分享和支持功能         |
| 诊断与使用数据 | 请求方法和路由标签、状态码、耗时、浏览器或设备信息、资源 URL 和加载性能、国家/地区、Cloudflare 数据中心、网络运营商/ASN、AI 模型和调用状态 | 诊断故障、监控可用性、分析性能、限制滥用并改善服务 |

密码以 PBKDF2-SHA256 哈希形式保存；刷新令牌、登录限流邮箱和密码重置验证码也只在服务端保存哈希或不可逆摘要。请勿在昵称、AI 对话、反馈、笔记或图片中填写不必要的敏感个人信息。

### 2. 设备本地存储

应用通过 MMKV（Web 端使用浏览器站点存储）在设备上保存认证令牌、用户 ID、登录状态、设置、最近房间、待恢复的房间命令和创建请求、AI 气泡位置等运行数据。狼人杀笔记和每个用户/房间最近最多 50 条 AI 对话也保存在本地。

这些数据不会因为退出账号而保证全部删除。可通过应用内相应清除操作、清除浏览器站点数据或卸载应用删除本地数据。设备本地存储的保护程度取决于操作系统、浏览器和设备安全设置。

### 3. AI 功能

狼人杀 AI 助手会把当前请求中的对话消息发送给 Google Gemini API，并把生成结果返回给客户端。应用后端不会把提示词或回答写入 D1、Durable Objects 或 R2；它只记录用户 ID、模型、国家/地区、成功或失败状态和耗时等调用指标。客户端会按上一节所述在本地保存对话。

Google 对 Gemini API 输入和输出的处理取决于部署所用项目是否启用付费服务。根据当前
[Gemini API 条款](https://ai.google.dev/gemini-api/terms)，付费服务不会使用提示词和回答改进 Google 产品，但会为安全和合规目的短期记录；非付费服务可能使用输入和输出改进产品，并可能由人工审核。请不要向 AI 功能提交敏感、机密或可识别个人的信息。

Gemini API 的当前条款要求用户年满 18 岁。未满 18 岁的用户不得使用本应用的 AI 功能。AI 输出可能不准确，不应作为医疗、法律、财务或其他专业建议。

### 4. 错误监控和会话回放

生产环境使用 Sentry 收集客户端和 Worker 的错误、堆栈、性能追踪、结构化日志、设备/浏览器信息、IP 推断信息和用户 ID。配置允许 Sentry 接收默认 PII，并采样 20% 的性能追踪、10% 的普通会话回放以及发生错误的全部会话回放。

回放配置会遮盖 Web 端文字和输入内容；移动端会遮盖文字和图片。遮盖并不代表回放不含任何个人信息，交互、页面结构、URL、时间、设备和网络元数据仍可能被处理。

### 5. 反馈会公开同步到 GitHub

通过应用提交的反馈会同时保存到 D1，并在公开仓库
[olveryu/WerewolfGameJudge](https://github.com/olveryu/WerewolfGameJudge) 创建 GitHub Issue。Issue 包含反馈内容、用户 ID、昵称、最近国家/地区和 Cloudflare 数据中心代码、应用版本；后续追问会成为公开 Issue 评论。关闭反馈只会关闭 Issue，不会删除其内容。

**不要在反馈中提交邮箱、密码、令牌、房间秘密或其他不希望公开的信息。** GitHub 上公开的内容可能被搜索引擎、缓存、通知邮件或第三方副本保留。需要移除反馈时，请通过本说明的联系邮箱提出请求，不要另开公开 Issue 提交隐私资料。

### 6. 外部服务

| 服务                                                                                               | 处理内容                                                                                           | 说明                                                                   |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [Cloudflare](https://www.cloudflare.com/privacypolicy/)                                            | 网络请求、IP 和路由信息；Workers、Pages、D1、Durable Objects、R2、日志及 Analytics Engine 中的数据 | 托管应用、API、实时房间、数据库、对象存储、安全与遥测                  |
| [Google Gemini](https://policies.google.com/privacy)                                               | AI 提示词、上下文、生成结果和调用元数据                                                            | 生成 AI 回答及游戏所需的候选词；数据处理还受 Gemini API 条款约束       |
| [Sentry](https://sentry.io/privacy/)                                                               | 错误、日志、性能、会话回放、用户 ID、设备和网络元数据                                              | 故障诊断、发布健康和性能监控                                           |
| [Resend](https://resend.com/legal/privacy-policy)                                                  | 收件邮箱、邮件主题、密码重置验证码和邮件正文、投递元数据                                           | 发送密码重置邮件                                                       |
| [WeChat / Tencent](https://www.wechat.com/en/privacy_policy.html)                                  | 微信临时登录 code 及由微信返回的 OpenID                                                            | 微信小程序登录和账号绑定                                               |
| [GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) | 反馈 Issue、评论及随反馈发布的账号和地区元数据                                                     | 公开问题跟踪和双向反馈                                                 |
| [npmmirror](https://npmmirror.com/)                                                                | Web 静态资源请求及标准网络元数据                                                                   | 从 `cdn.npmmirror.com` 分发版本化的 JavaScript、字体、音频和 WASM 资源 |

这些服务可能在用户所在国家或地区以外处理数据，并按照各自的条款、隐私说明和法律义务保留数据。

### 7. 保留时间

以下时间来自当前应用实现或服务商公开规则。定时清理和分布式删除可能不会在阈值到达的瞬间完成。

| 数据                                       | 当前规则                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| 房间目录、参与者和 Durable Object 游戏状态 | 创建满 24 小时后进入每日过期清理，并通过删除协调流程移除；房主也可提前删除房间                                            |
| 临时分享图片                               | R2 配置为 1 天生命周期；删除前拥有随机 URL 的人可以访问                                                                   |
| 匿名账号                                   | 连续 14 天未更新且不拥有房间后，进入每日清理                                                                              |
| 访问令牌                                   | 1 小时后失效                                                                                                              |
| 刷新令牌                                   | 每次签发或轮换后 90 天失效；过期令牌族进入每日清理                                                                        |
| 密码重置验证码                             | 15 分钟后不可使用；记录不会据此承诺在 15 分钟时立即删除                                                                   |
| 微信临时登录 claim                         | 可兑换 2 分钟，兑换时删除；超过 5 分钟的未兑换记录会被维护任务选中清理                                                    |
| 登录限流记录                               | 超过 1 小时后进入每日清理                                                                                                 |
| 抽奖幂等记录                               | 超过 24 小时后进入每日清理                                                                                                |
| Analytics Engine 遥测                      | Cloudflare 当前提供 3 个月保留期                                                                                          |
| 本地数据                                   | 保留到应用主动覆盖/清除、用户清除站点数据或卸载应用；AI 对话限制为每个用户/房间最多 50 条，但没有按时间自动过期           |
| 注册账号、资料、成长数据、自定义头像和反馈 | 当前没有统一的自动删除期限；在提供服务所需期间保留，或在核实删除请求后按适用法律、第三方平台能力及必要的安全/法律例外处理 |

Sentry、Gemini、Resend、GitHub、Cloudflare 日志和 npmmirror 的服务商侧数据按各服务商当前配置、条款和法律义务保留，本项目代码无法保证它们在某个固定日期完成删除。

### 8. 数据共享与公开范围

- 房间状态通过 Cloudflare Worker 和 WebSocket 同步给同一房间中的客户端。玩家昵称、头像和游戏信息会按应用界面展示给房间成员。
- 分享图片使用可公开访问的随机 URL。请只分享你有权上传的内容。
- 除本说明列出的服务提供、用户主动公开、依法响应请求或保护服务安全所必需的情形外，本项目不会向其他方出售或出租个人信息。

### 9. 安全

应用使用 HTTPS/WSS、服务端鉴权、密码及令牌哈希、输入校验和访问控制等措施。任何网络传输和存储系统都无法保证绝对安全。发现安全漏洞时，请按
[SECURITY.md](SECURITY.md) 私下报告，不要公开披露令牌、个人信息或可利用细节。

### 10. 你的选择与权利

你可以选择不使用 AI、反馈、自定义头像、临时图片分享、邮箱登录或微信登录等可选功能。根据所在地法律，你可能有权请求访问、更正、导出、限制处理或删除个人信息。

当前应用没有自助删除账号入口。需要提出隐私请求时，请发送邮件至
[olveryu@gmail.com](mailto:olveryu@gmail.com)，并提供足以核实账号的用户 ID 或注册邮箱；不要发送密码或令牌。第三方平台上的公开副本、法定留存和安全记录可能无法立即或完整删除。

### 11. 未成年人

请勿让未成年人独自提交个人信息。未满 18 岁的用户不得使用 Gemini AI 功能。监护人认为未成年人提交了个人信息时，可以通过上述邮箱联系我们核查和处理。

### 12. 变更

数据处理方式发生实质变化时，本说明会更新生效日期，并通过仓库或应用中的适当方式提示。建议定期查看本文件。

<a id="english"></a>

## English

This notice applies to the official deployment of Werewolf Game Judge, including
[werewolfgamer.com](https://werewolfgamer.com), the official mobile apps, and the WeChat Mini Program. Third-party forks, modified builds, and self-hosted instances are operated independently and are not covered by this notice.

The project does not sell personal data or use it for targeted advertising. The app processes the data below and relies on the listed external services to provide accounts, multiplayer games, AI, error monitoring, email, and feedback.

### 1. Data We Process

| Category                   | Examples                                                                                                                                                                                          | Purpose                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Account and authentication | User ID, email, password hash, display name, WeChat OpenID, session tokens, account timestamps, last country code, and Cloudflare data-center code                                                | Registration, sign-in, password recovery, WeChat sign-in, session security, and account management           |
| Profile and progression    | Avatars and custom avatars, appearance settings, XP, level, games played, draw tickets, shards, unlocked items, and reward timestamps                                                             | Displaying profiles, preserving progression, and issuing game rewards                                        |
| Rooms and games            | Room ID and code, participants, player names and avatars, board configuration, game state, actions, results, and connection events                                                                | Creating and joining rooms, real-time synchronization, reconnection, and settlement                          |
| Content you provide        | Custom avatars, temporary share images, AI conversations, feedback, and follow-up messages                                                                                                        | Optional upload, AI, sharing, and support features                                                           |
| Diagnostics and usage      | Request method and route label, status, duration, browser or device details, resource URLs and load performance, country, Cloudflare data center, network provider/ASN, AI model, and call status | Diagnosing faults, monitoring availability, measuring performance, limiting abuse, and improving the service |

Passwords are stored as PBKDF2-SHA256 hashes. Refresh tokens, login-rate-limit emails, and password-reset codes are also stored server-side only as hashes or irreversible digests. Do not place unnecessary sensitive personal data in a display name, AI chat, feedback, note, or image.

### 2. On-Device Storage

The app uses MMKV, backed by browser site storage on the Web, to store authentication tokens, user ID, sign-in state, settings, recent rooms, recoverable room commands and creation requests, AI bubble position, and other operating data. Werewolf notes and up to the latest 50 AI messages for each user and room are also stored locally.

Signing out does not guarantee removal of every local item. Local data can be removed through the relevant in-app clear action, by clearing browser site data, or by uninstalling the app. Its protection depends on the operating system, browser, and device security settings.

### 3. AI Features

The Werewolf AI assistant sends the conversation messages in the current request to the Google Gemini API and returns the generated result to the client. The app backend does not write prompts or responses to D1, Durable Objects, or R2. It records only call metrics such as user ID, model, country, success or failure, and duration. The client stores conversations locally as described above.

Google's handling of Gemini API input and output depends on whether the deployment's Cloud project uses paid services. Under the current
[Gemini API terms](https://ai.google.dev/gemini-api/terms), paid services do not use prompts and responses to improve Google products, but log them for a limited period for safety and compliance. Unpaid services may use input and output to improve products and may involve human review. Do not submit sensitive, confidential, or personally identifying information to the AI feature.

The current Gemini API terms require users to be at least 18. Users under 18 must not use this app's AI feature. AI output may be inaccurate and is not medical, legal, financial, or other professional advice.

### 4. Error Monitoring and Session Replay

Production uses Sentry to collect client and Worker errors, stack traces, performance traces, structured logs, device/browser information, IP-derived information, and user IDs. The configuration allows default PII and samples 20% of performance traces, 10% of ordinary session replays, and all sessions in which an error occurs.

Replay configuration masks text and inputs on the Web; mobile replay masks text and images. Masking does not mean a replay contains no personal data: interactions, page structure, URLs, timestamps, device details, and network metadata may still be processed.

### 5. Feedback Is Published to GitHub

Feedback submitted in the app is stored in D1 and also creates a GitHub Issue in the public
[olveryu/WerewolfGameJudge](https://github.com/olveryu/WerewolfGameJudge) repository. The issue contains the feedback, user ID, display name, last country and Cloudflare data-center codes, and app version. Follow-up messages become public issue comments. Resolving feedback closes the issue but does not delete its content.

**Do not submit email addresses, passwords, tokens, room secrets, or anything else you do not want to make public.** Public GitHub content may remain in search indexes, caches, notification emails, or third-party copies. To request removal, use the contact email below rather than opening another public issue with private details.

### 6. External Services

| Service                                                                                            | Data processed                                                                                                     | Role                                                                                                   |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| [Cloudflare](https://www.cloudflare.com/privacypolicy/)                                            | Network requests, IP and routing data; data in Workers, Pages, D1, Durable Objects, R2, logs, and Analytics Engine | App and API hosting, real-time rooms, databases, object storage, security, and telemetry               |
| [Google Gemini](https://policies.google.com/privacy)                                               | AI prompts, context, generated output, and call metadata                                                           | AI responses and candidate words used by the game; processing is also governed by the Gemini API terms |
| [Sentry](https://sentry.io/privacy/)                                                               | Errors, logs, performance, session replay, user ID, device details, and network metadata                           | Fault diagnosis, release health, and performance monitoring                                            |
| [Resend](https://resend.com/legal/privacy-policy)                                                  | Recipient email, subject, password-reset code and message body, and delivery metadata                              | Password-reset email delivery                                                                          |
| [WeChat / Tencent](https://www.wechat.com/en/privacy_policy.html)                                  | Temporary WeChat login code and the OpenID returned by WeChat                                                      | Mini Program sign-in and account linking                                                               |
| [GitHub](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) | Feedback issues, comments, and the account and regional metadata published with feedback                           | Public issue tracking and two-way feedback                                                             |
| [npmmirror](https://npmmirror.com/)                                                                | Web asset requests and standard network metadata                                                                   | Delivery of versioned JavaScript, fonts, audio, and WASM from `cdn.npmmirror.com`                      |

These services may process data outside your country or region and retain it under their own terms, privacy notices, and legal obligations.

### 7. Retention

The periods below come from the current implementation or published provider rules. Scheduled cleanup and distributed deletion may not finish at the exact moment a threshold is reached.

| Data                                                                     | Current rule                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Room directory, participants, and Durable Object game state              | Enters daily expiry cleanup 24 hours after creation and is removed through the deletion coordinator; a host can delete a room earlier                                                                                                                         |
| Temporary share images                                                   | R2 is configured with a one-day lifecycle; anyone with the random URL can access the image until deletion                                                                                                                                                     |
| Anonymous accounts                                                       | Enter daily cleanup after 14 days without an update when they own no room                                                                                                                                                                                     |
| Access tokens                                                            | Expire after one hour                                                                                                                                                                                                                                         |
| Refresh tokens                                                           | Expire 90 days after each issue or rotation; expired token families enter daily cleanup                                                                                                                                                                       |
| Password-reset codes                                                     | Become unusable after 15 minutes; this does not promise deletion of the record at the 15-minute mark                                                                                                                                                          |
| Temporary WeChat login claims                                            | Redeemable for two minutes and deleted on redemption; unredeemed records older than five minutes are selected by maintenance cleanup                                                                                                                          |
| Login-rate-limit records                                                 | Enter daily cleanup after one hour                                                                                                                                                                                                                            |
| Gacha idempotency records                                                | Enter daily cleanup after 24 hours                                                                                                                                                                                                                            |
| Analytics Engine telemetry                                               | Cloudflare currently provides three months of retention                                                                                                                                                                                                       |
| Local data                                                               | Remains until overwritten or cleared by the app, browser site data is cleared, or the app is uninstalled; AI history is limited to 50 messages per user and room but has no time-based expiry                                                                 |
| Registered accounts, profiles, progression, custom avatars, and feedback | No single automatic deletion period is currently defined; retained while needed to provide the service, or handled after a verified deletion request subject to applicable law, third-party platform capabilities, and necessary security or legal exceptions |

Provider-side data in Sentry, Gemini, Resend, GitHub, Cloudflare logs, and npmmirror is retained under each provider's current configuration, terms, and legal obligations. The project code cannot guarantee deletion by a fixed provider-side date.

### 8. Sharing and Public Visibility

- Room state is synchronized through Cloudflare Workers and WebSockets to clients in the same room. Player names, avatars, and game information are displayed to room members as the app's interface permits.
- Share images use a publicly accessible random URL. Upload only content you have the right to share.
- Except for service delivery described here, content you intentionally make public, lawful requests, or protection of the service, the project does not sell or rent personal data.

### 9. Security

The app uses HTTPS/WSS, server-side authentication, password and token hashing, input validation, and access controls. No network transmission or storage system can be guaranteed completely secure. Report vulnerabilities privately under
[SECURITY.md](SECURITY.md); do not publicly disclose tokens, personal data, or exploitable details.

### 10. Your Choices and Rights

You may choose not to use optional AI, feedback, custom-avatar, temporary image-sharing, email sign-in, or WeChat sign-in features. Depending on your location, you may have rights to request access, correction, export, restriction, or deletion of personal data.

The app does not currently offer self-service account deletion. Send privacy requests to
[olveryu@gmail.com](mailto:olveryu@gmail.com) with the user ID or registered email needed to verify the account; never send a password or token. Public copies on third-party platforms, legally required records, and security records may not be removable immediately or completely.

### 11. Children

Do not allow a child to submit personal data without supervision. Users under 18 must not use the Gemini AI feature. A parent or guardian who believes a child submitted personal data can contact the address above for review and appropriate action.

### 12. Changes

When data practices change materially, this notice will receive a new effective date and an appropriate notice in the repository or app. Review this file periodically.
