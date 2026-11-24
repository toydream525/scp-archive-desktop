import { t, pickLocalized } from './i18n/index.js';

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBytes(bytes) {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatRelativeTime(ts) {
  if (!ts) return '';
  const diff = Math.max(0, Date.now() - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return new Date(ts).toLocaleDateString();
}

export class SidebarController {
  constructor(ctx) {
    this.ctx = ctx;
    this.activePanel = 'catalog';
    this.seriesItems = [];
    this.seriesFilteredItems = [];
    this.seriesRenderedCount = 0;
    this.seriesMemoryCache = new Map();
    this.currentSeriesSlug = '';
    this.bookmarks = [];
    this.history = [];
    this.progressMap = {};
    this.cachedList = [];

    this._bindEvents();
  }

  _bindEvents() {
    // Activity rail switching
    document.querySelectorAll('.rail-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.switchPanel(btn.dataset.panel));
    });

    // Series catalog controls
    document.getElementById('series-select').addEventListener('change', (e) => {
      this.loadSeries(e.target.value, false);
    });
    document.getElementById('btn-refresh-series').addEventListener('click', () => {
      if (this.currentSeriesSlug) this.loadSeries(this.currentSeriesSlug, true);
    });
    document.getElementById('series-filter').addEventListener('input', () => this._renderSeriesItems());

    // Search controls
    const searchInput = document.getElementById('sidebar-search-input');
    document.getElementById('btn-sidebar-search').addEventListener('click', () => this.runSearch(searchInput.value));
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.runSearch(searchInput.value);
    });
    document.getElementById('search-scope').addEventListener('change', () => {
      if (searchInput.value.trim()) this.runSearch(searchInput.value);
    });

    // Bookmarks filters
    document.getElementById('bookmark-folder-filter').addEventListener('change', () => this._renderBookmarks());
    document.getElementById('bookmark-filter').addEventListener('input', () => this._renderBookmarks());

    // History filters & clear
    document.getElementById('history-filter').addEventListener('input', () => this._renderHistory());
    document.getElementById('btn-clear-history').addEventListener('click', async () => {
      if (!confirm(t('toast.confirmClearHistory'))) return;
      await window.scpApi.clearHistory();
      this.ctx.showToast(t('toast.historyCleared'));
      await this.refreshUserData();
    });

    // Offline cache filters, batch downloader & clear
    document.getElementById('offline-filter').addEventListener('input', () => this._renderOffline());
    document.getElementById('btn-clear-cache').addEventListener('click', async () => {
      if (!confirm(t('toast.confirmClearCache'))) return;
      await window.scpApi.clearCache();
      this.ctx.showToast(t('toast.cacheCleared'));
      await this.refreshUserData();
    });

    this._bindBatchDownloader();

    // Sidebar resizer drag
    const sidebar = document.getElementById('sidebar');
    const resizer = document.getElementById('sidebar-resizer');
    let dragging = false;
    resizer.addEventListener('mousedown', (e) => {
      dragging = true;
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const w = Math.max(240, Math.min(520, e.clientX));
      sidebar.style.width = `${w}px`;
    });
    window.addEventListener('mouseup', () => {
      dragging = false;
    });

    // Chunked infinite scroll for large 1000-entry series lists (zero UI jank)
    const seriesListEl = document.getElementById('series-list');
    seriesListEl.addEventListener(
      'scroll',
      () => {
        if (this.seriesRenderedCount >= this.seriesFilteredItems.length) return;
        if (seriesListEl.scrollTop + seriesListEl.clientHeight >= seriesListEl.scrollHeight - 280) {
          this._appendSeriesChunk();
        }
      },
      { passive: true }
    );

    // Silent hover prefetch on sidebar rows (220ms)
    const sidebarPanel = document.getElementById('sidebar-panel');
    let rowHoverTimer = null;
    sidebarPanel.addEventListener('mouseover', (e) => {
      const row = e.target.closest('.list-row[data-slug]');
      if (!row || row.classList.contains('unwritten')) return;
      if (rowHoverTimer) clearTimeout(rowHoverTimer);
      const rSite = row.dataset.site;
      const rSlug = row.dataset.slug;
      rowHoverTimer = setTimeout(() => {
        if (rSlug) window.scpApi.prefetchArticle(rSite, rSlug);
      }, 220);
    });
    sidebarPanel.addEventListener('mouseout', (e) => {
      if (e.target.closest('.list-row[data-slug]') && rowHoverTimer) {
        clearTimeout(rowHoverTimer);
        rowHoverTimer = null;
      }
    });

    // Global item-list click & middle-click delegation
    sidebarPanel.addEventListener('click', async (e) => {
      const delBtn = e.target.closest('[data-del-kind]');
      if (delBtn) {
        e.stopPropagation();
        const kind = delBtn.dataset.delKind;
        const site = delBtn.dataset.site;
        const slug = delBtn.dataset.slug;
        if (kind === 'bookmark') {
          await window.scpApi.removeBookmark(site, slug);
          this.ctx.showToast(t('toast.bookmarkRemoved'));
        } else if (kind === 'history') {
          await window.scpApi.removeHistory(site, slug);
        } else if (kind === 'cache') {
          await window.scpApi.deleteCached(site, slug);
          this.ctx.showToast(t('toast.cacheDeleted'));
        }
        await this.refreshUserData();
        this.ctx.syncToolbarState();
        return;
      }

      const row = e.target.closest('.list-row[data-slug]');
      if (!row) return;
      const preferCache = row.dataset.preferCache === '1';
      this.ctx.openArticle(row.dataset.site, row.dataset.slug, {
        newTab: e.ctrlKey || e.metaKey,
        preferCache
      });
    });

    sidebarPanel.addEventListener('auxclick', (e) => {
      if (e.button !== 1) return;
      const row = e.target.closest('.list-row[data-slug]');
      if (!row) return;
      e.preventDefault();
      this.ctx.openArticle(row.dataset.site, row.dataset.slug, {
        newTab: true,
        preferCache: row.dataset.preferCache === '1'
      });
    });
  }

  switchPanel(panelName) {
    this.activePanel = panelName;
    document.getElementById('sidebar').classList.remove('collapsed');
    document.querySelectorAll('.rail-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.panel === panelName)
    );
    document.querySelectorAll('.panel-view').forEach((p) =>
      p.classList.toggle('active', p.id === `panel-${panelName}`)
    );
    if (panelName === 'bookmarks' || panelName === 'history' || panelName === 'offline') {
      this.refreshUserData();
    }
  }

  async onBranchOrLocaleChanged() {
    this._populateSeriesSelect();
    this._populateBatchSelects();
    this._renderQuickTags();
    await this.refreshUserData();
    const sel = document.getElementById('series-select');
    if (sel.value) {
      await this.loadSeries(sel.value, false);
    }
  }

  _bindBatchDownloader() {
    const panel = document.getElementById('batch-panel');
    const toggleBtn = document.getElementById('btn-toggle-batch');
    const sizeSel = document.getElementById('batch-size-select');
    const chunkSel = document.getElementById('batch-chunk-select');
    const startBtn = document.getElementById('btn-batch-start');
    const cancelBtn = document.getElementById('btn-batch-cancel');
    const progBox = document.getElementById('batch-progress-box');
    const progText = document.getElementById('batch-progress-text');
    const progBar = document.getElementById('batch-progress-bar');
    const progStats = document.getElementById('batch-progress-stats');

    toggleBtn.addEventListener('click', () => {
      panel.classList.toggle('hidden');
      toggleBtn.classList.toggle('active', !panel.classList.contains('hidden'));
    });

    sizeSel.addEventListener('change', () => this._populateBatchChunks());

    startBtn.addEventListener('click', async () => {
      const seriesSlug = document.getElementById('batch-series-select').value || 'scp-series';
      const count = Number(sizeSel.value) || 50;
      const chunkIdx = Number(chunkSel.value) || 0;
      const startIndex = chunkIdx * count;
      const skipCached = document.getElementById('batch-skip-cached').checked;
      const downloadImages = document.getElementById('batch-with-images').checked;

      progBox.classList.remove('hidden');
      progText.textContent = t('batch.preparing');
      progBar.style.width = '0%';
      progStats.textContent = '';
      startBtn.classList.add('hidden');
      cancelBtn.classList.remove('hidden');

      try {
        const finalState = await window.scpApi.startBatchCache({
          site: this.ctx.getSite(),
          seriesSlug,
          startIndex,
          count,
          skipCached,
          downloadImages
        });
        await this.refreshUserData();
        if (finalState.cancelled) {
          this.ctx.showToast(t('batch.cancelled', { downloaded: finalState.downloaded }));
        } else {
          this.ctx.showToast(
            t('batch.finished', { downloaded: finalState.downloaded, skipped: finalState.skipped }),
            'ok'
          );
          // Auto-advance selector to next batch for convenient sequential chunking
          if (chunkSel.selectedIndex + 1 < chunkSel.options.length) {
            chunkSel.selectedIndex += 1;
          }
        }
      } catch (err) {
        this.ctx.showToast(err.message || String(err), 'err');
      } finally {
        startBtn.classList.remove('hidden');
        cancelBtn.classList.add('hidden');
      }
    });

    cancelBtn.addEventListener('click', () => {
      window.scpApi.cancelBatchCache();
    });

    let lastRefreshDone = 0;
    window.scpApi.onBatchCacheProgress((st) => {
      if (!st) return;
      progBox.classList.remove('hidden');
      const pct = st.total > 0 ? Math.round((st.done / st.total) * 100) : 0;
      progBar.style.width = `${pct}%`;
      progStats.textContent = t('batch.stats', {
        done: st.done,
        total: st.total,
        downloaded: st.downloaded,
        skipped: st.skipped,
        failed: st.failed
      });
      if (st.running) {
        startBtn.classList.add('hidden');
        cancelBtn.classList.remove('hidden');
        if (st.currentTitle) {
          progText.textContent = t('batch.downloading', { item: st.currentTitle });
        }
        if (st.done - lastRefreshDone >= 5) {
          lastRefreshDone = st.done;
          this.refreshUserData();
        }
      } else {
        lastRefreshDone = 0;
        startBtn.classList.remove('hidden');
        cancelBtn.classList.add('hidden');
        progText.textContent = st.cancelled
          ? t('batch.cancelled', { downloaded: st.downloaded })
          : t('batch.finished', { downloaded: st.downloaded, skipped: st.skipped });
      }
    });
  }

  _populateBatchSelects() {
    const branch = this.ctx.getCurrentBranch();
    const sel = document.getElementById('batch-series-select');
    if (!sel) return;
    const prev = sel.value;
    const defs = branch?.series || [];
    const groups = new Map();
    for (const d of defs) {
      const gLabel = pickLocalized(d.group, 'Series');
      if (!groups.has(gLabel)) groups.set(gLabel, []);
      groups.get(gLabel).push(d);
    }
    sel.innerHTML = '';
    for (const [gLabel, items] of groups.entries()) {
      const og = document.createElement('optgroup');
      og.label = gLabel;
      for (const item of items) {
        const opt = document.createElement('option');
        opt.value = item.slug;
        opt.textContent = pickLocalized(item.labels, item.slug);
        og.appendChild(opt);
      }
      sel.appendChild(og);
    }
    if (defs.some((d) => d.slug === prev)) sel.value = prev;
    else if (defs.length > 0) sel.value = defs[0].slug;
    this._populateBatchChunks();
  }

  _populateBatchChunks() {
    const size = Number(document.getElementById('batch-size-select')?.value) || 50;
    const chunkSel = document.getElementById('batch-chunk-select');
    if (!chunkSel) return;
    const prev = Number(chunkSel.value) || 0;
    const totalChunks = Math.ceil(1000 / size);
    chunkSel.innerHTML = '';
    for (let i = 0; i < totalChunks; i++) {
      const from = i * size + 1;
      const to = Math.min(1000, (i + 1) * size);
      const opt = document.createElement('option');
      opt.value = String(i);
      opt.textContent = t('batch.chunkOption', { num: i + 1, from, to });
      chunkSel.appendChild(opt);
    }
    chunkSel.value = prev < totalChunks ? String(prev) : '0';
  }

  _populateSeriesSelect() {
    const branch = this.ctx.getCurrentBranch();
    const sel = document.getElementById('series-select');
    const prev = sel.value;
    const defs = branch?.series || [];

    const groups = new Map();
    for (const d of defs) {
      const gLabel = pickLocalized(d.group, 'Series');
      if (!groups.has(gLabel)) groups.set(gLabel, []);
      groups.get(gLabel).push(d);
    }

    sel.innerHTML = '';
    for (const [gLabel, items] of groups.entries()) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = gLabel;
      for (const item of items) {
        const opt = document.createElement('option');
        opt.value = item.slug;
        opt.textContent = pickLocalized(item.labels, item.slug);
        optgroup.appendChild(opt);
      }
      sel.appendChild(optgroup);
    }

    if (defs.some((d) => d.slug === prev)) {
      sel.value = prev;
    } else if (defs.length > 0) {
      sel.value = defs[0].slug;
    }
  }

  _renderQuickTags() {
    const branch = this.ctx.getCurrentBranch();
    const wrap = document.getElementById('quick-tags');
    const tags = branch?.quickTags || [];
    wrap.innerHTML = tags
      .map((tg) => `<button class="tag-chip" data-qtag="${esc(tg.tag)}">#${esc(pickLocalized(tg.labels, tg.tag))}</button>`)
      .join('');
    wrap.querySelectorAll('.tag-chip').forEach((btn) => {
      btn.addEventListener('click', () => this.runTagSearch(this.ctx.getSite(), btn.dataset.qtag));
    });
  }

  async loadSeries(seriesSlug, forceRefresh = false) {
    this.currentSeriesSlug = seriesSlug;
    const site = this.ctx.getSite();
    const memKey = `${site}:${seriesSlug}`;
    const statusEl = document.getElementById('series-status');
    const listEl = document.getElementById('series-list');

    if (!forceRefresh && this.seriesMemoryCache.has(memKey)) {
      this.seriesItems = this.seriesMemoryCache.get(memKey);
      this._renderSeriesItems();
      return;
    }

    statusEl.textContent = t('sidebar.loadingSeries');
    listEl.innerHTML = `<div class="list-empty">${esc(t('sidebar.loadingSeries'))}</div>`;

    try {
      const res = await window.scpApi.fetchSeriesCatalog(site, seriesSlug, { forceRefresh });
      this.seriesItems = res.items || [];
      this.seriesMemoryCache.set(memKey, this.seriesItems);
      this._renderSeriesItems();
    } catch (err) {
      statusEl.textContent = t('sidebar.seriesError', { msg: err.message || err });
      listEl.innerHTML = `<div class="list-empty">${esc(statusEl.textContent)}</div>`;
    }
  }

  _renderSeriesItems() {
    const filter = (document.getElementById('series-filter').value || '').trim().toLowerCase();
    const statusEl = document.getElementById('series-status');
    const listEl = document.getElementById('series-list');

    const filtered = filter
      ? this.seriesItems.filter((it) => `${it.code} ${it.subtitle} ${it.slug}`.toLowerCase().includes(filter))
      : this.seriesItems;

    this.seriesFilteredItems = filtered;
    this.seriesRenderedCount = 0;
    this._seriesLastSec = '';
    this._seriesHasFilter = Boolean(filter);
    this._seriesCachedSet = new Set(this.cachedList.map((c) => `${c.site}:${c.slug}`));
    this._seriesBmSet = new Set(this.bookmarks.map((b) => `${b.site}:${b.slug}`));

    statusEl.textContent = filter
      ? t('sidebar.seriesFiltered', { shown: filtered.length, total: this.seriesItems.length })
      : t('sidebar.seriesLoaded', { count: this.seriesItems.length });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="list-empty">${esc(t('sidebar.searchEmpty'))}</div>`;
      return;
    }

    listEl.innerHTML = '';
    listEl.scrollTop = 0;
    this._appendSeriesChunk();
  }

  _appendSeriesChunk() {
    const listEl = document.getElementById('series-list');
    const CHUNK = 120;
    const start = this.seriesRenderedCount;
    const end = Math.min(this.seriesFilteredItems.length, start + CHUNK);
    if (start >= end) return;

    const chunks = [];
    for (let i = start; i < end; i++) {
      const it = this.seriesFilteredItems[i];
      if (it.section && it.section !== this._seriesLastSec && !this._seriesHasFilter) {
        this._seriesLastSec = it.section;
        chunks.push(`<div class="list-section-hdr">${esc(this._seriesLastSec)}</div>`);
      }
      const key = `${it.site}:${it.slug}`;
      const flags = [];
      if (this._seriesBmSet.has(key)) flags.push('★');
      if (this._seriesCachedSet.has(key)) flags.push('⬇');
      if (it.unwritten) flags.push(t('sidebar.unwritten'));

      chunks.push(`
        <div class="list-row ${it.unwritten ? 'unwritten' : ''}" data-site="${esc(it.site)}" data-slug="${esc(it.slug)}">
          <div class="list-row-top">
            <span class="list-row-code">${esc(it.code)}</span>
            ${flags.length ? `<span class="list-row-meta">${esc(flags.join(' '))}</span>` : ''}
          </div>
          ${it.subtitle ? `<div class="list-row-sub">${esc(it.subtitle)}</div>` : ''}
        </div>
      `);
    }
    listEl.insertAdjacentHTML('beforeend', chunks.join(''));
    this.seriesRenderedCount = end;
  }

  async runSearch(keyword) {
    const q = String(keyword || '').trim();
    this.switchPanel('search');
    document.getElementById('sidebar-search-input').value = q;
    const statusEl = document.getElementById('search-status');
    const listEl = document.getElementById('search-results');

    if (!q) {
      statusEl.textContent = t('sidebar.searchHint');
      listEl.innerHTML = '';
      return;
    }

    const scope = document.getElementById('search-scope').value;
    statusEl.textContent = t('sidebar.searching');
    listEl.innerHTML = `<div class="list-empty">${esc(t('sidebar.searching'))}</div>`;

    try {
      const results =
        scope === 'offline'
          ? await window.scpApi.searchCached(q)
          : await window.scpApi.searchPages(this.ctx.getSite(), q);
      this._renderSearchResults(results, scope === 'offline');
    } catch (err) {
      statusEl.textContent = t('sidebar.seriesError', { msg: err.message || err });
      listEl.innerHTML = `<div class="list-empty">${esc(statusEl.textContent)}</div>`;
    }
  }

  async runTagSearch(site, tag) {
    this.switchPanel('search');
    const statusEl = document.getElementById('search-status');
    const listEl = document.getElementById('search-results');
    document.getElementById('sidebar-search-input').value = `#${tag}`;
    statusEl.textContent = t('sidebar.searching');
    listEl.innerHTML = `<div class="list-empty">${esc(t('sidebar.searching'))}</div>`;
    try {
      const results = await window.scpApi.searchByTag(site, tag, 30);
      this._renderSearchResults(results, false);
    } catch (err) {
      statusEl.textContent = t('sidebar.seriesError', { msg: err.message || err });
      listEl.innerHTML = `<div class="list-empty">${esc(statusEl.textContent)}</div>`;
    }
  }

  _renderSearchResults(results, isOffline) {
    const statusEl = document.getElementById('search-status');
    const listEl = document.getElementById('search-results');
    statusEl.textContent = t('sidebar.searchCount', { count: results.length });
    if (!results.length) {
      listEl.innerHTML = `<div class="list-empty">${esc(t('sidebar.searchEmpty'))}</div>`;
      return;
    }
    listEl.innerHTML = results
      .map((r) => {
        const rating =
          r.rating !== null && r.rating !== undefined
            ? `<span class="pill-rating">${r.rating >= 0 ? `+${r.rating}` : r.rating}</span>`
            : '';
        const tags = (r.tags || []).slice(0, 4).join(' · ');
        return `
          <div class="list-row" data-site="${esc(r.site)}" data-slug="${esc(r.slug)}" data-prefer-cache="${isOffline ? '1' : '0'}">
            <div class="list-row-top">
              <span class="list-row-code">${esc(r.title || r.slug)}</span>
              ${rating}
            </div>
            ${r.subtitle || r.excerpt ? `<div class="list-row-sub">${esc(r.subtitle || r.excerpt)}</div>` : ''}
            <div class="list-row-meta">
              <span class="pill-branch">${esc(String(r.site || 'cn').toUpperCase())}</span>
              <span>${esc(tags || r.slug)}</span>
            </div>
          </div>
        `;
      })
      .join('');
  }

  async refreshUserData({ onlyActivePanel = false } = {}) {
    const [bookmarks, history, progressMap, cachedList, stats] = await Promise.all([
      window.scpApi.getBookmarks(),
      window.scpApi.getHistory(),
      window.scpApi.getAllProgress(),
      window.scpApi.listCached(),
      window.scpApi.getCacheStats()
    ]);
    this.bookmarks = bookmarks || [];
    this.history = history || [];
    this.progressMap = progressMap || {};
    this.cachedList = cachedList || [];

    if (!onlyActivePanel || this.activePanel === 'bookmarks') this._renderBookmarks();
    if (!onlyActivePanel || this.activePanel === 'history') this._renderHistory();
    if (!onlyActivePanel || this.activePanel === 'offline') this._renderOffline(stats);
    // Avoid rebuilding the catalog DOM on every article read unless explicitly requested
    if (!onlyActivePanel && this.activePanel === 'catalog' && this.seriesItems.length) {
      this._renderSeriesItems();
    }
  }

  _renderBookmarks() {
    const countEl = document.getElementById('bookmarks-count');
    const folderSel = document.getElementById('bookmark-folder-filter');
    const filter = (document.getElementById('bookmark-filter').value || '').trim().toLowerCase();
    const listEl = document.getElementById('bookmarks-list');

    countEl.textContent = String(this.bookmarks.length);

    const folders = Array.from(new Set(this.bookmarks.map((b) => b.folder || t('sidebar.defaultFolder'))));
    const prevFolder = folderSel.value || '__ALL__';
    folderSel.innerHTML =
      `<option value="__ALL__">${esc(t('sidebar.allFolders'))}</option>` +
      folders.map((f) => `<option value="${esc(f)}">${esc(f)}</option>`).join('');
    folderSel.value = folders.includes(prevFolder) ? prevFolder : '__ALL__';

    const activeFolder = folderSel.value;
    const filtered = this.bookmarks.filter((b) => {
      if (activeFolder !== '__ALL__' && (b.folder || t('sidebar.defaultFolder')) !== activeFolder) return false;
      if (!filter) return true;
      return `${b.title} ${b.slug} ${b.note} ${b.folder}`.toLowerCase().includes(filter);
    });

    if (!filtered.length) {
      listEl.innerHTML = `<div class="list-empty">${esc(t('sidebar.bookmarksEmpty'))}</div>`;
      return;
    }

    listEl.innerHTML = filtered
      .map(
        (b) => `
      <div class="list-row" data-site="${esc(b.site)}" data-slug="${esc(b.slug)}">
        <div class="list-row-top">
          <span class="list-row-code">${esc(b.title || b.slug)}</span>
          <button class="row-del-btn" data-del-kind="bookmark" data-site="${esc(b.site)}" data-slug="${esc(b.slug)}" title="${esc(t('sidebar.delete'))}">✕</button>
        </div>
        ${b.note ? `<div class="list-row-sub">${esc(b.note)}</div>` : ''}
        <div class="list-row-meta">
          <span class="pill-branch">${esc(String(b.site || 'cn').toUpperCase())}</span>
          <span>${esc(b.folder || t('sidebar.defaultFolder'))}</span>
        </div>
      </div>`
      )
      .join('');
  }

  _renderHistory() {
    const filter = (document.getElementById('history-filter').value || '').trim().toLowerCase();
    const listEl = document.getElementById('history-list');
    const filtered = filter
      ? this.history.filter((h) => `${h.title} ${h.slug} ${h.subtitle}`.toLowerCase().includes(filter))
      : this.history;

    if (!filtered.length) {
      listEl.innerHTML = `<div class="list-empty">${esc(t('sidebar.historyEmpty'))}</div>`;
      return;
    }

    listEl.innerHTML = filtered
      .map((h) => {
        const prog = this.progressMap[`${h.site}:${h.slug}`];
        const pct = prog ? Math.round((prog.ratio || 0) * 100) : 0;
        return `
          <div class="list-row" data-site="${esc(h.site)}" data-slug="${esc(h.slug)}">
            <div class="list-row-top">
              <span class="list-row-code">${esc(h.title || h.slug)}</span>
              <button class="row-del-btn" data-del-kind="history" data-site="${esc(h.site)}" data-slug="${esc(h.slug)}" title="${esc(t('sidebar.delete'))}">✕</button>
            </div>
            <div class="list-row-meta">
              <span class="pill-branch">${esc(String(h.site || 'cn').toUpperCase())}</span>
              <span>${esc(formatRelativeTime(h.visitedAt))}</span>
              ${pct > 0 ? `<span>${pct}%</span>` : ''}
            </div>
            ${pct > 0 ? `<div class="progress-mini"><div class="progress-mini-fill" style="width:${pct}%"></div></div>` : ''}
          </div>
        `;
      })
      .join('');
  }

  _renderOffline(stats) {
    if (stats) {
      document.getElementById('cache-stats-bar').textContent = t('sidebar.offlineStats', {
        count: stats.count,
        size: formatBytes(stats.totalBytes)
      });
    }
    const filter = (document.getElementById('offline-filter').value || '').trim().toLowerCase();
    const listEl = document.getElementById('offline-list');
    const filtered = filter
      ? this.cachedList.filter((c) => `${c.title} ${c.slug} ${c.excerpt}`.toLowerCase().includes(filter))
      : this.cachedList;

    if (!filtered.length) {
      listEl.innerHTML = `<div class="list-empty">${esc(t('sidebar.offlineEmpty'))}</div>`;
      return;
    }

    listEl.innerHTML = filtered
      .map(
        (c) => `
      <div class="list-row" data-site="${esc(c.site)}" data-slug="${esc(c.slug)}" data-prefer-cache="1">
        <div class="list-row-top">
          <span class="list-row-code">${esc(c.title || c.slug)}</span>
          <button class="row-del-btn" data-del-kind="cache" data-site="${esc(c.site)}" data-slug="${esc(c.slug)}" title="${esc(t('sidebar.delete'))}">✕</button>
        </div>
        <div class="list-row-meta">
          <span class="pill-branch">${esc(String(c.site || 'cn').toUpperCase())}</span>
          <span>${esc(formatBytes(c.sizeBytes))}</span>
          ${c.imageCount ? `<span>🖼 ${c.imageCount}</span>` : ''}
        </div>
      </div>`
      )
      .join('');
  }
}
