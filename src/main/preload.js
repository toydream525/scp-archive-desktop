const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('scpApi', {
  // Settings, Branches & Network
  getSettings: () => ipcRenderer.invoke('settings:get'),
  updateSettings: (patch) => ipcRenderer.invoke('settings:update', patch),
  getBranches: () => ipcRenderer.invoke('branches:list'),
  testConnectivity: () => ipcRenderer.invoke('network:test'),

  // Wikidot Unified Account Auth (Shared across EN / CN / all Wikidot branches)
  getAuthStatus: (opts) => ipcRenderer.invoke('auth:status', opts),
  openLogin: () => ipcRenderer.invoke('auth:login'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  onAuthChanged: (cb) => {
    const handler = (_event, state) => cb(state);
    ipcRenderer.on('auth:changed', handler);
    return () => ipcRenderer.removeListener('auth:changed', handler);
  },

  // Catalog & Discovery
  getSeriesDefinitions: (site) => ipcRenderer.invoke('series:definitions', site),
  fetchSeriesCatalog: (site, seriesSlug, opts) => ipcRenderer.invoke('series:fetch', site, seriesSlug, opts),
  searchPages: (site, keyword) => ipcRenderer.invoke('article:search', site, keyword),
  searchByTag: (site, tag, limit) => ipcRenderer.invoke('article:searchByTag', site, tag, limit),
  getRandomPage: (site, category) => ipcRenderer.invoke('article:random', site, category),
  getDiscoverPages: (site, opts) => ipcRenderer.invoke('article:discover', site, opts),

  // Articles
  loadArticle: (site, slug, opts) => ipcRenderer.invoke('article:load', site, slug, opts),
  prefetchArticle: (site, slug) => ipcRenderer.invoke('article:prefetch', site, slug),
  onArticleProgress: (cb) => {
    const handler = (_event, payload) => cb(payload);
    ipcRenderer.on('article:load-progress', handler);
    return () => ipcRenderer.removeListener('article:load-progress', handler);
  },
  detectSiteFromUrl: (url) => ipcRenderer.invoke('article:detectUrl', url),

  // Bookmarks
  getBookmarks: () => ipcRenderer.invoke('bookmarks:list'),
  upsertBookmark: (item) => ipcRenderer.invoke('bookmarks:upsert', item),
  removeBookmark: (site, slug) => ipcRenderer.invoke('bookmarks:remove', site, slug),

  // History
  getHistory: () => ipcRenderer.invoke('history:list'),
  addHistory: (item) => ipcRenderer.invoke('history:add', item),
  removeHistory: (site, slug) => ipcRenderer.invoke('history:remove', site, slug),
  clearHistory: () => ipcRenderer.invoke('history:clear'),

  // Progress
  getProgress: (site, slug) => ipcRenderer.invoke('progress:get', site, slug),
  getAllProgress: () => ipcRenderer.invoke('progress:getAll'),
  setProgress: (site, slug, data) => ipcRenderer.invoke('progress:set', site, slug, data),

  // Offline Cache
  listCached: () => ipcRenderer.invoke('cache:list'),
  searchCached: (keyword) => ipcRenderer.invoke('cache:search', keyword),
  saveToCache: (site, slug, opts) => ipcRenderer.invoke('cache:save', site, slug, opts),
  deleteCached: (site, slug) => ipcRenderer.invoke('cache:delete', site, slug),
  clearCache: () => ipcRenderer.invoke('cache:clear'),
  getCacheStats: () => ipcRenderer.invoke('cache:stats'),
  isCached: (site, slug) => ipcRenderer.invoke('cache:isCached', site, slug),
  startBatchCache: (opts) => ipcRenderer.invoke('cache:batchStart', opts),
  cancelBatchCache: () => ipcRenderer.invoke('cache:batchCancel'),
  getBatchCacheStatus: () => ipcRenderer.invoke('cache:batchStatus'),
  onBatchCacheProgress: (cb) => {
    const handler = (_event, status) => cb(status);
    ipcRenderer.on('cache:batch-progress', handler);
    return () => ipcRenderer.removeListener('cache:batch-progress', handler);
  },

  // Export & Shell
  exportArticle: (site, slug, format) => ipcRenderer.invoke('export:article', site, slug, format),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  getWebviewPreloadPath: () => ipcRenderer.invoke('app:getWebviewPreloadPath'),
  getWebPartition: () => ipcRenderer.invoke('app:getWebPartition'),

  // Events from Main
  onOpenNewTab: (cb) => {
    const handler = (_event, payload) => cb(payload);
    ipcRenderer.on('main:open-new-tab', handler);
    return () => ipcRenderer.removeListener('main:open-new-tab', handler);
  }
});
