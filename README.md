<div align="center">

<img src="build/icon.png" alt="SCP Archive Logo" width="92" height="92" />

# SCP Archive

**An open-source PC desktop reader for the SCP Foundation Wiki (EN & CN dual-branch)**

<p>
  <strong>English</strong> &nbsp;|&nbsp; <a href="./README.zh-CN.md">简体中文</a>
</p>

<p>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/Code%20License-MIT-blue.svg?style=flat-square" alt="Code License: MIT" /></a>
  <a href="./LICENSE-SCP-CC-BY-SA-3.0.md"><img src="https://img.shields.io/badge/SCP%20Content-CC%20BY--SA%203.0-b81d24.svg?style=flat-square" alt="SCP Content: CC BY-SA 3.0" /></a>
  <img src="https://img.shields.io/badge/Platform-Windows%20x64-0078d4.svg?style=flat-square" alt="Platform: Windows" />
  <img src="https://img.shields.io/badge/Built%20with-Electron%2035-47848f.svg?style=flat-square" alt="Built with Electron" />
  <img src="https://img.shields.io/badge/i18n-EN%20%7C%20%E7%AE%80%E4%BD%93%E4%B8%AD%E6%96%87-2ea043.svg?style=flat-square" alt="i18n" />
  <a href="https://yuriaqua.com/scp-archive/"><img src="https://img.shields.io/badge/Website-yuriaqua.com-5b6cf9.svg?style=flat-square" alt="Website" /></a>
</p>

<p>
  <a href="https://yuriaqua.com/scp-archive/"><strong>🌐 Project Site</strong></a> &nbsp;·&nbsp;
  <a href="#-features">Features</a> &nbsp;·&nbsp;
  <a href="#-quick-start">Quick Start</a> &nbsp;·&nbsp;
  <a href="#-keyboard-shortcuts">Shortcuts</a> &nbsp;·&nbsp;
  <a href="#-extensible-i18n--branches">Extensibility</a> &nbsp;·&nbsp;
  <a href="#-licensing--scp-compliance">Licensing (MIT + CC BY-SA 3.0)</a>
</p>

</div>

---

## ✨ Highlights

**SCP Archive** brings the full reading experience of the **SCP Foundation Wiki** into a fast, distraction-free Windows desktop client—combining a clean offline-ready reader with a full-fidelity native Wikidot WebView mode for complex CSS themes and interactive entries.

> [!NOTE]
> This is an **open-source, community-built third-party client**. It is not affiliated with the SCP Foundation staff or Wikidot. No SCP articles or restricted media are bundled in this repository; all wiki content is fetched live from the official sites (or a user-configured mirror) under **CC BY-SA 3.0**.

---

## 🚀 Features

