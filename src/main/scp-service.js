const { net, session } = require('electron');
const cheerio = require('cheerio');
const { getBranch, listBranches } = require('../shared/branches');
const { WEB_PARTITION } = require('./auth-service');

class ScpService {
  constructor(store) {
    this.store = store;
  }

  getSharedSession() {
    return session.fromPartition(WEB_PARTITION);
  }

  listBranches() {
    return listBranches();
  }

  getSeriesDefinitions(siteId) {
    const branch = getBranch(siteId);
    return branch.series || [];
  }

  async fetchWithProxy(url, options = {}) {
    const timeoutMs = options.timeoutMs || 18000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        ...(options.headers || {})
      };
      const response = await net.fetch(url, {
        session: this.getSharedSession(),
        method: options.method || 'GET',
        headers,
        body: options.body,
        signal: controller.signal
      });
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  normalizeSlug(raw) {
    if (!raw) return 'main';
    let s = String(raw).trim();
    s = s.replace(/^\/+/, '').replace(/\/+$/, '');
    s = s.split('#')[0].split('?')[0];
    return s.toLowerCase() || 'main';
  }

  detectSiteFromUrl(rawUrl) {
    try {
      const u = new URL(rawUrl);
      const host = u.hostname.toLowerCase();
      for (const branch of listBranches()) {
        const customHost = (() => {
          try {
            return new URL(this.store.getBaseUrl(branch.id)).hostname.toLowerCase();
          } catch {
            return '';
          }
        })();
        if (host === customHost || (branch.hostMatchers || []).some((m) => host === m || host.endsWith(`.${m}`))) {
          return { site: branch.id, slug: this.normalizeSlug(u.pathname) };
        }
      }
    } catch {
      // ignore invalid url
    }
    return null;
  }

  resolveAbsoluteUrl(href, baseUrl) {
    if (!href) return '';
    const trimmed = href.trim();
    if (trimmed.startsWith('javascript:') || trimmed.startsWith('#') || trimmed.startsWith('data:')) {
      return trimmed;
    }
    if (trimmed.startsWith('//')) {
      return `https:${trimmed}`;
    }
    try {
      return new URL(trimmed, `${baseUrl}/`).toString();
    } catch {
      return trimmed;
    }
  }

