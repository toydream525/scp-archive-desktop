<div align="center">

<img src="build/icon.png" alt="SCP Archive Logo" width="92" height="92" />

# SCP Archive

**开源的 SCP 基金会维基 PC 桌面端阅读客户端（中英双站支持）**

<p>
  <a href="./README.md">English</a> &nbsp;|&nbsp; <strong>简体中文</strong>
</p>

<p>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/%E4%BB%A3%E7%A0%81%E5%8D%8F%E8%AE%AE-MIT-blue.svg?style=flat-square" alt="代码协议: MIT" /></a>
  <a href="./LICENSE-SCP-CC-BY-SA-3.0.md"><img src="https://img.shields.io/badge/SCP%20%E5%86%85%E5%AE%B9-CC%20BY--SA%203.0-b81d24.svg?style=flat-square" alt="SCP 内容协议: CC BY-SA 3.0" /></a>
  <img src="https://img.shields.io/badge/%E5%B9%B3%E5%8F%B0-Windows%20x64-0078d4.svg?style=flat-square" alt="平台: Windows x64" />
  <img src="https://img.shields.io/badge/%E6%A1%86%E6%9E%B6-Electron%2035-47848f.svg?style=flat-square" alt="Electron 35" />
  <img src="https://img.shields.io/badge/%E5%A4%9A%E8%AF%AD%E8%A8%80-EN%20%7C%20%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-2ea043.svg?style=flat-square" alt="多语言" />
  <a href="https://yuriaqua.com/scp-archive/"><img src="https://img.shields.io/badge/%E5%AE%98%E7%BD%91-yuriaqua.com-5b6cf9.svg?style=flat-square" alt="项目官网" /></a>
</p>

<p>
  <a href="https://yuriaqua.com/scp-archive/"><strong>🌐 项目官网</strong></a> &nbsp;·&nbsp;
  <a href="#-%E6%A0%B8%E5%BF%83%E5%8A%9F%E8%83%BD">核心功能</a> &nbsp;·&nbsp;
  <a href="#-%E5%BF%AB%E9%80%9F%E5%BC%80%E5%A7%8B">快速开始</a> &nbsp;·&nbsp;
  <a href="#-%E5%BF%AB%E6%8D%B7%E9%94%AE%E9%80%9F%E6%9F%A5">快捷键</a> &nbsp;·&nbsp;
  <a href="#-%E5%A4%9A%E8%AF%AD%E8%A8%80%E4%B8%8E%E5%88%86%E9%83%A8%E6%89%A9%E5%B1%95">扩展新语种</a> &nbsp;·&nbsp;
  <a href="#-%E5%BC%80%E6%BA%90%E4%B8%8E-scp-%E5%8D%8F%E8%AE%AE%E5%A3%B0%E6%98%8E">协议与署名 (MIT + CC BY-SA 3.0)</a>
</p>

</div>

---

## ✨ 项目简介

**SCP Archive** 是一款专为 PC 桌面端打造的 **SCP 基金会维基** 开源阅读客户端，将流畅的**纯净离线阅读器**与高还原度的**原版 Wikidot 网页模式**融为一体，让你摆脱浏览器多标签混乱、排版刺眼与断网无法翻阅的痛点。

> [!NOTE]
> 本项目为社区开发的**开源第三方客户端**，与 SCP 基金会管理团队及 Wikidot 官方无从属关系。代码仓库**不内置或二次分发**任何 SCP 文档正文与受限图片；所有文档均在用户浏览时从 SCP 官网（或用户自定义镜像）实时获取，并严格遵循 **CC BY-SA 3.0** 协议。

---

## 🚀 核心功能

