const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { app, BrowserWindow, ipcMain, protocol, session, shell } = require('electron');

const { AppStore } = require('./store');
const { AuthService, WEB_PARTITION } = require('./auth-service');
const { ScpService } = require('./scp-service');
const { CacheService } = require('./cache-service');
const { ExportService } = require('./export-service');
const { getBranch } = require('../shared/branches');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'scp-cache',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true
    }
  }
]);

let mainWindow = null;
let store = null;
let authService = null;
let scpService = null;
let cacheService = null;
let exportService = null;

// Fast in-memory LRU cache for parsed articles (instant <5ms re-open & hover prefetch)
const ramArticleCache = new Map();
const RAM_CACHE_MAX = 60;
const inflightFetches = new Map();

function ramCacheKey(site, slug) {
  return `${String(site || 'cn').toLowerCase()}:${slug}`;
}

function getRamArticle(site, slug) {
  const key = ramCacheKey(site, slug);
  if (!ramArticleCache.has(key)) return null;
  const val = ramArticleCache.get(key);
  // Refresh LRU recency
  ramArticleCache.delete(key);
  ramArticleCache.set(key, val);
  return val;
}

function setRamArticle(site, slug, payload) {
  const key = ramCacheKey(site, slug);
  if (ramArticleCache.has(key)) ramArticleCache.delete(key);
  ramArticleCache.set(key, payload);
  if (ramArticleCache.size > RAM_CACHE_MAX) {
    const oldest = ramArticleCache.keys().next().value;
    ramArticleCache.delete(oldest);
  }
}

function sendLoadProgress(requestId, pct, stage) {
  if (!requestId || !mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('article:load-progress', { requestId, pct, stage });
}

function getTitleBarOverlayColors(theme) {
  if (theme === 'light') {
    return { color: '#eceef2', symbolColor: '#1f2328', height: 38 };
  }
  if (theme === 'sepia') {
    return { color: '#eae2d0', symbolColor: '#3b2f21', height: 38 };
  }
  return { color: '#11141a', symbolColor: '#d0d7de', height: 38 };
}

async function applyProxySettings(settings) {
  const mode = settings.proxyMode || 'system';
  let proxyConfig;
  if (mode === 'direct') {
    proxyConfig = { mode: 'direct' };
  } else if (mode === 'custom' && settings.proxyRules && settings.proxyRules.trim()) {
    proxyConfig = {
      mode: 'fixed_servers',
      proxyRules: settings.proxyRules.trim(),
      proxyBypassRules: settings.proxyBypassRules || '<local>'
    };
  } else {
    proxyConfig = { mode: 'system' };
  }

  const sessions = [session.defaultSession, session.fromPartition(WEB_PARTITION)];
  await Promise.all(sessions.map((s) => s.setProxy(proxyConfig)));
}

function registerCacheProtocol() {
  const mimeByExt = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp',
    '.ico': 'image/x-icon'
  };

  protocol.handle('scp-cache', (request) => {
    try {
      const u = new URL(request.url);
      if (u.hostname === 'assets') {
        const filename = decodeURIComponent(u.pathname.replace(/^\/+/, ''));
        const assetPath = cacheService.getAssetPath(filename);
        if (assetPath && fs.existsSync(assetPath)) {
          const ext = path.extname(assetPath).toLowerCase();
          const data = fs.readFileSync(assetPath);
          return new Response(data, {
            status: 200,
            headers: {
              'Content-Type': mimeByExt[ext] || 'application/octet-stream',
              'Cache-Control': 'public, max-age=31536000'
            }
          });
        }
      }
    } catch {
      // fall through
    }
    return new Response('Not Found', { status: 404 });
  });
}

function notifyAuthChanged(state) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auth:changed', state);
  }
}

