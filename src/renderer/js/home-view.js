import { t } from './i18n/index.js';

const CLASSIC_PICKS = {
  cn: [
    { slug: 'scp-173', title: 'SCP-173', subtitle: '雕像 - 最初之作', tags: ['euclid', '经典'] },
    { slug: 'scp-093', title: 'SCP-093', subtitle: '红海物件', tags: ['euclid', '超维度'] },
    { slug: 'scp-096', title: 'SCP-096', subtitle: '“羞涩的人”', tags: ['euclid', '人形生物'] },
    { slug: 'scp-682', title: 'SCP-682', subtitle: '不灭孽蜥', tags: ['keter', '适应性'] },
    { slug: 'scp-049', title: 'SCP-049', subtitle: '疫医', tags: ['euclid', '人形生物'] },
    { slug: 'scp-106', title: 'SCP-106', subtitle: '恐怖老人', tags: ['keter', '口袋次元'] },
    { slug: 'scp-3008', title: 'SCP-3008', subtitle: '非常普通的老宜家', tags: ['euclid', '建筑'] },
    { slug: 'scp-5000', title: 'SCP-5000', subtitle: '为什么？', tags: ['safe', '竞赛优胜'] },
    { slug: 'scp-cn-1000', title: 'SCP-CN-1000', subtitle: '2300', tags: ['中分原创', '竞赛'] },
    { slug: 'scp-cn-1999', title: 'SCP-CN-1999', subtitle: '幻想遗物', tags: ['中分原创', 'keter'] },
    { slug: 'scp-055', title: 'SCP-055', subtitle: '【未知】', tags: ['keter', '逆模因'] },
    { slug: 'scp-2317', title: 'SCP-2317', subtitle: '异界之门', tags: ['apollyon', '仪式'] }
  ],
  en: [
    { slug: 'scp-173', title: 'SCP-173', subtitle: 'The Sculpture - The Original', tags: ['euclid', 'classic'] },
    { slug: 'scp-093', title: 'SCP-093', subtitle: 'Red Sea Object', tags: ['euclid', 'extradimensional'] },
    { slug: 'scp-096', title: 'SCP-096', subtitle: 'The "Shy Guy"', tags: ['euclid', 'humanoid'] },
    { slug: 'scp-682', title: 'SCP-682', subtitle: 'Hard-to-Destroy Reptile', tags: ['keter', 'adaptive'] },
    { slug: 'scp-049', title: 'SCP-049', subtitle: 'Plague Doctor', tags: ['euclid', 'humanoid'] },
    { slug: 'scp-055', title: 'SCP-055', subtitle: '[unknown]', tags: ['keter', 'antimemetic'] },
    { slug: 'scp-3008', title: 'SCP-3008', subtitle: 'A Perfectly Normal, Regular Old IKEA', tags: ['euclid', 'building'] },
    { slug: 'scp-5000', title: 'SCP-5000', subtitle: 'Why?', tags: ['safe', 'contest'] },
    { slug: 'scp-2317', title: 'SCP-2317', subtitle: 'A Door to Another World', tags: ['apollyon', 'ritual'] },
    { slug: 'scp-3001', title: 'SCP-3001', subtitle: 'Red Reality', tags: ['euclid', 'extradimensional'] },
    { slug: 'scp-4000', title: 'SCP-4000', subtitle: 'Taboo', tags: ['keter', 'nameless'] },
    { slug: 'scp-1730', title: 'SCP-1730', subtitle: 'What Happened to Site-13?', tags: ['neutralized', 'exploration'] }
  ]
};

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class HomeView {
  constructor(container, ctx) {
    this.container = container;
    this.ctx = ctx;
    this.discoverTab = 'classic'; // 'classic' | 'top' | 'latest'
    this.discoverCache = {};
    this.render();
  }

  async render() {
    const site = this.ctx.getSite();
    const [history, progressMap] = await Promise.all([
      window.scpApi.getHistory(),
      window.scpApi.getAllProgress()
    ]);
    const recent = (history || []).slice(0, 6);

    const recentHtml = recent.length
      ? `<div class="card-grid">
          ${recent
            .map((h) => {
              const prog = progressMap[`${h.site}:${h.slug}`];
              const pct = prog ? Math.round((prog.ratio || 0) * 100) : 0;
              return `
                <div class="doc-card" data-open-site="${esc(h.site)}" data-open-slug="${esc(h.slug)}">
                  <div class="doc-card-top">
                    <span class="doc-card-title">${esc(h.title || h.slug.toUpperCase())}</span>
                    <span class="pill-branch">${esc(String(h.site || 'cn').toUpperCase())}</span>
                  </div>
                  <div class="doc-card-sub">${esc(h.subtitle || h.slug)}</div>
                  ${
                    pct > 0
                      ? `<div class="progress-mini"><div class="progress-mini-fill" style="width:${pct}%"></div></div>`
                      : ''
                  }
                </div>
              `;
            })
            .join('')}
        </div>`
      : `<div class="list-empty">${esc(t('home.noRecent'))}</div>`;

    this.container.innerHTML = `
      <div class="home-scroll">
        <div class="home-inner">
          <section class="home-hero">
            <div class="home-eyebrow">${esc(t('home.heroEyebrow'))}</div>
            <h1 class="home-title">${esc(t('home.heroTitle'))}</h1>
            <p class="home-subtitle">${esc(t('home.heroSubtitle'))}</p>
            <div class="home-jump-bar">
              <input id="home-jump-input" type="text" placeholder="${esc(t('home.quickJumpPlaceholder'))}" />
              <button id="home-jump-btn" class="accent-btn">${esc(t('home.quickJumpBtn'))}</button>
            </div>
            <div class="home-quick-actions">
              <button class="secondary-btn" data-home-random="scp">${esc(t('home.quickRandomScp'))}</button>
              ${
                site === 'cn'
                  ? `<button class="secondary-btn" data-home-random="cn-original">${esc(t('home.quickRandomCn'))}</button>`
                  : ''
              }
              <button class="secondary-btn" data-home-random="tale">${esc(t('home.quickRandomTale'))}</button>
            </div>
          </section>

          <section>
            <div class="home-section-head">
              <h2>${esc(t('home.continueReading'))}</h2>
            </div>
            ${recentHtml}
          </section>

          <section>
            <div class="home-section-head">
              <h2>${esc(t('home.discoverClassic'))}</h2>
              <div class="home-tabs">
                <button class="home-tab-btn ${this.discoverTab === 'classic' ? 'active' : ''}" data-discover="classic">${esc(t('home.discoverClassic'))}</button>
                <button class="home-tab-btn ${this.discoverTab === 'top' ? 'active' : ''}" data-discover="top">${esc(t('home.discoverTop'))}</button>
                <button class="home-tab-btn ${this.discoverTab === 'latest' ? 'active' : ''}" data-discover="latest">${esc(t('home.discoverLatest'))}</button>
              </div>
            </div>
            <div id="home-discover-body"></div>
          </section>
        </div>
      </div>
    `;

    this._bindEvents();
    this._renderDiscover();
  }

  _bindEvents() {
    const input = this.container.querySelector('#home-jump-input');
    const goBtn = this.container.querySelector('#home-jump-btn');
    const doJump = () => {
      const val = input.value.trim();
      if (val) this.ctx.handleOmniboxInput(val);
    };
    goBtn?.addEventListener('click', doJump);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doJump();
    });

    this.container.querySelectorAll('[data-home-random]').forEach((btn) => {
      btn.addEventListener('click', () => this.ctx.openRandom(btn.dataset.homeRandom));
    });

    this.container.querySelectorAll('[data-discover]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.discoverTab = btn.dataset.discover;
        this.container.querySelectorAll('[data-discover]').forEach((b) =>
          b.classList.toggle('active', b.dataset.discover === this.discoverTab)
        );
        this._renderDiscover();
      });
    });

    this.container.addEventListener('click', (e) => {
      const card = e.target.closest('.doc-card[data-open-slug]');
      if (!card) return;
      const openNew = e.ctrlKey || e.metaKey;
      this.ctx.openArticle(card.dataset.openSite, card.dataset.openSlug, { newTab: openNew });
    });

    this.container.addEventListener('auxclick', (e) => {
      if (e.button !== 1) return;
      const card = e.target.closest('.doc-card[data-open-slug]');
      if (!card) return;
      e.preventDefault();
      this.ctx.openArticle(card.dataset.openSite, card.dataset.openSlug, { newTab: true });
    });
  }

  async _renderDiscover() {
    const body = this.container.querySelector('#home-discover-body');
    if (!body) return;
    const site = this.ctx.getSite();

    if (this.discoverTab === 'classic') {
      const list = CLASSIC_PICKS[site] || CLASSIC_PICKS.en;
      body.innerHTML = this._renderCards(list.map((i) => ({ ...i, site })));
      return;
    }

    const cacheKey = `${site}:${this.discoverTab}`;
    if (this.discoverCache[cacheKey]) {
      body.innerHTML = this._renderCards(this.discoverCache[cacheKey]);
      return;
    }

    body.innerHTML = `<div class="list-empty">${esc(t('home.loadingDiscover'))}</div>`;
    try {
      const sortKey = this.discoverTab === 'top' ? 'RATING' : 'CREATED_AT';
      const items = await window.scpApi.getDiscoverPages(site, { sortKey, tag: 'scp', limit: 16 });
      this.discoverCache[cacheKey] = items;
      body.innerHTML = this._renderCards(items);
    } catch {
      body.innerHTML = `
        <div class="list-empty">
          ${esc(t('home.discoverError'))}
          <div style="margin-top:8px;"><button id="btn-retry-discover" class="mini-btn">${esc(t('home.retry'))}</button></div>
        </div>
      `;
      body.querySelector('#btn-retry-discover')?.addEventListener('click', () => {
        delete this.discoverCache[cacheKey];
        this._renderDiscover();
      });
    }
  }

  _renderCards(items) {
    if (!items || items.length === 0) {
      return `<div class="list-empty">${esc(t('sidebar.searchEmpty'))}</div>`;
    }
    return `<div class="card-grid">
      ${items
        .map((item) => {
          const ratingHtml =
            item.rating !== null && item.rating !== undefined
              ? `<span class="pill-rating">${item.rating >= 0 ? `+${item.rating}` : item.rating}</span>`
              : `<span class="pill-branch">${esc(String(item.site || 'cn').toUpperCase())}</span>`;
          const tagsHtml = (item.tags || [])
            .slice(0, 4)
            .map((tg) => `<span class="doc-card-tag">${esc(tg)}</span>`)
            .join('');
          return `
            <div class="doc-card" data-open-site="${esc(item.site)}" data-open-slug="${esc(item.slug)}">
              <div class="doc-card-top">
                <span class="doc-card-title">${esc(item.title || item.slug.toUpperCase())}</span>
                ${ratingHtml}
              </div>
              <div class="doc-card-sub">${esc(item.subtitle || item.slug)}</div>
              ${tagsHtml ? `<div class="doc-card-tags">${tagsHtml}</div>` : ''}
            </div>
          `;
        })
        .join('')}
    </div>`;
  }
}
