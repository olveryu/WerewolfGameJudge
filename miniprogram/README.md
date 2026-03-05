# 微信小程序 — web-view 壳

通过微信小程序 `<web-view>` 组件全屏嵌入 `https://werewolf-judge.vercel.app`。

## 项目结构

```
miniprogram/
├── project.config.json   ← 微信开发者工具项目配置（含 AppID）
├── app.json              ← 小程序全局配置
├── app.js / app.wxss     ← 空壳入口
└── pages/index/
    ├── index.wxml        ← <web-view> 唯一页面
    ├── index.js / index.json / index.wxss
```

## 上线步骤

### 1. 配置业务域名

1. 登录 [微信公众平台](https://mp.weixin.qq.com) → 开发管理 → 开发设置 → **业务域名** → 开始配置
2. 下载校验文件（类似 `xxxxxxxx.txt`）
3. 将校验文件放到项目 `web/` 目录下
4. 提交代码 → Vercel 自动部署后，校验文件会出现在 `https://werewolf-judge.vercel.app/xxxxxxxx.txt`
5. 回到微信公众平台，添加域名 `werewolf-judge.vercel.app`，点击保存

### 2. 上传小程序代码

1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 打开开发者工具，用注册小程序的微信号扫码登录
3. 导入项目 → 目录选择本仓库的 `miniprogram/` 文件夹 → AppID 会自动读取 `project.config.json`
4. 预览确认无误后，点击右上角 **上传** → 填写版本号（如 `1.0.0`）和备注

### 3. 提交审核 & 发布

1. 回到微信公众平台 → 版本管理 → 开发版本 → **提交审核**
2. 审核通过后（通常 1-2 天） → **发布上线**

## 注意事项

- `<web-view>` 会全屏展示网页，小程序原生导航栏会覆盖在顶部
- 页面使用了 `"navigationStyle": "custom"` 隐藏默认导航栏，避免双层标题
- 网页内无法直接调用微信小程序原生 API，如需桥接需引入 JSSDK
- 业务域名校验文件已在 `scripts/build.sh` 中配置自动复制到 `dist/`
