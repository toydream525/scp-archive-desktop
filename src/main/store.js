const fs = require('fs');
const path = require('path');
const { getBranch } = require('../shared/branches');

const DEFAULT_SETTINGS = {
  uiLocale: 'zh-CN', // Extensible locale code: 'zh-CN' | 'en-US' | future 'ja-JP' ...
  site: 'cn', // Branch id from src/shared/branches.js
  customBaseUrls: {}, // { cn: 'https://...', en: 'https://...', jp: 'https://...' }
  cnBaseUrl: 'https://scp-wiki-cn.wikidot.com',
  enBaseUrl: 'https://scp-wiki.wikidot.com',
  cromApiUrl: 'https://api.crom.avn.sh/graphql',
  proxyMode: 'system', // 'system' | 'direct' | 'custom'
  proxyRules: '',
  proxyBypassRules: '<local>',
  theme: 'dark', // 'light' | 'sepia' | 'dark'
  readingMode: 'clean', // 'clean' | 'original'
  fontSize: 16,
  lineHeight: 1.75,
  contentWidth: 820,
  autoCacheOnRead: true,
  cacheImages: true,
  autoRestoreProgress: true,
  showToc: true,
  originalSimplifyChrome: true
};

class AppStore {
  constructor(userDataDir) {
    this.dir = path.join(userDataDir, 'data');
    fs.mkdirSync(this.dir, { recursive: true });
    this.settingsPath = path.join(this.dir, 'settings.json');
    this.bookmarksPath = path.join(this.dir, 'bookmarks.json');
    this.historyPath = path.join(this.dir, 'history.json');
    this.progressPath = path.join(this.dir, 'progress.json');
    this.seriesCacheDir = path.join(this.dir, 'series-cache');
    fs.mkdirSync(this.seriesCacheDir, { recursive: true });

    const saved = this._readJson(this.settingsPath, {});
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...saved,
      customBaseUrls: { ...(saved.customBaseUrls || {}) }
    };
    this.bookmarks = this._readJson(this.bookmarksPath, []);
    this.history = this._readJson(this.historyPath, []);
    this.progress = this._readJson(this.progressPath, {});
  }

  _readJson(filePath, fallback) {
    try {
      if (!fs.existsSync(filePath)) return fallback;
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch {
      return fallback;
    }
  }

  _writeJson(filePath, data) {
    const tmp = `${filePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, filePath);
  }

  getSettings() {
    return {
      ...this.settings,
      customBaseUrls: { ...(this.settings.customBaseUrls || {}) }
    };
  }

  updateSettings(patch = {}) {
    const nextCustom = {
      ...(this.settings.customBaseUrls || {}),
      ...(patch.customBaseUrls || {})
    };
    if (patch.cnBaseUrl !== undefined) nextCustom.cn = patch.cnBaseUrl;
    if (patch.enBaseUrl !== undefined) nextCustom.en = patch.enBaseUrl;

    this.settings = {
      ...this.settings,
      ...patch,
      customBaseUrls: nextCustom
    };
    this._writeJson(this.settingsPath, this.settings);
    return this.getSettings();
  }

  getBaseUrl(siteId) {
    const branch = getBranch(siteId || this.settings.site);
    const customMap = this.settings.customBaseUrls || {};
    const legacy = branch.id === 'cn' ? this.settings.cnBaseUrl : branch.id === 'en' ? this.settings.enBaseUrl : '';
    const raw = (customMap[branch.id] || legacy || branch.defaultBaseUrl || '').trim();
    return (raw || branch.defaultBaseUrl).replace(/\/+$/, '');
  }

  // Bookmarks
  getBookmarks() {
    return [...this.bookmarks];
  }

  upsertBookmark(item) {
    const key = `${item.site}:${item.slug}`;
    const idx = this.bookmarks.findIndex((b) => `${b.site}:${b.slug}` === key);
    const entry = {
      site: item.site,
      slug: item.slug,
      title: item.title || item.slug,
      subtitle: item.subtitle || '',
      rating: item.rating ?? null,
      tags: Array.isArray(item.tags) ? item.tags : [],
      folder: item.folder || '默认收藏',
      note: item.note || '',
      addedAt: idx >= 0 ? this.bookmarks[idx].addedAt : Date.now(),
      updatedAt: Date.now()
    };
    if (idx >= 0) {
      this.bookmarks[idx] = entry;
    } else {
      this.bookmarks.unshift(entry);
    }
    this._writeJson(this.bookmarksPath, this.bookmarks);
    return entry;
  }

  removeBookmark(site, slug) {
    const key = `${site}:${slug}`;
    this.bookmarks = this.bookmarks.filter((b) => `${b.site}:${b.slug}` !== key);
    this._writeJson(this.bookmarksPath, this.bookmarks);
    return true;
  }

  // History
  getHistory() {
    return [...this.history];
  }

  addHistory(item) {
    const key = `${item.site}:${item.slug}`;
    const existing = this.history.find((h) => `${h.site}:${h.slug}` === key);
    const filtered = this.history.filter((h) => `${h.site}:${h.slug}` !== key);
    const entry = {
      site: item.site,
      slug: item.slug,
      title: item.title || existing?.title || item.slug,
      subtitle: item.subtitle || existing?.subtitle || '',
      rating: item.rating ?? existing?.rating ?? null,
      visitedAt: Date.now()
    };
    filtered.unshift(entry);
    this.history = filtered.slice(0, 500);
    this._writeJson(this.historyPath, this.history);
    return entry;
  }

  removeHistory(site, slug) {
    const key = `${site}:${slug}`;
    this.history = this.history.filter((h) => `${h.site}:${h.slug}` !== key);
    this._writeJson(this.historyPath, this.history);
    return true;
  }

  clearHistory() {
    this.history = [];
    this._writeJson(this.historyPath, this.history);
    return true;
  }

  // Reading progress
  getProgress(site, slug) {
    return this.progress[`${site}:${slug}`] || null;
  }

  getAllProgress() {
    return { ...this.progress };
  }

  setProgress(site, slug, data) {
    const key = `${site}:${slug}`;
    this.progress[key] = {
      ratio: Math.max(0, Math.min(1, Number(data.ratio) || 0)),
      scrollTop: Math.max(0, Number(data.scrollTop) || 0),
      updatedAt: Date.now()
    };
    this._writeJson(this.progressPath, this.progress);
    return this.progress[key];
  }

  // Series index cache (24h TTL)
  getSeriesCache(site, seriesSlug) {
    const safe = `${site}_${seriesSlug.replace(/[^a-z0-9-_]/gi, '_')}.json`;
    const file = path.join(this.seriesCacheDir, safe);
    const data = this._readJson(file, null);
    if (!data) return null;
    if (Date.now() - data.cachedAt > 24 * 60 * 60 * 1000) return null;
    return data;
  }

  setSeriesCache(site, seriesSlug, payload) {
    const safe = `${site}_${seriesSlug.replace(/[^a-z0-9-_]/gi, '_')}.json`;
    const file = path.join(this.seriesCacheDir, safe);
    const wrapped = { ...payload, cachedAt: Date.now() };
    this._writeJson(file, wrapped);
    return wrapped;
  }
}

module.exports = { AppStore, DEFAULT_SETTINGS };
