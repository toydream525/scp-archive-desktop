import { t, setLocale, pickLocalized } from './i18n/index.js';
import { HomeView } from './home-view.js';
import { ReaderView } from './reader-view.js';
import { SidebarController } from './sidebar.js';
import { DialogsController } from './dialogs.js';

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

class ScpClientApp {
  constructor() {
    this.settings = {};
    this.branches = [];
    this.tabs = [];
    this.activeTabId = null;
    this.nextTabSeq = 1;
    this.sidebar = null;
    this.dialogs = null;
  }

  async init() {
    const [settings, branches] = await Promise.all([
      window.scpApi.getSettings(),
      window.scpApi.getBranches()
    ]);
    this.settings = settings;
    this.branches = branches || [];

    setLocale(this.settings.uiLocale || 'zh-CN');
    this._applyTheme(this.settings.theme || 'dark');
    document.title = t('app.windowTitle');

    this.sidebar = new SidebarController(this);
    this.dialogs = new DialogsController(this);

    this._renderBranchSwitcher();
    this._bindToolbar();
    this._bindFindBar();
    this._bindShortcuts();

    window.scpApi.onOpenNewTab(({ site, slug }) => {
      if (slug) this.openArticle(site || this.getSite(), slug, { newTab: true });
    });

    // Open initial Explore tab & load catalog + auth in parallel
    this.createHomeTab();
    this.sidebar.onBranchOrLocaleChanged();
    window.scpApi.getAuthStatus().then((st) => this.dialogs.updateAccountUI(st));
  }

  getSettings() {
    return this.settings;
  }

  getSite() {
    return this.settings.site || 'cn';
  }

  getCurrentBranch() {
    return this.branches.find((b) => b.id === this.getSite()) || this.branches[0];
  }

  getBranchBaseUrl(siteId) {
    const b = this.branches.find((x) => x.id === siteId) || this.branches[0];
    const custom = this.settings.customBaseUrls?.[b.id];
    const legacy = b.id === 'cn' ? this.settings.cnBaseUrl : b.id === 'en' ? this.settings.enBaseUrl : '';
    return (custom || legacy || b.defaultBaseUrl || '').replace(/\/+$/, '');
  }

  async patchSettings(patch) {
    this.settings = await window.scpApi.updateSettings(patch);
    if ('theme' in patch) this._applyTheme(this.settings.theme);
    this.dialogs.syncAppearanceControls();
    for (const tab of this.tabs) {
      if (tab.readerView) tab.readerView.applySettings(this.settings);
    }
    return this.settings;
  }

  bumpFontSize(delta) {
    const cur = Number(this.settings.fontSize) || 16;
    const next = Math.max(13, Math.min(24, cur + delta));
    this.patchSettings({ fontSize: next });
  }