  parseArticleHtml(rawHtml, { site, slug, url }) {
    const baseUrl = this.store.getBaseUrl(site);
    const $ = cheerio.load(rawHtml);

    const pageTitle =
      $('#page-title').first().text().trim() ||
      $('title').first().text().replace(/\s*-\s*SCP.*$/i, '').trim() ||
      slug.toUpperCase();

    const createLink = $('a[id="create-page-button"], a[onclick*="createPage"]').length > 0;
    const bodyTextLower = ($('#page-content').text() || '').toLowerCase();
    const notFound =
      createLink ||
      bodyTextLower.includes("this page doesn't exist yet") ||
      bodyTextLower.includes('此页面尚不存在') ||
      bodyTextLower.includes('这个页面还不存在');

    let rating = null;
    const ratingText = $('.page-rate-widget-box .number, .rate-points .number').first().text().trim();
    if (ratingText) {
      const m = ratingText.match(/[+-]?\d+/);
      if (m) rating = parseInt(m[0], 10);
    }

    const tags = [];
    $('.page-tags a').each((_, el) => {
      const t = $(el).text().trim();
      if (t && !t.startsWith('_')) tags.push(t);
    });

    const breadcrumbs = [];
    $('#breadcrumbs a').each((_, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim();
      if (text && href) {
        const abs = this.resolveAbsoluteUrl(href, baseUrl);
        const det = this.detectSiteFromUrl(abs);
        breadcrumbs.push({
          text,
          slug: det ? det.slug : this.normalizeSlug(href),
          site: det ? det.site : site
        });
      }
    });

    const contentEl = $('#page-content').first();
    if (!contentEl.length) {
      return {
        site,
        slug,
        url,
        title: pageTitle,
        rating,
        tags,
        breadcrumbs,
        notFound: true,
        hasComplexInteractive: false,
        toc: [],
        images: [],
        excerpt: '',
        cleanHtml: '',
        fetchedAt: Date.now()
      };
    }

    const $c = cheerio.load(`<div id="scp-clean-root">${contentEl.html()}</div>`);
    const root = $c('#scp-clean-root');

    const iframeCount = root.find('iframe.html-block-iframe, iframe').length;
    const mediaInteractive = root.find('canvas, audio, video').length;
    let totalStyleChars = 0;
    root.find('style').each((_, el) => {
      totalStyleChars += ($c(el).html() || '').length;
    });
    const hasComplexInteractive = iframeCount > 0 || mediaInteractive > 0 || totalStyleChars > 800;

    root
      .find(
        'script, style, .page-rate-widget-box, .creditRate, #u-credit-view, #u-credit-otherwise, .rate-box-with-credit-button, .heritage-rating-module, .modalcontainer, .modalbox'
      )
      .remove();

    // Footnote references
    root.find('a.footnoteref').each((_, el) => {
      const $el = $c(el);
      const onclick = $el.attr('onclick') || '';
      const m = onclick.match(/footnote-\d+/);
      if (m) $el.attr('data-footnote-target', m[0]);
      $el.attr('href', 'javascript:;');
      $el.removeAttr('onclick');
    });

    // Footnote backlinks
    root.find('.footnote-footer a').each((_, el) => {
      const $el = $c(el);
      const onclick = $el.attr('onclick') || '';
      const m = onclick.match(/footnoteref-\d+/);
      if (m) {
        $el.attr('data-footnote-back', m[0]);
        $el.attr('href', 'javascript:;');
        $el.removeAttr('onclick');
      }
    });

    // Collapsibles
    root.find('.collapsible-block-link').each((_, el) => {
      const $el = $c(el);
      $el.attr('href', 'javascript:;');
      $el.removeAttr('onclick');
    });

    // Images
    const imageSet = new Set();
    root.find('img').each((_, el) => {
      const $img = $c(el);
      const rawSrc = $img.attr('src') || $img.attr('data-src');
      if (!rawSrc) return;
      const absSrc = this.resolveAbsoluteUrl(rawSrc, baseUrl);
      $img.attr('src', absSrc);
      $img.attr('data-orig-src', absSrc);
      $img.attr('loading', 'lazy');
      $img.attr('referrerpolicy', 'no-referrer');
      if (absSrc.startsWith('http://') || absSrc.startsWith('https://')) {
        imageSet.add(absSrc);
      }
    });

    // Links
    root.find('a').each((_, el) => {
      const $a = $c(el);
      if ($a.hasClass('collapsible-block-link') || $a.hasClass('footnoteref') || $a.attr('data-footnote-back')) {
        return;
      }
      if ($a.closest('.yui-nav').length > 0) {
        $a.attr('href', 'javascript:;');
        $a.removeAttr('onclick');
        return;
      }
      const rawHref = $a.attr('href');
      if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:')) return;
      const absHref = this.resolveAbsoluteUrl(rawHref, baseUrl);
      $a.attr('href', absHref);
      const detected = this.detectSiteFromUrl(absHref);
      if (detected && !detected.slug.startsWith('local--files/')) {
        $a.attr('data-scp-site', detected.site);
        $a.attr('data-scp-slug', detected.slug);
      }
    });

    // Iframes notice
    root.find('iframe').each((_, el) => {
      $c(el).replaceWith(
        '<div class="scp-iframe-notice" data-iframe-placeholder="1"><span class="scp-iframe-text"></span><button class="scp-inline-switch-btn" data-action="switch-original"></button></div>'
      );
    });

    // TOC extraction
    const toc = [];
    let headingIdx = 0;
    root.find('h1, h2, h3, h4').each((_, el) => {
      const $h = $c(el);
      const text = $h.text().trim();
      if (!text || text.length > 100) return;
      const id = `scp-toc-${headingIdx++}`;
      $h.attr('id', id);
      const level = parseInt(el.tagName.replace('h', ''), 10) || 2;
      toc.push({ id, level, text });
    });

    const excerpt = root.text().replace(/\s+/g, ' ').trim().slice(0, 180);

    return {
      site,
      slug,
      url,
      title: pageTitle,
      rating,
      tags,
      breadcrumbs,
      notFound,
      hasComplexInteractive,
      toc,
      images: Array.from(imageSet),
      excerpt,
      cleanHtml: root.html() || '',
      fetchedAt: Date.now()
    };
  }

  async fetchArticle(siteId, rawSlug) {
    const branch = getBranch(siteId);
    const slug = this.normalizeSlug(rawSlug);
    const baseUrl = this.store.getBaseUrl(branch.id);
    const url = `${baseUrl}/${slug}`;

    const res = await this.fetchWithProxy(url);
    const html = await res.text();
    const parsed = this.parseArticleHtml(html, { site: branch.id, slug, url });
    if (res.status === 404) {
      parsed.notFound = true;
    }
    return {
      ...parsed,
      rawHtml: html,
      httpStatus: res.status
    };
  }

