import { t } from './i18n/index.js';

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class ReaderView {
  constructor(container, ctx, tab) {
    this.container = container;
    this.ctx = ctx;
    this.tab = tab;
    this.article = null;
    this.webview = null;
    this.scrollEl = null;
    this.scrollSaveTimer = null;
    this.collapsiblesExpanded = false;
    this.findHits = [];
    this.findIdx = -1;
    this.loadToken = 0;
  }

  applySettings(settings) {
    const art = this.container.querySelector('.reader-article');
    if (art) {
      art.style.setProperty('--reader-font-size', `${settings.fontSize || 16}px`);
      art.style.setProperty('--reader-line-height', String(settings.lineHeight || 1.75));
      if (Number(settings.contentWidth) > 0) {
        art.classList.remove('full-width');
        art.style.setProperty('--reader-width', `${settings.contentWidth}px`);
      } else {
        art.classList.add('full-width');
      }
    }
    const toc = this.container.querySelector('.reader-toc');
    if (toc) {
      toc.classList.toggle('hidden', !settings.showToc);
    }
    if (this.webview) {
      try {
        this.webview.send('scp-apply-enhancements', settings);
      } catch {
        // webview not ready yet
      }
    }
  }

  async load(site, slug, { mode, forceOnline = false, preferCache = false } = {}) {
    const token = ++this.loadToken;
    this.tab.site = site;
    this.tab.slug = slug;
    if (mode) this.tab.mode = mode;
    this.collapsiblesExpanded = false;
    this.clearFind();

    if (this.tab.mode === 'original') {
      await this._loadOriginalMode(site, slug, token);
    } else {
      await this._loadCleanMode(site, slug, { forceOnline, preferCache, token });
    }
  }

  async _loadCleanMode(site, slug, { forceOnline, preferCache, token }) {
    this.webview = null;
    this.container.innerHTML = `
      <div class="reader-state-box">
        <div class="spinner"></div>
        <p>${esc(t('reader.loading', { slug: slug.toUpperCase() }))}</p>
      </div>
    `;

    try {
      const article = await window.scpApi.loadArticle(site, slug, { forceOnline, preferCache });
      if (token !== this.loadToken) return;
      this.article = article;
      this.tab.article = article;
      this.tab.title = article.title || slug.toUpperCase();
      this.tab.isCached = Boolean(article.isCached);
      this.ctx.onTabStateChanged(this.tab);

      if (article.offlineFallbackReason) {
        this.ctx.showToast(t('toast.offlineFallback'), 'ok');
      }

      if (article.notFound) {
        this._renderNotFound(site, slug);
        return;
      }

      await window.scpApi.addHistory({
        site: article.site,
        slug: article.slug,
        title: article.title,
        subtitle: article.excerpt?.slice(0, 60) || '',
        rating: article.rating
      });
      this.ctx.refreshSidebarData();

      this._renderCleanArticle(article);
      await this._restoreProgressIfEnabled(site, slug);
    } catch (err) {
      if (token !== this.loadToken) return;
      this.container.innerHTML = `
        <div class="reader-state-box">
          <h2>${esc(t('reader.loadErrorTitle'))}</h2>
          <p>${esc(err.message || String(err))}</p>
          <div class="reader-state-actions">
            <button id="btn-err-retry" class="accent-btn">${esc(t('reader.retry'))}</button>
            <button id="btn-err-original" class="secondary-btn">${esc(t('reader.openOriginal'))}</button>
          </div>
        </div>
      `;
      this.container.querySelector('#btn-err-retry')?.addEventListener('click', () =>
        this.load(site, slug, { mode: 'clean', forceOnline: true })
      );
      this.container.querySelector('#btn-err-original')?.addEventListener('click', () =>
        this.ctx.setActiveTabMode('original')
      );
    }
  }

  _renderNotFound(site, slug) {
    const otherSite = site === 'cn' ? 'en' : 'cn';
    this.container.innerHTML = `
      <div class="reader-state-box">
        <h2>${esc(t('reader.notFoundTitle'))}</h2>
        <p>${esc(t('reader.notFoundDesc', { slug }))}</p>
        <div class="reader-state-actions">
          <button id="btn-nf-other" class="accent-btn">${esc(t('reader.tryOtherBranch'))} (${otherSite.toUpperCase()})</button>
          <button id="btn-nf-orig" class="secondary-btn">${esc(t('reader.openOriginal'))}</button>
        </div>
      </div>
    `;
    this.container.querySelector('#btn-nf-other')?.addEventListener('click', () =>
      this.ctx.openArticle(otherSite, slug, { newTab: false })
    );
    this.container.querySelector('#btn-nf-orig')?.addEventListener('click', () =>
      this.ctx.setActiveTabMode('original')
    );
  }

  _renderCleanArticle(article) {
    const settings = this.ctx.getSettings();
    const breadcrumbsHtml =
      article.breadcrumbs && article.breadcrumbs.length
        ? `<div class="reader-breadcrumbs">${article.breadcrumbs
            .map((b) => `<a href="javascript:;" data-scp-site="${esc(b.site)}" data-scp-slug="${esc(b.slug)}">${esc(b.text)}</a>`)
            .join(' <span>/</span> ')}</div>`
        : '';

    const ratingHtml =
      article.rating !== null && article.rating !== undefined
        ? `<span class="meta-pill">${esc(t('reader.ratingLabel'))}: <strong>${article.rating >= 0 ? `+${article.rating}` : article.rating}</strong></span>`
        : '';

    const cachePillHtml = article.fromCache
      ? `<span class="meta-pill cached">${esc(t('reader.offlineBadge'))}</span>`
      : article.isCached
        ? `<span class="meta-pill cached">${esc(t('reader.onlineCachedBadge'))}</span>`
        : '';

    const tagsHtml =
      article.tags && article.tags.length
        ? `<div class="reader-tags">${article.tags
            .map((tg) => `<button class="reader-tag" data-tag="${esc(tg)}">#${esc(tg)}</button>`)
            .join('')}</div>`
        : '';

    const interactiveBannerHtml = article.hasComplexInteractive
      ? `<div class="interactive-banner">
          <span>${esc(t('reader.interactiveHint'))}</span>
          <button class="scp-inline-switch-btn" data-action="switch-original">${esc(t('reader.switchToOriginal'))}</button>
        </div>`
      : '';

    const tocHtml =
      article.toc && article.toc.length
        ? article.toc
            .map((item) => `<button class="toc-item lvl-${item.level}" data-toc-id="${esc(item.id)}">${esc(item.text)}</button>`)
            .join('')
        : `<div class="list-empty" style="padding:12px 4px;">${esc(t('reader.tocEmpty'))}</div>`;

    this.container.innerHTML = `
      <div class="reader-layout">
        <div class="reader-scroll">
          <article class="reader-article">
            <header class="reader-header">
              ${breadcrumbsHtml}
              <div class="reader-title-row">
                <h1 class="reader-title">${esc(article.title)}</h1>
              </div>
              <div class="reader-meta-row">
                <span class="meta-pill accent">${esc(String(article.site || 'cn').toUpperCase())}</span>
                <span class="meta-pill">${esc(article.slug)}</span>
                ${ratingHtml}
                ${cachePillHtml}
              </div>
              ${tagsHtml}
            </header>
            ${interactiveBannerHtml}
            <div class="reader-body">${article.cleanHtml || ''}</div>
            <footer class="reader-license-footer">
              <span>${esc(t('reader.licensePrefix'))}</span>
              ${article.url ? `<a href="${esc(article.url)}">${esc(article.url)}</a>` : ''}
              <span>·</span>
              <a href="https://creativecommons.org/licenses/by-sa/3.0/">CC BY-SA 3.0</a>
            </footer>
          </article>
        </div>
        <aside class="reader-toc ${settings.showToc ? '' : 'hidden'}">
          <div class="toc-header">${esc(t('reader.tocTitle'))}</div>
          <div class="toc-list">${tocHtml}</div>
          <div class="toc-footer">
            <div class="toc-progress-row">
              <span>${esc(t('reader.progressLabel'))}</span>
              <span class="toc-progress-val">0%</span>
            </div>
            <div class="progress-mini"><div class="progress-mini-fill toc-progress-bar" style="width:0%"></div></div>
            <button class="mini-btn full-width" data-action="scroll-top">${esc(t('reader.backToTop'))}</button>
          </div>
        </aside>
      </div>
    `;

    // Localize iframe placeholder notices
    this.container.querySelectorAll('[data-iframe-placeholder="1"]').forEach((el) => {
      const txt = el.querySelector('.scp-iframe-text');
      const btn = el.querySelector('.scp-inline-switch-btn');
      if (txt) txt.textContent = t('reader.iframePlaceholder');
      if (btn) btn.textContent = t('reader.switchToOriginal');
    });

    // Initialize YUI tab panels cleanly (ensure first tab selected if none selected)
    this.container.querySelectorAll('.yui-navset').forEach((navset) => {
      const lis = Array.from(navset.querySelectorAll(':scope > .yui-nav > li'));
      const panels = Array.from(navset.querySelectorAll(':scope > .yui-content > div'));
      if (!lis.length || !panels.length) return;
      let activeIdx = lis.findIndex((li) => li.classList.contains('selected'));
      if (activeIdx < 0) activeIdx = 0;
      lis.forEach((li, i) => li.classList.toggle('selected', i === activeIdx));
      panels.forEach((p, i) => {
        p.style.display = i === activeIdx ? 'block' : 'none';
      });
    });

    this.scrollEl = this.container.querySelector('.reader-scroll');
    this.applySettings(settings);
    this._bindCleanEvents();
  }

  _bindCleanEvents() {
    const bodyRoot = this.container;

    // Click delegation: collapsibles, YUI tabs, footnotes, TOC, links, tags, switch original
    bodyRoot.addEventListener('click', (e) => {
      const switchBtn = e.target.closest('[data-action="switch-original"]');
      if (switchBtn) {
        this.ctx.setActiveTabMode('original');
        return;
      }

      const topBtn = e.target.closest('[data-action="scroll-top"]');
      if (topBtn && this.scrollEl) {
        this.scrollEl.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      const tocBtn = e.target.closest('.toc-item[data-toc-id]');
      if (tocBtn) {
        const target = this.container.querySelector(`#${CSS.escape(tocBtn.dataset.tocId)}`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      const tagBtn = e.target.closest('.reader-tag[data-tag]');
      if (tagBtn) {
        this.ctx.searchByTag(this.tab.site, tagBtn.dataset.tag);
        return;
      }

      // Collapsible toggle
      const collLink = e.target.closest('.collapsible-block-link');
      if (collLink) {
        e.preventDefault();
        const block = collLink.closest('.collapsible-block');
        if (block) {
          const folded = block.querySelector(':scope > .collapsible-block-folded');
          const unfolded = block.querySelector(':scope > .collapsible-block-unfolded');
          if (folded && unfolded) {
            const opening = unfolded.style.display === 'none' || getComputedStyle(unfolded).display === 'none';
            folded.style.display = opening ? 'none' : 'block';
            unfolded.style.display = opening ? 'block' : 'none';
          }
        }
        return;
      }

      // YUI Tabs
      const tabLink = e.target.closest('.yui-nav > li > a');
      if (tabLink) {
        e.preventDefault();
        const li = tabLink.closest('li');
        const navset = li.closest('.yui-navset');
        const lis = Array.from(navset.querySelectorAll(':scope > .yui-nav > li'));
        const panels = Array.from(navset.querySelectorAll(':scope > .yui-content > div'));
        const idx = lis.indexOf(li);
        if (idx >= 0) {
          lis.forEach((item, i) => item.classList.toggle('selected', i === idx));
          panels.forEach((p, i) => {
            p.style.display = i === idx ? 'block' : 'none';
          });
        }
        return;
      }

      // Footnotes
      const fnRef = e.target.closest('a[data-footnote-target]');
      if (fnRef) {
        e.preventDefault();
        const target = this.container.querySelector(`#${CSS.escape(fnRef.dataset.footnoteTarget)}`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const fnBack = e.target.closest('a[data-footnote-back]');
      if (fnBack) {
        e.preventDefault();
        const target = this.container.querySelector(`#${CSS.escape(fnBack.dataset.footnoteBack)}`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      // Internal SCP links or external links
      const link = e.target.closest('a[data-scp-slug], a[href]');
      if (link) {
        const scpSlug = link.getAttribute('data-scp-slug');
        const scpSite = link.getAttribute('data-scp-site') || this.tab.site;
        if (scpSlug) {
          e.preventDefault();
          this.ctx.openArticle(scpSite, scpSlug, { newTab: e.ctrlKey || e.metaKey });
          return;
        }
        const href = link.getAttribute('href') || '';
        if (href.startsWith('http://') || href.startsWith('https://')) {
          e.preventDefault();
          window.scpApi.openExternal(href);
        }
      }
    });

    // Middle-click on internal link -> open in new tab
    bodyRoot.addEventListener('auxclick', (e) => {
      if (e.button !== 1) return;
      const link = e.target.closest('a[data-scp-slug]');
      if (!link) return;
      e.preventDefault();
      this.ctx.openArticle(link.getAttribute('data-scp-site') || this.tab.site, link.getAttribute('data-scp-slug'), {
        newTab: true
      });
    });

    // Scroll progress tracker
    if (this.scrollEl) {
      const progressVal = this.container.querySelector('.toc-progress-val');
      const progressBar = this.container.querySelector('.toc-progress-bar');
      this.scrollEl.addEventListener(
        'scroll',
        () => {
          const max = Math.max(1, this.scrollEl.scrollHeight - this.scrollEl.clientHeight);
          const ratio = Math.max(0, Math.min(1, this.scrollEl.scrollTop / max));
          const pct = Math.round(ratio * 100);
          if (progressVal) progressVal.textContent = `${pct}%`;
          if (progressBar) progressBar.style.width = `${pct}%`;

          if (this.scrollSaveTimer) clearTimeout(this.scrollSaveTimer);
          this.scrollSaveTimer = setTimeout(() => {
            window.scpApi.setProgress(this.tab.site, this.tab.slug, {
              ratio,
              scrollTop: this.scrollEl.scrollTop
            });
          }, 700);
        },
        { passive: true }
      );
    }
  }

  async _restoreProgressIfEnabled(site, slug) {
    const settings = this.ctx.getSettings();
    if (!settings.autoRestoreProgress || !this.scrollEl) return;
    const prog = await window.scpApi.getProgress(site, slug);
    if (!prog || (prog.ratio || 0) < 0.04) return;

    requestAnimationFrame(() => {
      if (!this.scrollEl) return;
      const max = Math.max(1, this.scrollEl.scrollHeight - this.scrollEl.clientHeight);
      const y = Math.round(max * prog.ratio);
      if (y > 40) {
        this.scrollEl.scrollTop = y;
        this.ctx.showToast(t('toast.progressRestored', { pct: Math.round(prog.ratio * 100) }));
      }
    });
  }

  async _loadOriginalMode(site, slug, token) {
    const [preloadPath, partition, settings] = await Promise.all([
      window.scpApi.getWebviewPreloadPath(),
      window.scpApi.getWebPartition(),
      window.scpApi.getSettings()
    ]);
    if (token !== this.loadToken) return;

    const baseUrl = this.ctx.getBranchBaseUrl(site);
    const targetUrl = `${baseUrl}/${slug}`;

    this.container.innerHTML = `
      <div class="original-wrap">
        <div class="original-loading-bar"></div>
      </div>
    `;
    const wrap = this.container.querySelector('.original-wrap');
    const bar = this.container.querySelector('.original-loading-bar');

    const wv = document.createElement('webview');
    wv.className = 'original-webview';
    wv.setAttribute('partition', partition);
    wv.setAttribute('preload', preloadPath);
    wv.setAttribute('allowpopups', 'true');
    wv.src = targetUrl;
    wrap.appendChild(wv);
    this.webview = wv;

    wv.addEventListener('did-start-loading', () => bar?.classList.remove('hidden'));
    wv.addEventListener('did-stop-loading', () => {
      bar?.classList.add('hidden');
      try {
        wv.send('scp-apply-enhancements', this.ctx.getSettings());
      } catch {
        // ignore
      }
    });

    wv.addEventListener('dom-ready', async () => {
      try {
        wv.send('scp-apply-enhancements', this.ctx.getSettings());
        if (this.ctx.getSettings().autoRestoreProgress) {
          const prog = await window.scpApi.getProgress(this.tab.site, this.tab.slug);
          if (prog && prog.ratio > 0.04) {
            wv.send('scp-restore-scroll', prog);
          }
        }
      } catch {
        // ignore
      }
    });

    wv.addEventListener('did-navigate', async (e) => {
      const det = await window.scpApi.detectSiteFromUrl(e.url);
      if (det && (det.slug !== this.tab.slug || det.site !== this.tab.site)) {
        this.tab.site = det.site;
        this.tab.slug = det.slug;
        this.tab.isCached = await window.scpApi.isCached(det.site, det.slug);
        this.ctx.onTabStateChanged(this.tab);
      }
    });

    wv.addEventListener('ipc-message', async (e) => {
      if (e.channel === 'scp-page-meta') {
        const meta = e.args[0] || {};
        if (meta.title) {
          this.tab.title = meta.title;
          this.tab.article = {
            ...(this.tab.article || {}),
            site: this.tab.site,
            slug: this.tab.slug,
            url: meta.url || targetUrl,
            title: meta.title,
            rating: meta.rating,
            tags: meta.tags || []
          };
          this.ctx.onTabStateChanged(this.tab);
          await window.scpApi.addHistory({
            site: this.tab.site,
            slug: this.tab.slug,
            title: meta.title,
            rating: meta.rating
          });
          this.ctx.refreshSidebarData();
        }
      } else if (e.channel === 'scp-scroll') {
        const data = e.args[0];
        if (data) window.scpApi.setProgress(this.tab.site, this.tab.slug, data);
      } else if (e.channel === 'scp-open-new-tab') {
        const href = e.args[0]?.href;
        if (!href) return;
        const det = await window.scpApi.detectSiteFromUrl(href);
        if (det) {
          this.ctx.openArticle(det.site, det.slug, { newTab: true });
        } else {
          window.scpApi.openExternal(href);
        }
      } else if (e.channel === 'scp-collapsibles-toggled') {
        const { expand, count } = e.args[0] || {};
        if (!count) {
          this.ctx.showToast(t('toast.noCollapsibles'));
        } else {
          this.ctx.showToast(t(expand ? 'toast.collapsiblesExpanded' : 'toast.collapsiblesCollapsed', { count }));
        }
      }
    });

    this.tab.isCached = await window.scpApi.isCached(site, slug);
    this.ctx.onTabStateChanged(this.tab);
  }

  toggleAllCollapsibles() {
    this.collapsiblesExpanded = !this.collapsiblesExpanded;
    if (this.tab.mode === 'original' && this.webview) {
      try {
        this.webview.send('scp-toggle-collapsibles', this.collapsiblesExpanded);
      } catch {
        // ignore
      }
      return;
    }

    const blocks = this.container.querySelectorAll('.collapsible-block');
    let count = 0;
    blocks.forEach((block) => {
      const folded = block.querySelector(':scope > .collapsible-block-folded');
      const unfolded = block.querySelector(':scope > .collapsible-block-unfolded');
      if (folded && unfolded) {
        folded.style.display = this.collapsiblesExpanded ? 'none' : 'block';
        unfolded.style.display = this.collapsiblesExpanded ? 'block' : 'none';
        count++;
      }
    });
    if (count === 0) {
      this.ctx.showToast(t('toast.noCollapsibles'));
    } else {
      this.ctx.showToast(
        t(this.collapsiblesExpanded ? 'toast.collapsiblesExpanded' : 'toast.collapsiblesCollapsed', { count })
      );
    }
  }

  // In-page Find
  findInPage(query, { forward = true } = {}) {
    const q = String(query || '').trim();
    if (this.tab.mode === 'original' && this.webview) {
      if (!q) {
        try {
          this.webview.stopFindInPage('clearSelection');
        } catch {}
        return { current: 0, total: 0 };
      }
      try {
        this.webview.findInPage(q, { forward });
      } catch {}
      return { current: 1, total: 1, webview: true };
    }

    this.clearFind();
    if (!q) return { current: 0, total: 0 };
    const body = this.container.querySelector('.reader-body');
    if (!body) return { current: 0, total: 0 };

    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = n.parentElement;
        if (!p || p.tagName === 'SCRIPT' || p.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    for (const textNode of nodes) {
      const val = textNode.nodeValue;
      regex.lastIndex = 0;
      if (!regex.test(val)) continue;
      regex.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let lastIdx = 0;
      let match;
      while ((match = regex.exec(val)) !== null) {
        if (match.index > lastIdx) {
          frag.appendChild(document.createTextNode(val.slice(lastIdx, match.index)));
        }
        const mark = document.createElement('mark');
        mark.className = 'scp-find-hit';
        mark.textContent = match[0];
        frag.appendChild(mark);
        this.findHits.push(mark);
        lastIdx = match.index + match[0].length;
      }
      if (lastIdx < val.length) {
        frag.appendChild(document.createTextNode(val.slice(lastIdx)));
      }
      textNode.parentNode.replaceChild(frag, textNode);
    }

    if (this.findHits.length === 0) return { current: 0, total: 0 };
    this.findIdx = 0;
    this._highlightCurrentHit();
    return { current: 1, total: this.findHits.length };
  }

  stepFind(delta = 1, query = '') {
    if (this.tab.mode === 'original' && this.webview && query) {
      try {
        this.webview.findInPage(query, { forward: delta >= 0, findNext: true });
      } catch {}
      return { current: 1, total: 1, webview: true };
    }
    if (!this.findHits.length) return { current: 0, total: 0 };
    this.findIdx = (this.findIdx + delta + this.findHits.length) % this.findHits.length;
    this._highlightCurrentHit();
    return { current: this.findIdx + 1, total: this.findHits.length };
  }

  _highlightCurrentHit() {
    this.findHits.forEach((m, i) => m.classList.toggle('current', i === this.findIdx));
    const cur = this.findHits[this.findIdx];
    if (cur) {
      // Auto-unfold parent collapsible if hit is inside a folded block!
      let parent = cur.closest('.collapsible-block');
      while (parent) {
        const folded = parent.querySelector(':scope > .collapsible-block-folded');
        const unfolded = parent.querySelector(':scope > .collapsible-block-unfolded');
        if (folded && unfolded) {
          folded.style.display = 'none';
          unfolded.style.display = 'block';
        }
        parent = parent.parentElement?.closest('.collapsible-block');
      }
      cur.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  clearFind() {
    if (this.webview) {
      try {
        this.webview.stopFindInPage('clearSelection');
      } catch {}
    }
    for (const mark of this.findHits) {
      const parent = mark.parentNode;
      if (!parent) continue;
      parent.replaceChild(document.createTextNode(mark.textContent), mark);
      parent.normalize();
    }
    this.findHits = [];
    this.findIdx = -1;
  }

  reload() {
    if (this.tab.mode === 'original' && this.webview) {
      this.webview.reload();
    } else if (this.tab.slug) {
      this.load(this.tab.site, this.tab.slug, { mode: 'clean', forceOnline: true });
    }
  }
}