function createWindow() {
  const settings = store.getSettings();
  const isWin = process.platform === 'win32';

  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 960,
    minHeight: 620,
    icon: path.join(__dirname, '../../build/icon.png'),
    backgroundColor: settings.theme === 'light' ? '#f6f8fa' : settings.theme === 'sepia' ? '#f5efe2' : '#0f1217',
    title: 'SCP Archive — SCP-Wiki PC Client',
    ...(isWin
      ? {
          titleBarStyle: 'hidden',
          titleBarOverlay: getTitleBarOverlayColors(settings.theme)
        }
      : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
      spellcheck: false
    }
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  // Settings, Branches & Proxy
  ipcMain.handle('settings:get', () => store.getSettings());
  ipcMain.handle('settings:update', async (_ev, patch) => {
    const next = store.updateSettings(patch || {});
    if (patch && ('proxyMode' in patch || 'proxyRules' in patch || 'proxyBypassRules' in patch)) {
      await applyProxySettings(next);
    }
    if (patch && 'theme' in patch && mainWindow && process.platform === 'win32') {
      mainWindow.setTitleBarOverlay(getTitleBarOverlayColors(next.theme));
    }
    return next;
  });
  ipcMain.handle('branches:list', () => scpService.listBranches());
  ipcMain.handle('network:test', () => scpService.testConnectivity());

  // Unified Wikidot Auth
  ipcMain.handle('auth:status', (_ev, opts) => authService.checkAuthStatus(opts || {}));
  ipcMain.handle('auth:login', () => authService.openLoginWindow(mainWindow, notifyAuthChanged));
  ipcMain.handle('auth:logout', () => authService.logout(notifyAuthChanged));

  // Series Catalog
  ipcMain.handle('series:definitions', (_ev, site) => scpService.getSeriesDefinitions(site));
  ipcMain.handle('series:fetch', (_ev, site, seriesSlug, opts) => scpService.fetchSeriesCatalog(site, seriesSlug, opts));

  // Search, Random & Discover
  ipcMain.handle('article:search', (_ev, site, keyword) => scpService.searchPages(site, keyword));
  ipcMain.handle('article:searchByTag', (_ev, site, tag, limit) => scpService.searchByTag(site, tag, limit));
  ipcMain.handle('article:random', (_ev, site, category) => scpService.getRandomPage(site, category));
  ipcMain.handle('article:discover', (_ev, site, opts) => scpService.getDiscoverPages(site, opts));
  ipcMain.handle('article:detectUrl', (_ev, url) => scpService.detectSiteFromUrl(url));

  // Article Loader (RAM LRU -> Disk Cache First -> Deduplicated Online Fetch + Real Progress)
  ipcMain.handle('article:load', async (_ev, site, rawSlug, opts = {}) => {
    const branch = getBranch(site);
    const targetSite = branch.id;
    const slug = scpService.normalizeSlug(rawSlug);
    const { forceOnline = false, preferCache = true, requestId = null } = opts;
    const key = ramCacheKey(targetSite, slug);

    sendLoadProgress(requestId, 18, 'cache');

    if (!forceOnline && preferCache) {
      const mem = getRamArticle(targetSite, slug);
      if (mem) {
        sendLoadProgress(requestId, 100, 'ready');
        return { ...mem, isCached: cacheService.isCached(targetSite, slug) || Boolean(mem.isCached) };
      }
      const cached = cacheService.getCachedArticle(targetSite, slug);
      if (cached) {
        const { rawHtml: _ignored, ...rendererPayload } = cached;
        const result = { ...rendererPayload, fromCache: true, isCached: true };
        setRamArticle(targetSite, slug, result);
        sendLoadProgress(requestId, 100, 'ready');
        return result;
      }
    }

    try {
      sendLoadProgress(requestId, 42, 'network');
      let fetchPromise = inflightFetches.get(key);
      if (!fetchPromise || forceOnline) {
        fetchPromise = scpService.fetchArticle(targetSite, slug);
        inflightFetches.set(key, fetchPromise);
        fetchPromise.finally(() => {
          if (inflightFetches.get(key) === fetchPromise) inflightFetches.delete(key);
        });
      }

      const article = await fetchPromise;
      sendLoadProgress(requestId, 82, 'parse');

      const settings = store.getSettings();
      let isCached = cacheService.isCached(targetSite, slug);

      if (!article.notFound && settings.autoCacheOnRead) {
        // Save lightweight text cache quickly, defer image localization so active reading stays snappy
        isCached = true;
        setTimeout(() => {
          cacheService
            .saveArticle(article, { downloadImages: Boolean(settings.cacheImages) })
            .catch(() => {});
        }, 650);
      }

      const { rawHtml: _ignored, ...rendererPayload } = article;
      const result = {
        ...rendererPayload,
        fromCache: false,
        isCached
      };
      if (!article.notFound) {
        setRamArticle(targetSite, slug, result);
      }
      sendLoadProgress(requestId, 100, 'ready');
      return result;
    } catch (err) {
      const cached = cacheService.getCachedArticle(targetSite, slug);
      if (cached) {
        const { rawHtml: _ignored, ...rendererPayload } = cached;
        sendLoadProgress(requestId, 100, 'ready');
        return {
          ...rendererPayload,
          fromCache: true,
          isCached: true,
          offlineFallbackReason: err.message || String(err)
        };
      }
      throw new Error(err.message || String(err));
    }
  });

  // Silent hover prefetch into RAM cache (never blocks UI, max 2 inflight)
  ipcMain.handle('article:prefetch', async (_ev, site, rawSlug) => {
    const branch = getBranch(site);
    const targetSite = branch.id;
    const slug = scpService.normalizeSlug(rawSlug);
    const key = ramCacheKey(targetSite, slug);
    if (getRamArticle(targetSite, slug) || inflightFetches.has(key) || inflightFetches.size >= 2) {
      return false;
    }
    const cached = cacheService.getCachedArticle(targetSite, slug);
    if (cached) {
      const { rawHtml: _ignored, ...rendererPayload } = cached;
      setRamArticle(targetSite, slug, { ...rendererPayload, fromCache: true, isCached: true });
      return true;
    }
    const p = scpService.fetchArticle(targetSite, slug);
    inflightFetches.set(key, p);
    p.then((article) => {
      if (!article.notFound) {
        const { rawHtml: _ignored, ...rendererPayload } = article;
        setRamArticle(targetSite, slug, {
          ...rendererPayload,
          fromCache: false,
          isCached: cacheService.isCached(targetSite, slug)
        });
      }
    })
      .catch(() => {})
      .finally(() => {
        if (inflightFetches.get(key) === p) inflightFetches.delete(key);
      });
    return true;
  });

  // Bookmarks
  ipcMain.handle('bookmarks:list', () => store.getBookmarks());
  ipcMain.handle('bookmarks:upsert', (_ev, item) => store.upsertBookmark(item));
  ipcMain.handle('bookmarks:remove', (_ev, site, slug) => store.removeBookmark(site, slug));

  // History
  ipcMain.handle('history:list', () => store.getHistory());
  ipcMain.handle('history:add', (_ev, item) => store.addHistory(item));
  ipcMain.handle('history:remove', (_ev, site, slug) => store.removeHistory(site, slug));
  ipcMain.handle('history:clear', () => store.clearHistory());

  // Progress
  ipcMain.handle('progress:get', (_ev, site, slug) => store.getProgress(site, slug));
  ipcMain.handle('progress:getAll', () => store.getAllProgress());
  ipcMain.handle('progress:set', (_ev, site, slug, data) => store.setProgress(site, slug, data));

  // Offline Cache
  ipcMain.handle('cache:list', () => cacheService.listCached());
  ipcMain.handle('cache:search', (_ev, keyword) => cacheService.searchCached(keyword));
  ipcMain.handle('cache:isCached', (_ev, site, slug) => cacheService.isCached(site, slug));
  ipcMain.handle('cache:save', async (_ev, site, slug, opts = {}) => {
    const settings = store.getSettings();
    const article = await scpService.fetchArticle(site, slug);
    if (article.notFound) {
      throw new Error('Page does not exist');
    }
    return cacheService.saveArticle(article, {
      downloadImages: opts.downloadImages !== undefined ? opts.downloadImages : Boolean(settings.cacheImages)
    });
  });
  ipcMain.handle('cache:delete', (_ev, site, slug) => cacheService.deleteCached(site, slug));
  ipcMain.handle('cache:clear', () => cacheService.clearAll());
  ipcMain.handle('cache:stats', () => cacheService.getStats());
  ipcMain.handle('cache:batchStatus', () => cacheService.getBatchStatus());
  ipcMain.handle('cache:batchCancel', () => cacheService.cancelBatchDownload());
  ipcMain.handle('cache:batchStart', (_ev, opts) => {
    return cacheService.startBatchDownload(opts || {}, (status) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('cache:batch-progress', status);
      }
    });
  });

  // Export
  ipcMain.handle('export:article', async (_ev, site, rawSlug, format) => {
    const branch = getBranch(site);
    const slug = scpService.normalizeSlug(rawSlug);
    let article = cacheService.getCachedArticle(branch.id, slug);
    if (!article) {
      article = await scpService.fetchArticle(branch.id, slug);
    }
    return exportService.exportArticle(mainWindow, article, format);
  });

  // Utilities
  ipcMain.handle('shell:openExternal', (_ev, url) => {
    if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
      return shell.openExternal(url);
    }
    return false;
  });

  ipcMain.handle('app:getWebviewPreloadPath', () => {
    const raw = path.join(__dirname, 'webview-preload.js');
    const unpacked = raw.replace('app.asar', 'app.asar.unpacked');
    const target = fs.existsSync(unpacked) ? unpacked : raw;
    return pathToFileURL(target).toString();
  });

  ipcMain.handle('app:getWebPartition', () => WEB_PARTITION);
}

app.whenReady().then(async () => {
  const userDataDir = app.getPath('userData');
  store = new AppStore(userDataDir);
  authService = new AuthService(store);
  scpService = new ScpService(store);
  cacheService = new CacheService(userDataDir, scpService, store);
  exportService = new ExportService(cacheService);

  registerCacheProtocol();
  await applyProxySettings(store.getSettings());
  registerIpcHandlers();
  createWindow();

  // Handle popups from <webview>
  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() === 'webview') {
      contents.setWindowOpenHandler(({ url }) => {
        // Intercept Wikidot login popup inside webview and route to our official login window
        if (url.includes('login__LoginPopupScreen')) {
          authService.openLoginWindow(mainWindow, notifyAuthChanged);
          return { action: 'deny' };
        }
        const detected = scpService.detectSiteFromUrl(url);
        if (detected && mainWindow) {
          mainWindow.webContents.send('main:open-new-tab', {
            site: detected.site,
            slug: detected.slug
          });
        } else if (url.startsWith('http://') || url.startsWith('https://')) {
          shell.openExternal(url);
        }
        return { action: 'deny' };
      });
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