| Category | Capabilities |
| :--- | :--- |
| **Dual-Branch & Cross-Read** | Built-in **English Main Site (`scp-wiki.wikidot.com`)** and **Chinese Branch (`scp-wiki-cn.wikidot.com`)** with one-click `CN ⇄ EN` article switching (`Ctrl+Click` opens in a new tab). |
| **Dual Reading Modes** | **Clean Reader Mode** (blazing fast, offline-first, native themes, automatic TOC outline, working collapsibles/YUI tabs/footnotes) & **Original WebView Mode** (100% native Wikidot CSS themes, ACS bars, JS iframes & interactive puzzles). |
| **Reading Enhancements** | Three native themes (**Dark / Sepia / Light**), live font size, line height & content width controls, one-click expand/collapse all collapsibles (`Ctrl+Shift+E`), and in-page find (`Ctrl+F`, auto-unfolds hidden matches). |
| **Multi-Tab Workspace** | Desktop tab bar with independent scroll state per tab, middle-click close, `Ctrl+Click` / middle-click background opening, and per-tab Back/Forward history. |
| **Discovery & Navigation** | Smart omnibox (`173`, `CN-001`, `scp-049-j`, full URL, or keyword search), full Series I–X & CN I–IV catalogs with instant filtering, [Crom GraphQL](https://crom.avn.sh/) search, tag explorer, top-rated/latest feeds, and category-based random SCP picker. |
| **Bookmarks & Progress** | Custom bookmark folders & notes, chronological reading history, and automatic scroll-position restore when reopening articles. |
| **Offline Cache & Export** | Auto/manual local caching, **chunked batch offline downloading by series** (20/50/100/200 per batch with resume & optional images), **inline image localization** (`scp-cache://`), and one-click export to **Markdown (`.md`)** or **Standalone HTML (`.html`, embedded images)** with CC BY-SA 3.0 attribution preserved. |
| **Unified Wikidot Login** | Official Wikidot sign-in window via a shared persistent session—sign in once and share auth state across **EN, CN, and all Wikidot branches** (passwords are never touched or stored locally). |
| **Network Proxy & Mirrors** | Global **System / Direct / Custom HTTP & SOCKS5 proxy** support applied uniformly to fetching, WebView, login, and image caching, plus custom mirror URLs and built-in connectivity/latency testing. |
| **Extensible i18n & Branches** | Live hot-switching between **English** and **Simplified Chinese**, with pluggable registries ready for **Japanese (`ja-JP` / `scp-jp`)** and other branches. |

---

## 📦 Quick Start

### Option 1: Download Prebuilt Windows `.exe`
Visit the [**Official Project Page (yuriaqua.com/scp-archive)**](https://yuriaqua.com/scp-archive/) or download the latest standalone portable **`SCP Archive.exe`** directly from [**Releases**](https://github.com/toydream525/scp-archive-desktop/releases/latest) and double-click to run—no installation required.

### Option 2: Run or Build from Source

**Prerequisites:** Node.js 20+ (tested on Node 24) & npm.

```powershell
# 1. Clone the repository
git clone https://github.com/toydream525/scp-archive-desktop.git
cd scp-archive-desktop

# 2. Install dependencies
npm install

# 3. Launch in development mode
npm start

# 4. Build standalone portable Windows .exe
npm run build:exe
```

> **Windows PowerShell tip:** If execution policy restricts `npm.ps1`, run `npm.cmd install`, `npm.cmd start`, and `npm.cmd run build:exe`.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action | Shortcut | Action |
| :--- | :--- | :--- | :--- |
| `Ctrl + L` | Focus Quick Jump / Search Omnibox | `Ctrl + F` | In-Page Find (auto-unfolds matches) |
| `Ctrl + T` | New Explore Tab | `Ctrl + Shift + E` | Expand / Collapse All Collapsibles |
| `Ctrl + W` | Close Active Tab | `Ctrl + D` | Bookmark / Edit Current Article |
| `Ctrl + Tab` | Next Tab (`+Shift` for Previous) | `Ctrl + B` | Toggle Left Sidebar |
| `Alt + ← / →` | Tab Back / Forward | `Ctrl + + / - / 0` | Increase / Decrease / Reset Font Size |

---

## 🌍 Extensible i18n & Branches

Designed from the ground up so contributors can add **Japanese (`ja-JP` / `scp-jp`)**, **Korean (`ko-KR` / `scp-ko`)**, **French**, or any other SCP branch cleanly without rewriting core logic.

<details>
<summary><strong>1. Add a new UI language (e.g., Japanese <code>ja-JP</code>)</strong></summary>

1. Create `src/renderer/js/i18n/ja-JP.js` following the key structure of [`src/renderer/js/i18n/en-US.js`](src/renderer/js/i18n/en-US.js).
2. Register it in [`src/renderer/js/i18n/index.js`](src/renderer/js/i18n/index.js):

```js
import jaJP from './ja-JP.js';
registerLocale('ja-JP', { label: '日本語', shortLabel: 'JA', langAttr: 'ja' }, jaJP);
```

The new language appears automatically in **Settings → Display Language** with instant live switching.

</details>

<details>
<summary><strong>2. Add a new SCP Wiki branch (e.g., Japanese Branch <code>scp-jp</code>)</strong></summary>

Register a branch descriptor in [`src/shared/branches.js`](src/shared/branches.js):

```js
registerBranch({
  id: 'jp',
  code: 'JP',
  names: { 'en-US': 'Japanese (JP)', 'zh-CN': '日文分部', 'ja-JP': '日本支部' },
  defaultBaseUrl: 'https://scp-jp.wikidot.com',
  cromBaseUrl: 'http://scp-jp.wikidot.com',
  hostMatchers: ['scp-jp.wikidot.com'],
  hasOriginalSeries: true,
  tagMap: { scp: ['scp'], original: ['scp', 'jp'], tale: ['tale'], safe: ['scp', 'safe'], euclid: ['scp', 'euclid'], keter: ['scp', 'keter'], thaumiel: ['scp', 'thaumiel'], joke: ['joke'] },
  quickTags: [ /* ... */ ],
  series: [ /* ... */ ]
});
```

Branch switching, catalogs, Crom search, random selection, and offline caching adapt automatically.

</details>

---

## 🗂️ Project Structure

```text
scp-wiki-client/
├── build/                          # Application icons (CC BY-SA 3.0 SCP emblem derivative)
├── src/
│   ├── shared/
│   │   └── branches.js             # Pluggable SCP branch & series registry (CN, EN, extensible)
│   ├── main/
│   │   ├── main.js                 # Electron lifecycle, IPC handlers, proxy & scp-cache:// protocol
│   │   ├── auth-service.js         # Unified Wikidot login window & strict session detection
│   │   ├── scp-service.js          # Wikidot fetcher/parser, series catalog & Crom GraphQL client
│   │   ├── cache-service.js        # Offline HTML + image asset localizer
│   │   ├── export-service.js       # Markdown & standalone HTML exporter (with CC BY-SA 3.0 footer)
│   │   ├── store.js                # Persistent settings, bookmarks, history & reading progress
│   │   ├── preload.js              # Context-isolated renderer bridge
│   │   └── webview-preload.js      # Original Mode CSS/theme/collapsible/scroll enhancer
│   └── renderer/
│       ├── index.html              # Multi-tab desktop shell
│       ├── styles/                 # Dark / Sepia / Light themes & Clean Reader typography
│       └── js/
│           ├── i18n/               # Extensible localization engine (zh-CN, en-US)
│           ├── app.js              # Tabs, omnibox, navigation & shortcuts
│           ├── reader-view.js      # Clean Reader & Original WebView controller
│           ├── sidebar.js          # Catalog, Search, Bookmarks, History & Offline Library
│           ├── home-view.js        # Explore dashboard
│           └── dialogs.js          # Account, Appearance, Export & Settings dialogs
├── LICENSE                         # MIT License (client source code)
├── LICENSE-SCP-CC-BY-SA-3.0.md     # SCP Foundation CC BY-SA 3.0 compliance & attribution
├── README.md                       # English documentation (default)
└── README.zh-CN.md                 # Simplified Chinese documentation
```

---

## 📜 Licensing & SCP Compliance

This project is **Open Source** and strictly complies with the [**SCP Foundation Licensing Guide**](https://scp-wiki.wikidot.com/licensing-guide):

- **Client Source Code — [MIT License](./LICENSE)**
  All original desktop client code in this repository is open-source under the MIT License.
- **SCP Foundation Content & Assets — [CC BY-SA 3.0](./LICENSE-SCP-CC-BY-SA-3.0.md)**
  Content relating to the SCP Foundation, including the SCP Foundation logo / emblem derivatives (`build/icon.png`, `build/icon.ico`, and UI emblem SVGs) and all articles retrieved, cached, or exported through this application, is licensed under **[Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)](https://creativecommons.org/licenses/by-sa/3.0/)**, originating from [scp-wiki.wikidot.com](https://scp-wiki.wikidot.com/) and [scp-wiki-cn.wikidot.com](https://scp-wiki-cn.wikidot.com/) and their respective authors.
- **Third-Party Services**
  Search, tag discovery, and random entry queries are powered by the community-maintained [Crom API](https://crom.avn.sh/).

<div align="center">
  <sub>Made with ❤️ for the SCP Foundation reading community · Secure, Contain, Protect.</sub>
</div>