  async fetchSeriesCatalog(siteId, seriesSlug, { forceRefresh = false } = {}) {
    const branch = getBranch(siteId);
    const slug = this.normalizeSlug(seriesSlug);

    if (!forceRefresh) {
      const cached = this.store.getSeriesCache(branch.id, slug);
      if (cached && Array.isArray(cached.items) && cached.items.length > 0) {
        return cached;
      }
    }

    const baseUrl = this.store.getBaseUrl(branch.id);
    const url = `${baseUrl}/${slug}`;
    const res = await this.fetchWithProxy(url, { timeoutMs: 25000 });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const html = await res.text();
    const $ = cheerio.load(html);
    const content = $('#page-content');

    const items = [];
    const seen = new Set();
    let currentSection = '';

    content.find('h1, h2, h3, li, .content-panel p').each((_, el) => {
      const tag = el.tagName.toLowerCase();
      if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
        const txt = $(el).text().trim();
        if (txt && txt.length < 80) currentSection = txt;
        return;
      }
      const $el = $(el);
      const $firstLink = $el.children('a').first().length ? $el.children('a').first() : $el.find('a').first();
      if (!$firstLink.length) return;
      const href = $firstLink.attr('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      const abs = this.resolveAbsoluteUrl(href, baseUrl);
      const det = this.detectSiteFromUrl(abs);
      if (!det) return;
      const itemSlug = det.slug;

      if (
        !itemSlug ||
        itemSlug === slug ||
        itemSlug.startsWith('scp-series') ||
        itemSlug.startsWith('system:') ||
        itemSlug.startsWith('forum:') ||
        itemSlug.startsWith('local--')
      ) {
        return;
      }

      const isMainSeries = slug.startsWith('scp-series');
      if (isMainSeries && !/^scp-([a-z]{2,3}-)?\d+/i.test(itemSlug)) {
        return;
      }

      if (seen.has(itemSlug)) return;
      seen.add(itemSlug);

      const code = $firstLink.text().trim();
      const clone = $el.clone();
      clone.find('ul, ol').remove();
      const fullText = clone.text().replace(/\s+/g, ' ').trim();
      let subtitle = fullText;
      if (code && subtitle.startsWith(code)) {
        subtitle = subtitle.slice(code.length).replace(/^[\s\-–—:：]+/, '').trim();
      }
      const isNewPage = $firstLink.hasClass('newpage');

      items.push({
        site: det.site,
        slug: itemSlug,
        code: code || itemSlug.toUpperCase(),
        subtitle: subtitle || '',
        section: currentSection,
        unwritten: isNewPage
      });
    });

    const title = $('#page-title').first().text().trim() || slug;
    return this.store.setSeriesCache(branch.id, slug, {
      site: branch.id,
      seriesSlug: slug,
      title,
      items
    });
  }