  _applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme || 'dark');
  }

  onLocaleChanged() {
    document.title = t('app.windowTitle');
    this._renderBranchSwitcher();
    this.dialogs.updateAccountUI(this.dialogs.authState);
    this.sidebar.onBranchOrLocaleChanged();
    for (const tab of this.tabs) {
      if (tab.type === 'home' && tab.homeView) {
        tab.title = t('app.newTabTitle');
        tab.homeView.render();
      }
    }
    this._renderTabs();
    this.syncToolbarState();
  }

  _renderBranchSwitcher() {
    const wrap = document.getElementById('branch-switcher');
    const cur = this.getSite();
    wrap.innerHTML = this.branches
      .map(
        (b) =>
          `<button class="branch-btn ${b.id === cur ? 'active' : ''}" data-site="${esc(b.id)}">${esc(
            pickLocalized(b.names, b.code)
          )}</button>`
      )
      .join('');
    wrap.querySelectorAll('.branch-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.switchBranch(btn.dataset.site));
    });
  }

  async switchBranch(siteId) {
    if (siteId === this.getSite()) return;
    await this.patchSettings({ site: siteId });
    this._renderBranchSwitcher();
    const b = this.getCurrentBranch();
    this.showToast(t('toast.branchSwitched', { name: pickLocalized(b?.names, siteId.toUpperCase()) }));
    this.sidebar.onBranchOrLocaleChanged();
    for (const tab of this.tabs) {
      if (tab.type === 'home' && tab.homeView) tab.homeView.render();
    }
  }

  // Tabs Management
  getActiveTab() {
    return this.tabs.find((tb) => tb.id === this.activeTabId) || null;
  }

  _createTabPane(tabId) {
    const pane = document.createElement('div');
    pane.className = 'tab-pane';
    pane.dataset.tabId = String(tabId);
    document.getElementById('tab-views').appendChild(pane);
    return pane;
  }

  createHomeTab() {
    const id = this.nextTabSeq++;
    const pane = this._createTabPane(id);
    const tab = {
      id,
      type: 'home',
      title: t('app.newTabTitle'),
      site: this.getSite(),
      slug: '',
      mode: this.settings.readingMode || 'clean',
      navStack: [],
      navIndex: -1,
      paneEl: pane,
      homeView: null,
      readerView: null
    };
    tab.homeView = new HomeView(pane, this);
    this.tabs.push(tab);
    this.activateTab(id);
    return tab;
  }

  activateTab(tabId) {
    const tab = this.tabs.find((tb) => tb.id === tabId);
    if (!tab) return;
    this.activeTabId = tabId;
    document.querySelectorAll('.tab-pane').forEach((p) =>
      p.classList.toggle('active', Number(p.dataset.tabId) === tabId)
    );
    this._renderTabs();
    this.syncToolbarState();
    this.closeFindBar(false);
  }

  closeTab(tabId) {
    const idx = this.tabs.findIndex((tb) => tb.id === tabId);
    if (idx < 0) return;
    const [removed] = this.tabs.splice(idx, 1);
    removed.paneEl?.remove();

    if (this.tabs.length === 0) {
      this.createHomeTab();
      return;
    }
    if (this.activeTabId === tabId) {
      const next = this.tabs[Math.min(idx, this.tabs.length - 1)];
      this.activateTab(next.id);
    } else {
      this._renderTabs();
    }
  }

  _renderTabs() {
    const strip = document.getElementById('tab-strip');
    strip.innerHTML = this.tabs
      .map((tb) => {
        const badge = tb.type === 'home' ? 'HOME' : String(tb.site || 'cn').toUpperCase();
        return `
          <div class="tab-item ${tb.id === this.activeTabId ? 'active' : ''}" data-tab-id="${tb.id}" title="${esc(tb.title)}">
            <span class="tab-badge">${esc(badge)}</span>
            <span class="tab-title">${esc(tb.title)}</span>
            <button class="tab-close" data-close-tab="${tb.id}" title="${esc(t('titlebar.closeTab'))}">✕</button>
          </div>
        `;
      })
      .join('');

    strip.querySelectorAll('.tab-item').forEach((el) => {
      const id = Number(el.dataset.tabId);
      el.addEventListener('click', (e) => {
        if (e.target.closest('.tab-close')) {
          this.closeTab(id);
        } else {
          this.activateTab(id);
        }
      });
      el.addEventListener('auxclick', (e) => {
        if (e.button === 1) {
          e.preventDefault();
          this.closeTab(id);
        }
      });
    });
  }

  async openArticle(site, slug, { newTab = false, preferCache = false, pushHistory = true, mode } = {}) {
    const targetSite = site || this.getSite();
    const cleanSlug = String(slug || '').trim().replace(/^\/+/, '').toLowerCase();
    if (!cleanSlug) return;

    let tab = this.getActiveTab();
    if (newTab || !tab) {
      const id = this.nextTabSeq++;
      const pane = this._createTabPane(id);
      tab = {
        id,
        type: 'article',
        title: cleanSlug.toUpperCase(),
        site: targetSite,
        slug: cleanSlug,
        mode: mode || this.settings.readingMode || 'clean',
        navStack: [],
        navIndex: -1,
        paneEl: pane,
        homeView: null,
        readerView: null
      };
      this.tabs.push(tab);
      this.activeTabId = id;
      document.querySelectorAll('.tab-pane').forEach((p) =>
        p.classList.toggle('active', Number(p.dataset.tabId) === id)
      );
    } else {
      tab.type = 'article';
      tab.homeView = null;
      if (mode) tab.mode = mode;
      else if (!tab.mode) tab.mode = this.settings.readingMode || 'clean';
    }

    if (pushHistory) {
      const top = tab.navStack[tab.navIndex];
      if (!top || top.site !== targetSite || top.slug !== cleanSlug) {
        tab.navStack = tab.navStack.slice(0, tab.navIndex + 1);
        tab.navStack.push({ site: targetSite, slug: cleanSlug });
        tab.navIndex = tab.navStack.length - 1;
      }
    }

    if (!tab.readerView) {
      tab.readerView = new ReaderView(tab.paneEl, this, tab);
    }

    tab.site = targetSite;
    tab.slug = cleanSlug;
    tab.title = cleanSlug.toUpperCase();
    this._renderTabs();
    this.syncToolbarState();

    await tab.readerView.load(targetSite, cleanSlug, { mode: tab.mode, preferCache });
  }

  onTabStateChanged(tab) {
    this._renderTabs();
    if (tab.id === this.activeTabId) {
      this.syncToolbarState();
    }
  }

  setActiveTabMode(mode) {
    const tab = this.getActiveTab();
    if (!tab || tab.type !== 'article' || !tab.readerView) return;
    if (tab.mode === mode) return;
    tab.mode = mode;
    this.syncToolbarState();
    tab.readerView.load(tab.site, tab.slug, { mode });
  }

  syncToolbarState() {
    const tab = this.getActiveTab();
    const isArticle = Boolean(tab && tab.type === 'article');

    document.getElementById('btn-nav-back').disabled = !(tab && tab.navIndex > 0);
    document.getElementById('btn-nav-forward').disabled = !(tab && tab.navIndex < (tab.navStack?.length || 0) - 1);

    const articleControls = [
      'btn-cross-branch',
      'mode-toggle-group',
      'btn-toggle-collapsibles',
      'btn-bookmark',
      'btn-cache-doc',
      'btn-export-menu'
    ];
    for (const id of articleControls) {
      document.getElementById(id).classList.toggle('hidden', !isArticle);
    }

    const omnibox = document.getElementById('omnibox-input');
    if (isArticle) {
      if (document.activeElement !== omnibox) {
        omnibox.value = tab.slug;
      }
      const otherBranch = this.branches.find((b) => b.id !== tab.site) || this.branches[0];
      document.getElementById('cross-branch-label').textContent = `⇄ ${otherBranch.code}`;

      document.getElementById('btn-mode-clean').classList.toggle('active', tab.mode !== 'original');
      document.getElementById('btn-mode-original').classList.toggle('active', tab.mode === 'original');

      const bmBtn = document.getElementById('btn-bookmark');
      const isBm = (this.sidebar?.bookmarks || []).some((b) => b.site === tab.site && b.slug === tab.slug);
      bmBtn.classList.toggle('active', isBm);

      const cacheBtn = document.getElementById('btn-cache-doc');
      cacheBtn.classList.toggle('cached', Boolean(tab.isCached));
    } else if (document.activeElement !== omnibox) {
      omnibox.value = '';
    }
  }

  // Smart Omnibox Parser
  async handleOmniboxInput(raw, { newTab = false } = {}) {
    const text = String(raw || '').trim();
    if (!text) return;

    // 1. Full URL
    if (/^https?:\/\//i.test(text)) {
      const det = await window.scpApi.detectSiteFromUrl(text);
      if (det) {
        await this.openArticle(det.site, det.slug, { newTab });
        return;
      }
      window.scpApi.openExternal(text);
      return;
    }

    // 2. Pure number or SCP-XXX / CN-XXX / SCP-CN-XXX / -J / -EX
    const numOnly = text.match(/^(\d{1,4})(-(j|ex|arc))?$/i);
    if (numOnly) {
      const n = numOnly[1].length < 3 ? numOnly[1].padStart(3, '0') : numOnly[1];
      const suffix = numOnly[2] ? numOnly[2].toLowerCase() : '';
      await this.openArticle(this.getSite(), `scp-${n}${suffix}`, { newTab });
      return;
    }

    const cnMatch = text.match(/^(?:scp[-\s]?)?cn[-\s]?(\d{1,4})(-(j|ex|arc))?$/i);
    if (cnMatch) {
      const n = cnMatch[1].length < 3 ? cnMatch[1].padStart(3, '0') : cnMatch[1];
      const suffix = cnMatch[2] ? cnMatch[2].toLowerCase() : '';
      await this.openArticle('cn', `scp-cn-${n}${suffix}`, { newTab });
      return;
    }

    const scpMatch = text.match(/^scp[-\s]?(\d{1,4})(-[a-z0-9-]+)?$/i);
    if (scpMatch) {
      const n = scpMatch[1].length < 3 ? scpMatch[1].padStart(3, '0') : scpMatch[1];
      const suffix = scpMatch[2] ? scpMatch[2].toLowerCase() : '';
      await this.openArticle(this.getSite(), `scp-${n}${suffix}`, { newTab });
      return;
    }

    // 3. Explicit slug (ascii with hyphen/colon/slash)
    if (/^[a-z0-9][a-z0-9-:/]+$/i.test(text) && (text.includes('-') || text.includes(':') || text.includes('/'))) {
      await this.openArticle(this.getSite(), text.toLowerCase(), { newTab });
      return;
    }

    // 4. Keyword search
    this.sidebar.runSearch(text);
  }

  async openRandom(category = 'scp') {
    try {
      const item = await window.scpApi.getRandomPage(this.getSite(), category);
      if (item && item.slug) {
        await this.openArticle(item.site, item.slug, { newTab: false });
      }
    } catch (err) {
      this.showToast(err.message || String(err), 'err');
    }
  }

  searchByTag(site, tag) {
    this.sidebar.runTagSearch(site, tag);
  }

  refreshSidebarData() {
    return this.sidebar.refreshUserData();
  }

  // Toolbar Bindings
  _bindToolbar() {
    document.getElementById('btn-new-tab').addEventListener('click', () => this.createHomeTab());
    document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
    });

    document.getElementById('btn-nav-back').addEventListener('click', () => this._navigateHistory(-1));
    document.getElementById('btn-nav-forward').addEventListener('click', () => this._navigateHistory(1));
    document.getElementById('btn-nav-reload').addEventListener('click', () => {
      const tab = this.getActiveTab();
      if (!tab) return;
      if (tab.type === 'home' && tab.homeView) tab.homeView.render();
      else if (tab.readerView) tab.readerView.reload();
    });

    const omnibox = document.getElementById('omnibox-input');
    const submitOmni = (newTab = false) => this.handleOmniboxInput(omnibox.value, { newTab });
    document.getElementById('btn-omnibox-go').addEventListener('click', () => submitOmni(false));
    omnibox.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitOmni(e.ctrlKey || e.metaKey);
    });
    omnibox.addEventListener('focus', () => omnibox.select());

    document.getElementById('btn-random-scp').addEventListener('click', () => this.openRandom('scp'));

    document.getElementById('btn-cross-branch').addEventListener('click', (e) => {
      const tab = this.getActiveTab();
      if (!tab || tab.type !== 'article') return;
      const otherBranch = this.branches.find((b) => b.id !== tab.site);
      if (!otherBranch) return;
      this.openArticle(otherBranch.id, tab.slug, { newTab: e.ctrlKey || e.metaKey });
    });

    document.getElementById('btn-mode-clean').addEventListener('click', () => this.setActiveTabMode('clean'));
    document.getElementById('btn-mode-original').addEventListener('click', () => this.setActiveTabMode('original'));

    document.getElementById('btn-toggle-collapsibles').addEventListener('click', () => {
      const tab = this.getActiveTab();
      tab?.readerView?.toggleAllCollapsibles();
    });

    document.getElementById('btn-bookmark').addEventListener('click', async (e) => {
      e.stopPropagation();
      const tab = this.getActiveTab();
      if (!tab || tab.type !== 'article') return;
      const existing = (this.sidebar.bookmarks || []).find((b) => b.site === tab.site && b.slug === tab.slug);
      if (!existing) {
        const added = await window.scpApi.upsertBookmark({
          site: tab.site,
          slug: tab.slug,
          title: tab.title || tab.slug,
          rating: tab.article?.rating ?? null,
          tags: tab.article?.tags || [],
          folder: t('sidebar.defaultFolder'),
          note: ''
        });
        this.showToast(t('toast.bookmarkAdded'), 'ok');
        await this.refreshSidebarData();
        this.syncToolbarState();
        this.dialogs.openBookmarkPopover(e.currentTarget, added, this.sidebar.bookmarks);
      } else {
        this.dialogs.openBookmarkPopover(e.currentTarget, existing, this.sidebar.bookmarks);
      }
    });

    document.getElementById('btn-cache-doc').addEventListener('click', async () => {
      const tab = this.getActiveTab();
      if (!tab || tab.type !== 'article') return;
      try {
        const info = await window.scpApi.saveToCache(tab.site, tab.slug);
        tab.isCached = true;
        this.syncToolbarState();
        await this.refreshSidebarData();
        this.showToast(t('toast.cachedSuccess', { images: info?.imageCount || 0 }), 'ok');
      } catch (err) {
        this.showToast(err.message || String(err), 'err');
      }
    });
  }

  _navigateHistory(delta) {
    const tab = this.getActiveTab();
    if (!tab || !tab.navStack) return;
    const nextIdx = tab.navIndex + delta;
    if (nextIdx < 0 || nextIdx >= tab.navStack.length) return;
    tab.navIndex = nextIdx;
    const target = tab.navStack[nextIdx];
    this.openArticle(target.site, target.slug, { newTab: false, pushHistory: false });
  }

  // In-Page Find Bar
  _bindFindBar() {
    const input = document.getElementById('find-input');
    const countEl = document.getElementById('find-count');

    const runFind = () => {
      const tab = this.getActiveTab();
      if (!tab || !tab.readerView) return;
      const res = tab.readerView.findInPage(input.value);
      countEl.textContent = res.webview ? '...' : `${res.current}/${res.total}`;
    };

    const step = (delta) => {
      const tab = this.getActiveTab();
      if (!tab || !tab.readerView) return;
      const res = tab.readerView.stepFind(delta, input.value);
      countEl.textContent = res.webview ? '...' : `${res.current}/${res.total}`;
    };

    input.addEventListener('input', runFind);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        step(e.shiftKey ? -1 : 1);
      } else if (e.key === 'Escape') {
        this.closeFindBar(true);
      }
    });
    document.getElementById('btn-find-next').addEventListener('click', () => step(1));
    document.getElementById('btn-find-prev').addEventListener('click', () => step(-1));
    document.getElementById('btn-find-close').addEventListener('click', () => this.closeFindBar(true));
  }

  openFindBar() {
    const bar = document.getElementById('find-bar');
    bar.classList.remove('hidden');
    const input = document.getElementById('find-input');
    input.focus();
    input.select();
  }

  closeFindBar(clearHighlights = true) {
    document.getElementById('find-bar').classList.add('hidden');
    if (clearHighlights) {
      const tab = this.getActiveTab();
      tab?.readerView?.clearFind();
      document.getElementById('find-count').textContent = '0/0';
    }
  }

  // Desktop Shortcuts
  _bindShortcuts() {
    window.addEventListener('keydown', (e) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key.toLowerCase() === 't') {
        e.preventDefault();
        this.createHomeTab();
      } else if (ctrl && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        if (this.activeTabId) this.closeTab(this.activeTabId);
      } else if (ctrl && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        const input = document.getElementById('omnibox-input');
        input.focus();
        input.select();
      } else if (ctrl && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        this.openFindBar();
      } else if (ctrl && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        document.getElementById('sidebar').classList.toggle('collapsed');
      } else if (ctrl && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        document.getElementById('btn-bookmark').click();
      } else if (ctrl && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        document.getElementById('btn-nav-reload').click();
      } else if (ctrl && e.shiftKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        this.getActiveTab()?.readerView?.toggleAllCollapsibles();
      } else if (ctrl && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        this.bumpFontSize(1);
      } else if (ctrl && e.key === '-') {
        e.preventDefault();
        this.bumpFontSize(-1);
      } else if (ctrl && e.key === '0') {
        e.preventDefault();
        this.patchSettings({ fontSize: 16 });
      } else if (ctrl && e.key === 'Tab') {
        e.preventDefault();
        if (this.tabs.length > 1) {
          const idx = this.tabs.findIndex((tb) => tb.id === this.activeTabId);
          const nextIdx = (idx + (e.shiftKey ? -1 : 1) + this.tabs.length) % this.tabs.length;
          this.activateTab(this.tabs[nextIdx].id);
        }
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        this._navigateHistory(-1);
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        this._navigateHistory(1);
      } else if (e.key === 'Escape') {
        this.dialogs.closeAllPopovers();
        document.getElementById('modal-settings').classList.add('hidden');
        this.closeFindBar(true);
      }
    });
  }

  showToast(message, variant = '') {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast ${variant}`;
    el.textContent = message;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.25s';
      setTimeout(() => el.remove(), 260);
    }, 2800);
  }
}

const app = new ScpClientApp();
app.init();