| 模块 | 功能亮点 |
| :--- | :--- |
| **中英文双站 & 一键对照** | 内置 **SCP 中文分部（`scp-wiki-cn.wikidot.com`）** 与 **英文主站（`scp-wiki.wikidot.com`）**，看单篇文档时可一键 `CN ⇄ EN` 对照切换（`Ctrl+点击` 在新标签打开）。 |
| **纯净 / 原版双阅读模式** | **纯净阅读模式**（秒开、离线优先、原生暗黑/护眼主题、右侧自动 TOC 大纲、折叠块/YUI 标签页/脚注交互）；**原版网页模式**（内置独立 `<webview>` 100% 还原 Wikidot 复杂 CSS 版式、ACS 分级栏与 JS 互动组件）。 |
| **阅读体验增强** | 三套精细配色主题（**暗黑 / 护眼纸色 / 明亮**）、字号/行距/正文版宽实时调节、一键全展开/全收起折叠块（`Ctrl+Shift+E`）、页内查找（`Ctrl+F`，命中隐藏在折叠块中的内容时自动展开）。 |
| **多标签页工作台** | 桌面端独立多标签栏，每个标签独立保留滚动状态与前进/后退栈，支持中键关闭、`Ctrl+点击`/中键后台新标签打开关联文档。 |
| **导航、搜索与随机探索** | 顶部智能直达栏（输入 `173`、`CN-001`、`scp-049-j`、网址直达或输入关键词搜索）；覆盖主系列 I–X 与 CN 原创系列 I–IV 目录及实时筛选；接入 [Crom GraphQL API](https://crom.avn.sh/) 实现全站检索、标签筛选、高分/最新榜与分类随机抽取。 |
| **收藏、历史与进度记忆** | 自定义收藏分组与阅读备注、时间线阅读历史、自动记录每篇文档滚动进度并在下次打开时恢复。 |
| **离线图文缓存与导出** | 支持阅读自动/手动缓存、**按系列分批次批量离线下载**（每批 20/50/100/200 篇、断点续传跳过已缓存、可选同步下图片）、**文章图片本地化**（`scp-cache://` 断网看图）；一键导出为 **Markdown (`.md`)** 或 **单文件 HTML (`.html`，图片内嵌)** 并保留 CC BY-SA 3.0 署名。 |
| **统一 Wikidot 账号登录** | 通过共享持久化 Session 打开官方 Wikidot 登录窗口，**一次登录即可在主站、中分及所有 Wikidot 分部通用**（客户端绝不接触或明文保存密码），原版模式下可直接评分与参与讨论。 |
| **网络代理与自定义镜像** | 全局支持 **跟随系统代理 / 直连 / 自定义 HTTP & SOCKS5 代理**（同时接管正文抓取、原版网页、登录窗口与图片缓存），支持自定义镜像源并提供一键连通性与延迟测速。 |
| **可扩展多语言与分部** | 客户端界面支持 **简体中文 / English** 实时热切换，采用插件式语言包与分部注册架构，方便后续接入**日文分部（`ja-JP` / `scp-jp`）** 等更多语种。 |

---

## 📦 快速开始

### 方式一：直接下载 Windows 便携版 `.exe`
前往 [**项目官网介绍页（yuriaqua.com/scp-archive）**](https://yuriaqua.com/scp-archive/) 或直接从 [**Releases**](https://github.com/toydream525/scp-archive-desktop/releases/latest) 下载最新的单文件绿色便携版 **`SCP Archive.exe`**，双击即可运行，无需安装。

### 方式二：从源码运行或自行打包

**环境要求：** Node.js 20+（已在 Node 24 实测通过）及 npm。

```powershell
# 1. 克隆仓库
git clone https://github.com/toydream525/scp-archive-desktop.git
cd scp-archive-desktop

# 2. 安装依赖
npm install

# 3. 本地开发模式启动
npm start

# 4. 打包独立 Windows 便携版 .exe
npm run build:exe
```

> **Windows PowerShell 提示：** 若系统脚本执行策略限制了 `npm.ps1`，直接使用 `npm.cmd install`、`npm.cmd start` 与 `npm.cmd run build:exe` 即可。

---

## ⌨️ 快捷键速查

| 快捷键 | 功能 | 快捷键 | 功能 |
| :--- | :--- | :--- | :--- |
| `Ctrl + L` | 聚焦顶部编号直达 / 搜索栏 | `Ctrl + F` | 页内查找（命中折叠块自动展开） |
| `Ctrl + T` | 新建探索首页标签页 | `Ctrl + Shift + E` | 一键展开 / 收起所有折叠块 |
| `Ctrl + W` | 关闭当前标签页 | `Ctrl + D` | 收藏 / 编辑当前文档收藏 |
| `Ctrl + Tab` | 切换下个标签页（`+Shift` 上个） | `Ctrl + B` | 展开 / 收起左侧边栏 |
| `Alt + ← / →` | 标签页内后退 / 前进 | `Ctrl + + / - / 0` | 放大 / 缩小 / 重置阅读字号 |

---

## 🌍 多语言与分部扩展

项目预留了清晰的语言包与分部站点注册接口，后续新增**日文（`ja-JP` / `scp-jp`）**、**韩文（`ko-KR` / `scp-ko`）** 等分部无需改动核心逻辑：

<details>
<summary><strong>1. 新增客户端界面语言（以日文 <code>ja-JP</code> 为例）</strong></summary>

1. 参照 [`src/renderer/js/i18n/en-US.js`](src/renderer/js/i18n/en-US.js) 的键值结构，新建 `src/renderer/js/i18n/ja-JP.js`。
2. 在 [`src/renderer/js/i18n/index.js`](src/renderer/js/i18n/index.js) 中导入并注册：

```js
import jaJP from './ja-JP.js';
registerLocale('ja-JP', { label: '日本語', shortLabel: 'JA', langAttr: 'ja' }, jaJP);
```

注册后，设置面板的「客户端显示语言」下拉框会自动出现新语言并支持热切换。

</details>

<details>
<summary><strong>2. 新增 SCP 维基分部（以日文分部 <code>scp-jp</code> 为例）</strong></summary>

在 [`src/shared/branches.js`](src/shared/branches.js) 中调用 `registerBranch(...)`：

```js
registerBranch({
  id: 'jp',
  code: 'JP',
  names: { 'zh-CN': '日文分部', 'en-US': 'Japanese (JP)', 'ja-JP': '日本支部' },
  defaultBaseUrl: 'https://scp-jp.wikidot.com',
  cromBaseUrl: 'http://scp-jp.wikidot.com',
  hostMatchers: ['scp-jp.wikidot.com'],
  hasOriginalSeries: true,
  tagMap: { scp: ['scp'], original: ['scp', 'jp'], tale: ['tale'], safe: ['scp', 'safe'], euclid: ['scp', 'euclid'], keter: ['scp', 'keter'], thaumiel: ['scp', 'thaumiel'], joke: ['joke'] },
  quickTags: [ /* ... */ ],
  series: [ /* ... */ ]
});
```

顶部分部切换、系列目录、Crom 搜索、随机抽取与离线缓存均会自动适配新分部。

</details>

---

## 🗂️ 目录结构

```text
scp-wiki-client/
├── build/                          # 应用图标（基于 SCP 徽标衍生，遵循 CC BY-SA 3.0）
├── src/
│   ├── shared/
│   │   └── branches.js             # 可扩展 SCP 分部与系列目录注册表
│   ├── main/
│   │   ├── main.js                 # Electron 主进程、IPC、代理与 scp-cache:// 离线协议
│   │   ├── auth-service.js         # Wikidot 统一账号登录窗口与严格登录态检测
│   │   ├── scp-service.js          # Wikidot 抓取解析、目录解析与 Crom GraphQL 接口
│   │   ├── cache-service.js        # 离线文档与图片本地化缓存服务
│   │   ├── export-service.js       # Markdown / 单文件 HTML 导出（附带 CC BY-SA 3.0 声明）
│   │   ├── store.js                # 设置、收藏夹、历史记录与阅读进度持久化存储
│   │   ├── preload.js              # 安全的渲染进程上下文桥接
│   │   └── webview-preload.js      # 原版网页模式阅读增强脚本
│   └── renderer/
│       ├── index.html              # 多标签桌面端主界面
│       ├── styles/                 # 暗黑 / 护眼 / 明亮主题与纯净阅读器排版样式
│       └── js/
│           ├── i18n/               # 可扩展多语言引擎（zh-CN、en-US）
│           ├── app.js              # 标签管理、智能直达栏与快捷键
│           ├── reader-view.js      # 纯净阅读器与原版 WebView 控制器
│           ├── sidebar.js          # 目录、搜索、收藏、历史与离线库侧边栏
│           ├── home-view.js        # 探索首页
│           └── dialogs.js          # 账号、阅读外观、导出与设置弹窗
├── LICENSE                         # MIT 开源协议（客户端源码）
├── LICENSE-SCP-CC-BY-SA-3.0.md     # SCP 基金会 CC BY-SA 3.0 协议与署名声明
├── README.md                       # 英文文档（默认）
└── README.zh-CN.md                 # 简体中文文档
```

---

## 📜 开源与 SCP 协议声明

本项目为**开源软件**，并严格遵循 [**SCP 基金会中文分部授权指南**](https://scp-wiki-cn.wikidot.com/licensing-guide) 与 [**英文主站 Licensing Guide**](https://scp-wiki.wikidot.com/licensing-guide)：

- **客户端程序代码 — [MIT 开源协议](./LICENSE)**
  本仓库中由开发者原创编写的客户端程序代码依据 MIT 协议开源。
- **SCP 基金会内容与衍生素材 — [CC BY-SA 3.0 协议](./LICENSE-SCP-CC-BY-SA-3.0.md)**
  与 SCP 基金会相关的一切内容——包括基于 SCP 基金会标志衍生的应用图标（`build/icon.png`、`build/icon.ico` 及界面 SVG 徽标）以及经由本客户端浏览、缓存或导出的全部维基条目——均遵循 **[知识共享 署名-相同方式共享 3.0 未本地化版本协议（CC BY-SA 3.0）](https://creativecommons.org/licenses/by-sa/3.0/deed.zh)**，源自 [SCP 基金会英文主站](https://scp-wiki.wikidot.com/)、[SCP 基金会中文分部](https://scp-wiki-cn.wikidot.com/) 及其各位原作者。
- **第三方社区接口致谢**
  全站搜索、标签探索与随机条目功能由 SCP 社区维护的 [Crom API](https://crom.avn.sh/) 提供支持。

<div align="center">
  <sub>献给所有热爱 SCP 基金会的读者 · 控制，收容，保护。</sub>
</div>