  async cromQuery(query, variables = {}) {
    const cromUrl = this.store.getSettings().cromApiUrl || 'https://api.crom.avn.sh/graphql';
    const res = await this.fetchWithProxy(cromUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      timeoutMs: 12000
    });
    if (!res.ok) throw new Error(`Crom API HTTP ${res.status}`);
    const json = await res.json();
    if (json.errors && json.errors.length > 0) throw new Error(json.errors[0].message);
    return json.data;
  }

  _mapCromNode(node, fallbackSite) {
    const det = this.detectSiteFromUrl(node.url);
    const site = det ? det.site : fallbackSite;
    const slug = det ? det.slug : this.normalizeSlug(node.url);
    const info = node.wikidotInfo || {};
    const altTitle =
      Array.isArray(node.alternateTitles) && node.alternateTitles.length > 0 ? node.alternateTitles[0].title : '';
    return {
      site,
      slug,
      title: info.title || slug.toUpperCase(),
      subtitle: altTitle || '',
      rating: info.rating ?? null,
      tags: (info.tags || []).filter((t) => !t.startsWith('_') && !t.startsWith('crom:')),
      createdAt: info.createdAt || null
    };
  }

  async searchPages(siteId, keyword) {
    const branch = getBranch(siteId);
    const q = String(keyword || '').trim();
    if (!q) return [];

    try {
      const data = await this.cromQuery(
        `
        query Search($q: String!, $urls: [String!]) {
          searchPages(query: $q, filter: { anyBaseUrl: $urls }) {
            url
            wikidotInfo { title rating tags createdAt }
            alternateTitles { title }
          }
        }
        `,
        { q, urls: [branch.cromBaseUrl] }
      );
      const list = (data.searchPages || []).map((n) => this._mapCromNode(n, branch.id));
      if (list.length > 0) return list;
    } catch {
      // fallback below
    }

    try {
      const baseUrl = this.store.getBaseUrl(branch.id);
      const searchUrl = `${baseUrl}/search:site/q/${encodeURIComponent(q)}`;
      const res = await this.fetchWithProxy(searchUrl, { timeoutMs: 15000 });
      const html = await res.text();
      const $ = cheerio.load(html);
      const results = [];
      $('.search-results .item').each((_, el) => {
        const $a = $(el).find('.title a').first();
        const href = $a.attr('href');
        const title = $a.text().trim();
        const preview = $(el).find('.preview').text().replace(/\s+/g, ' ').trim();
        if (!href) return;
        const abs = this.resolveAbsoluteUrl(href, baseUrl);
        const det = this.detectSiteFromUrl(abs);
        if (!det) return;
        results.push({
          site: det.site,
          slug: det.slug,
          title: title || det.slug,
          subtitle: preview.slice(0, 120),
          rating: null,
          tags: [],
          createdAt: null
        });
      });
      return results;
    } catch {
      return [];
    }
  }

  async searchByTag(siteId, tag, limit = 30) {
    const branch = getBranch(siteId);
    const cleanTag = String(tag || '').trim().toLowerCase();
    if (!cleanTag) return [];
    const data = await this.cromQuery(
      `
      query ByTag($prefix: String!, $tag: String!, $first: Int!) {
        pages(
          first: $first,
          sort: { key: RATING, order: DESC },
          filter: { url: { startsWith: $prefix }, wikidotInfo: { tags: { eq: $tag } } }
        ) {
          edges {
            node {
              url
              wikidotInfo { title rating tags createdAt }
              alternateTitles { title }
            }
          }
        }
      }
      `,
      {
        prefix: `${branch.cromBaseUrl}/`,
        tag: cleanTag,
        first: limit
      }
    );
    return (data.pages?.edges || []).map((e) => this._mapCromNode(e.node, branch.id));
  }

  async getRandomPage(siteId, category = 'scp') {
    const branch = getBranch(siteId);
    const key = category === 'cn-original' ? 'original' : category;
    const allTags = (branch.tagMap && branch.tagMap[key]) || ['scp'];

    try {
      const data = await this.cromQuery(
        `
        query Random($urls: [String!], $tags: [String!]) {
          randomPage(filter: { anyBaseUrl: $urls, allTags: $tags }) {
            page {
              url
              wikidotInfo { title rating tags createdAt }
              alternateTitles { title }
            }
          }
        }
        `,
        { urls: [branch.cromBaseUrl], tags: allTags }
      );
      if (data.randomPage?.page) {
        return this._mapCromNode(data.randomPage.page, branch.id);
      }
    } catch {
      // fallback below
    }

    const num = Math.floor(Math.random() * 6998) + 2;
    const padded = num < 1000 ? String(num).padStart(3, '0') : String(num);
    return {
      site: branch.id,
      slug: `scp-${padded}`,
      title: `SCP-${padded}`,
      subtitle: '',
      rating: null,
      tags: ['scp']
    };
  }

  async getDiscoverPages(siteId, { sortKey = 'RATING', tag = 'scp', limit = 20 } = {}) {
    const branch = getBranch(siteId);
    const validSort = ['RATING', 'CREATED_AT'].includes(sortKey) ? sortKey : 'RATING';
    const data = await this.cromQuery(
      `
      query Discover($prefix: String!, $tag: String!, $first: Int!) {
        pages(
          first: $first,
          sort: { key: ${validSort}, order: DESC },
          filter: { url: { startsWith: $prefix }, wikidotInfo: { tags: { eq: $tag } } }
        ) {
          edges {
            node {
              url
              wikidotInfo { title rating tags createdAt }
              alternateTitles { title }
            }
          }
        }
      }
      `,
      {
        prefix: `${branch.cromBaseUrl}/`,
        tag,
        first: limit
      }
    );
    return (data.pages?.edges || []).map((e) => this._mapCromNode(e.node, branch.id));
  }

  async testConnectivity() {
    const settings = this.store.getSettings();
    const targets = [
      ...listBranches().map((b) => ({
        key: b.id,
        name: b.names?.['zh-CN'] || b.id.toUpperCase(),
        code: b.code,
        url: `${this.store.getBaseUrl(b.id)}/scp-173`
      })),
      {
        key: 'crom',
        name: 'Crom GraphQL API',
        code: 'API',
        url: settings.cromApiUrl || 'https://api.crom.avn.sh/graphql',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: '{ sites { shortName } }' })
      }
    ];

    return Promise.all(
      targets.map(async (t) => {
        const start = Date.now();
        try {
          const res = await this.fetchWithProxy(t.url, {
            method: t.method || 'GET',
            headers: t.headers,
            body: t.body,
            timeoutMs: 10000
          });
          return {
            key: t.key,
            name: t.name,
            code: t.code,
            url: t.url,
            ok: res.ok,
            status: res.status,
            latencyMs: Date.now() - start
          };
        } catch (err) {
          return {
            key: t.key,
            name: t.name,
            code: t.code,
            url: t.url,
            ok: false,
            status: 0,
            latencyMs: Date.now() - start,
            error: err.message || String(err)
          };
        }
      })
    );
  }
}

module.exports = { ScpService };
