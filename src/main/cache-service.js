const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');

class CacheService {
  constructor(userDataDir, scpService, store) {
    this.rootDir = path.join(userDataDir, 'offline-cache');
    this.pagesDir = path.join(this.rootDir, 'pages');
    this.assetsDir = path.join(this.rootDir, 'assets');
    this.indexPath = path.join(this.rootDir, 'index.json');
    fs.mkdirSync(this.pagesDir, { recursive: true });
    fs.mkdirSync(this.assetsDir, { recursive: true });

    this.scpService = scpService;
    this.store = store;
    this.index = this._readIndex();
    this.batchState = {
      running: false,
      cancelled: false,
      site: null,
      seriesSlug: null,
      total: 0,
      done: 0,
      downloaded: 0,
      skipped: 0,
      failed: 0,
      currentSlug: '',
      currentTitle: ''
    };
  }

  _readIndex() {
    try {
      if (!fs.existsSync(this.indexPath)) return {};
      return JSON.parse(fs.readFileSync(this.indexPath, 'utf-8'));
    } catch {
      return {};
    }
  }

  _saveIndex() {
    const tmp = `${this.indexPath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.index, null, 2), 'utf-8');
    fs.renameSync(tmp, this.indexPath);
  }

  _pageKey(site, slug) {
    const cleanSite = String(site || 'cn').toLowerCase();
    return `${cleanSite}:${this.scpService.normalizeSlug(slug)}`;
  }

  _pageFile(site, slug) {
    const key = this._pageKey(site, slug);
    const hash = crypto.createHash('sha1').update(key).digest('hex');
    return path.join(this.pagesDir, `${hash}.json`);
  }

  _assetFilename(url, contentType = '') {
    const hash = crypto.createHash('sha1').update(url).digest('hex');
    let ext = '';
    try {
      const pathname = new URL(url).pathname;
      const m = pathname.match(/\.([a-z0-9]{2,5})$/i);
      if (m) ext = m[1].toLowerCase();
    } catch {
      // ignore
    }
    if (!ext && contentType) {
      if (contentType.includes('png')) ext = 'png';
      else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = 'jpg';
      else if (contentType.includes('gif')) ext = 'gif';
      else if (contentType.includes('webp')) ext = 'webp';
      else if (contentType.includes('svg')) ext = 'svg';
    }
    return `${hash}.${ext || 'bin'}`;
  }

  getAssetPath(filename) {
    const safe = path.basename(filename);
    const full = path.join(this.assetsDir, safe);
    return fs.existsSync(full) ? full : null;
  }

  isCached(site, slug) {
    return Boolean(this.index[this._pageKey(site, slug)]);
  }

  getCachedArticle(site, slug) {
    const key = this._pageKey(site, slug);
    if (!this.index[key]) return null;
    const file = this._pageFile(site, slug);
    try {
      if (!fs.existsSync(file)) {
        delete this.index[key];
        this._saveIndex();
        return null;
      }
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return { ...data, fromCache: true };
    } catch {
      return null;
    }
  }

  async _downloadImageAsset(imgUrl) {
    try {
      // If already downloaded under common extension, reuse
      const hash = crypto.createHash('sha1').update(imgUrl).digest('hex');
      const existing = fs.readdirSync(this.assetsDir).find((f) => f.startsWith(`${hash}.`));
      if (existing) {
        return { filename: existing, size: fs.statSync(path.join(this.assetsDir, existing)).size };
      }

      const res = await this.scpService.fetchWithProxy(imgUrl, { timeoutMs: 12000 });
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0 || buf.length > 12 * 1024 * 1024) return null; // skip empty or >12MB
      const contentType = res.headers.get('content-type') || '';
      const filename = this._assetFilename(imgUrl, contentType);
      fs.writeFileSync(path.join(this.assetsDir, filename), buf);
      return { filename, size: buf.length };
    } catch {
      return null;
    }
  }

  async saveArticle(article, { downloadImages = true } = {}) {
    if (!article || article.notFound) return null;
    const site = String(article.site || 'cn').toLowerCase();
    const slug = this.scpService.normalizeSlug(article.slug);
    const key = this._pageKey(site, slug);

    let cleanHtml = article.cleanHtml || '';
    const assetMap = {};
    let assetsBytes = 0;

    if (downloadImages && Array.isArray(article.images) && article.images.length > 0) {
      const targets = article.images.slice(0, 30); // cap per-article image localization at 30
      const results = await Promise.all(
        targets.map(async (imgUrl) => {
          const downloaded = await this._downloadImageAsset(imgUrl);
          return { imgUrl, downloaded };
        })
      );
      for (const { imgUrl, downloaded } of results) {
        if (downloaded) {
          assetMap[imgUrl] = `scp-cache://assets/${downloaded.filename}`;
          assetsBytes += downloaded.size;
        }
      }
      if (Object.keys(assetMap).length > 0) {
        const $ = cheerio.load(`<div id="r">${cleanHtml}</div>`);
        $('#r img').each((_, el) => {
          const $img = $(el);
          const orig = $img.attr('data-orig-src') || $img.attr('src');
          if (orig && assetMap[orig]) {
            $img.attr('src', assetMap[orig]);
          }
        });
        cleanHtml = $('#r').html() || cleanHtml;
      }
    }

    const record = {
      site,
      slug,
      url: article.url,
      title: article.title,
      rating: article.rating ?? null,
      tags: article.tags || [],
      breadcrumbs: article.breadcrumbs || [],
      hasComplexInteractive: Boolean(article.hasComplexInteractive),
      toc: article.toc || [],
      images: article.images || [],
      excerpt: article.excerpt || '',
      cleanHtml,
      rawHtml: article.rawHtml || '',
      assetMap,
      cachedAt: Date.now()
    };

    const file = this._pageFile(site, slug);
    const serialized = JSON.stringify(record);
    fs.writeFileSync(file, serialized, 'utf-8');

    this.index[key] = {
      site,
      slug,
      title: record.title,
      rating: record.rating,
      tags: record.tags,
      excerpt: record.excerpt,
      imageCount: Object.keys(assetMap).length,
      sizeBytes: Buffer.byteLength(serialized, 'utf-8') + assetsBytes,
      cachedAt: record.cachedAt
    };
    this._saveIndex();
    return this.index[key];
  }

  listCached() {
    return Object.values(this.index).sort((a, b) => (b.cachedAt || 0) - (a.cachedAt || 0));
  }

  searchCached(keyword) {
    const q = String(keyword || '').trim().toLowerCase();
    if (!q) return this.listCached();
    return this.listCached().filter((item) => {
      const hay = `${item.slug} ${item.title} ${item.excerpt} ${(item.tags || []).join(' ')}`.toLowerCase();
      return hay.includes(q);
    });
  }

  deleteCached(site, slug) {
    const key = this._pageKey(site, slug);
    const file = this._pageFile(site, slug);
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
    delete this.index[key];
    this._saveIndex();
    return true;
  }

  clearAll() {
    for (const f of fs.readdirSync(this.pagesDir)) {
      fs.unlinkSync(path.join(this.pagesDir, f));
    }
    for (const f of fs.readdirSync(this.assetsDir)) {
      fs.unlinkSync(path.join(this.assetsDir, f));
    }
    this.index = {};
    this._saveIndex();
    return true;
  }

  getStats() {
    const list = this.listCached();
    let totalBytes = 0;
    try {
      for (const f of fs.readdirSync(this.pagesDir)) {
        totalBytes += fs.statSync(path.join(this.pagesDir, f)).size;
      }
      for (const f of fs.readdirSync(this.assetsDir)) {
        totalBytes += fs.statSync(path.join(this.assetsDir, f)).size;
      }
    } catch {
      // ignore
    }
    return {
      count: list.length,
      totalBytes
    };
  }

  getBatchStatus() {
    return { ...this.batchState };
  }

  cancelBatchDownload() {
    if (this.batchState.running) {
      this.batchState.cancelled = true;
    }
    return this.getBatchStatus();
  }

  async startBatchDownload(
    { site = 'cn', seriesSlug = 'scp-series', startIndex = 0, count = 50, skipCached = true, downloadImages = false },
    onProgress
  ) {
    if (this.batchState.running) {
      throw new Error('Batch download already in progress');
    }

    const emit = () => {
      if (typeof onProgress === 'function') {
        try {
          onProgress(this.getBatchStatus());
        } catch {
          // ignore
        }
      }
    };

    const catalog = await this.scpService.fetchSeriesCatalog(site, seriesSlug, { forceRefresh: false });
    const allValid = (catalog.items || []).filter((it) => !it.unwritten);
    const start = Math.max(0, Number(startIndex) || 0);
    const limit = Math.max(1, Math.min(500, Number(count) || 50));
    const slice = allValid.slice(start, start + limit);

    this.batchState = {
      running: true,
      cancelled: false,
      site,
      seriesSlug,
      seriesTotal: allValid.length,
      startIndex: start,
      total: slice.length,
      done: 0,
      downloaded: 0,
      skipped: 0,
      failed: 0,
      currentSlug: '',
      currentTitle: ''
    };
    emit();

    let cursor = 0;
    const concurrency = 2;

    const worker = async () => {
      while (!this.batchState.cancelled) {
        const idx = cursor++;
        if (idx >= slice.length) break;
        const item = slice[idx];
        const targetSite = item.site || site;
        const slug = item.slug;

        this.batchState.currentSlug = slug;
        this.batchState.currentTitle = item.code || slug;
        emit();

        if (skipCached && this.isCached(targetSite, slug)) {
          this.batchState.skipped++;
          this.batchState.done++;
          emit();
          continue;
        }

        let succeeded = false;
        for (let attempt = 0; attempt < 2 && !this.batchState.cancelled; attempt++) {
          try {
            const article = await this.scpService.fetchArticle(targetSite, slug);
            if (this.batchState.cancelled) break;
            if (!article.notFound) {
              await this.saveArticle(article, { downloadImages: Boolean(downloadImages) });
              this.batchState.downloaded++;
              succeeded = true;
            }
            break;
          } catch {
            if (attempt === 0 && !this.batchState.cancelled) {
              await new Promise((r) => setTimeout(r, 600));
            }
          }
        }
        if (!succeeded && !this.batchState.cancelled) {
          this.batchState.failed++;
        }

        this.batchState.done++;
        emit();

        // Polite throttle to avoid triggering Wikidot rate limits
        if (!this.batchState.cancelled) {
          await new Promise((r) => setTimeout(r, 220));
        }
      }
    };

    try {
      await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, slice.length)) }, () => worker()));
    } finally {
      this.batchState.running = false;
      this.batchState.currentSlug = '';
      this.batchState.currentTitle = '';
      emit();
    }

    return this.getBatchStatus();
  }
}

module.exports = { CacheService };
