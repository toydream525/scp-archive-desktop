const fs = require('fs');
const path = require('path');
const { dialog } = require('electron');
const cheerio = require('cheerio');
const TurndownService = require('turndown');
const { gfm } = require('turndown-plugin-gfm');

class ExportService {
  constructor(cacheService) {
    this.cacheService = cacheService;
  }

  _sanitizeFileName(name) {
    return String(name || 'scp-document')
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  }

  _restoreOnlineImageUrls(html) {
    const $ = cheerio.load(`<div id="exp">${html || ''}</div>`);
    $('#exp img').each((_, el) => {
      const $img = $(el);
      const orig = $img.attr('data-orig-src');
      if (orig) $img.attr('src', orig);
    });
    return $('#exp').html() || '';
  }

  _embedCachedImagesAsDataUri(html) {
    const $ = cheerio.load(`<div id="exp">${html || ''}</div>`);
    $('#exp img').each((_, el) => {
      const $img = $(el);
      const src = $img.attr('src') || '';
      if (src.startsWith('scp-cache://assets/')) {
        const fname = src.replace('scp-cache://assets/', '');
        const assetPath = this.cacheService.getAssetPath(fname);
        if (assetPath && fs.existsSync(assetPath)) {
          try {
            const buf = fs.readFileSync(assetPath);
            const ext = path.extname(assetPath).slice(1).toLowerCase();
            const mimeMap = {
              png: 'image/png',
              jpg: 'image/jpeg',
              jpeg: 'image/jpeg',
              gif: 'image/gif',
              webp: 'image/webp',
              svg: 'image/svg+xml'
            };
            const mime = mimeMap[ext] || 'application/octet-stream';
            $img.attr('src', `data:${mime};base64,${buf.toString('base64')}`);
            return;
          } catch {
            // fallback to original URL
          }
        }
        const orig = $img.attr('data-orig-src');
        if (orig) $img.attr('src', orig);
      }
    });
    return $('#exp').html() || '';
  }

  toMarkdown(article) {
    const td = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-'
    });
    td.use(gfm);

    // Convert Wikidot collapsible blocks into native Markdown <details><summary>
    td.addRule('scpCollapsible', {
      filter: (node) => node.nodeName === 'DIV' && node.classList && node.classList.contains('collapsible-block'),
      replacement: (_content, node) => {
        const folded = node.querySelector('.collapsible-block-folded .collapsible-block-link');
        const body = node.querySelector('.collapsible-block-content');
        const summary = folded ? folded.textContent.trim() : '展开内容';
        const innerMd = body ? td.turndown(body.innerHTML).trim() : '';
        return `\n\n<details>\n<summary>${summary}</summary>\n\n${innerMd}\n\n</details>\n\n`;
      }
    });

    // Preserve strikethrough spans used by Wikidot
    td.addRule('wikidotStrike', {
      filter: (node) => node.nodeName === 'SPAN' && /line-through/i.test(node.getAttribute('style') || ''),
      replacement: (content) => `~~${content}~~`
    });

    const html = this._restoreOnlineImageUrls(article.cleanHtml || '');
    const bodyMd = td.turndown(html);

    const metaLines = [
      `# ${article.title || article.slug}`,
      '',
      `- **站点**: ${article.site === 'en' ? 'SCP Foundation (EN)' : 'SCP 基金会中文分部 (CN)'}`,
      `- **条目**: \`${article.slug}\``,
      article.url ? `- **原文链接**: ${article.url}` : null,
      article.rating !== null && article.rating !== undefined ? `- **评分**: ${article.rating >= 0 ? `+${article.rating}` : article.rating}` : null,
      article.tags && article.tags.length > 0 ? `- **标签**: ${article.tags.map((t) => `\`${t}\``).join(' ')}` : null,
      `- **导出时间**: ${new Date().toLocaleString('zh-CN')}`,
      '',
      '---',
      '',
      bodyMd,
      '',
      '---',
      '',
      `> 本文内容源自 SCP 基金会维基（${article.url || 'https://scp-wiki-cn.wikidot.com'}），依据 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) 协议共享。`,
      `> Content from the SCP Foundation Wiki (${article.url || 'https://scp-wiki.wikidot.com'}), licensed under [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/).`
    ].filter((line) => line !== null);

    return metaLines.join('\n');
  }

  toStandaloneHtml(article, { embedImages = true } = {}) {
    const contentHtml = embedImages
      ? this._embedCachedImagesAsDataUri(article.cleanHtml || '')
      : this._restoreOnlineImageUrls(article.cleanHtml || '');

    const title = this._escapeHtml(article.title || article.slug);
    const branchLabel = article.site === 'en' ? 'SCP Foundation (EN)' : 'SCP 基金会中文分部 (CN)';
    const tagsHtml = (article.tags || [])
      .map((t) => `<span class="tag">${this._escapeHtml(t)}</span>`)
      .join('');
    const ratingStr = article.rating !== null && article.rating !== undefined
      ? `评分: ${article.rating >= 0 ? `+${article.rating}` : article.rating}`
      : '';

    return `<!DOCTYPE html>
<html lang="${article.site === 'en' ? 'en' : 'zh-CN'}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - SCP Archive Export</title>
  <style>
    :root { --bg:#f8f9fa; --card:#ffffff; --text:#1f2328; --muted:#57606a; --accent:#990011; --border:#d8dee4; --quote:#f3f4f6; }
    @media (prefers-color-scheme: dark) {
      :root { --bg:#111318; --card:#181b22; --text:#e6edf3; --muted:#8b949e; --accent:#e05260; --border:#2d333b; --quote:#20252e; }
    }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px 16px; background: var(--bg); color: var(--text); font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; line-height: 1.75; }
    .container { max-width: 860px; margin: 0 auto; background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 36px 44px; }
    header { border-bottom: 2px solid var(--accent); padding-bottom: 16px; margin-bottom: 24px; }
    h1.doc-title { margin: 0 0 8px; font-size: 28px; color: var(--accent); }
    .meta { font-size: 13px; color: var(--muted); display: flex; flex-wrap: wrap; gap: 14px; }
    .meta a { color: var(--accent); }
    .tags { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
    .tag { font-size: 12px; padding: 2px 8px; border-radius: 4px; background: var(--quote); border: 1px solid var(--border); color: var(--muted); }
    blockquote { margin: 16px 0; padding: 12px 18px; border-left: 4px solid var(--accent); background: var(--quote); border-radius: 0 6px 6px 0; }
    img { max-width: 100%; height: auto; border-radius: 6px; }
    .scp-image-block { float: right; margin: 0 0 16px 20px; max-width: 300px; border: 1px solid var(--border); background: var(--quote); border-radius: 6px; overflow: hidden; }
    .scp-image-block img { display: block; width: 100%; border-radius: 0; }
    .scp-image-caption { padding: 8px 10px; font-size: 12px; text-align: center; color: var(--muted); }
    .collapsible-block { margin: 14px 0; border: 1px solid var(--border); border-radius: 6px; padding: 10px 14px; background: var(--quote); }
    .collapsible-block-link { color: var(--accent); font-weight: 600; text-decoration: none; cursor: pointer; }
    .yui-nav { list-style: none; padding: 0; margin: 0; display: flex; gap: 4px; border-bottom: 1px solid var(--border); flex-wrap: wrap; }
    .yui-nav li a { display: block; padding: 6px 12px; text-decoration: none; color: var(--text); border: 1px solid transparent; border-bottom: none; border-radius: 4px 4px 0 0; }
    .yui-nav li.selected a { background: var(--quote); border-color: var(--border); color: var(--accent); font-weight: 600; }
    .yui-content { padding: 14px; border: 1px solid var(--border); border-top: none; }
    table.wiki-content-table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    table.wiki-content-table th, table.wiki-content-table td { border: 1px solid var(--border); padding: 8px 10px; }
    hr { border: none; border-top: 1px solid var(--border); margin: 20px 0; }
    .export-toolbar { margin-bottom: 14px; }
    .export-toolbar button { padding: 5px 12px; border: 1px solid var(--border); background: var(--quote); color: var(--text); border-radius: 5px; cursor: pointer; }
  </style>
</head>
<body>
  <article class="container">
    <header>
      <h1 class="doc-title">${title}</h1>
      <div class="meta">
        <span>${branchLabel}</span>
        ${ratingStr ? `<span>${ratingStr}</span>` : ''}
        ${article.url ? `<a href="${this._escapeHtml(article.url)}" target="_blank">${this._escapeHtml(article.url)}</a>` : ''}
      </div>
      ${tagsHtml ? `<div class="tags">${tagsHtml}</div>` : ''}
    </header>
    <div class="export-toolbar">
      <button onclick="toggleAll(true)">展开所有折叠块</button>
      <button onclick="toggleAll(false)">收起所有折叠块</button>
    </div>
    <div id="content">${contentHtml}</div>
    <footer style="margin-top:32px;padding-top:14px;border-top:1px solid var(--border);font-size:12px;color:var(--muted);line-height:1.6;">
      <div>本文内容源自 SCP 基金会维基（${article.url ? `<a href="${this._escapeHtml(article.url)}" target="_blank" style="color:var(--accent);">${this._escapeHtml(article.url)}</a>` : 'https://scp-wiki-cn.wikidot.com'}），遵循 <a href="https://creativecommons.org/licenses/by-sa/3.0/deed.zh" target="_blank" style="color:var(--accent);">CC BY-SA 3.0</a> 知识共享协议。</div>
      <div>Content relating to the SCP Foundation is licensed under <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" style="color:var(--accent);">Creative Commons Attribution-ShareAlike 3.0 (CC BY-SA 3.0)</a>. Exported by SCP Archive (Open Source / MIT).</div>
    </footer>
  </article>
  <script>
    document.addEventListener('click', function (e) {
      var link = e.target.closest('.collapsible-block-link');
      if (link) {
        e.preventDefault();
        var block = link.closest('.collapsible-block');
        var folded = block.querySelector(':scope > .collapsible-block-folded');
        var unfolded = block.querySelector(':scope > .collapsible-block-unfolded');
        if (folded && unfolded) {
          var isOpening = unfolded.style.display === 'none' || getComputedStyle(unfolded).display === 'none';
          folded.style.display = isOpening ? 'none' : 'block';
          unfolded.style.display = isOpening ? 'block' : 'none';
        }
      }
      var tabLink = e.target.closest('.yui-nav li a');
      if (tabLink) {
        e.preventDefault();
        var li = tabLink.closest('li');
        var navset = li.closest('.yui-navset');
        var lis = Array.from(navset.querySelectorAll(':scope > .yui-nav > li'));
        var idx = lis.indexOf(li);
        lis.forEach((item, i) => item.classList.toggle('selected', i === idx));
        var panels = Array.from(navset.querySelectorAll(':scope > .yui-content > div'));
        panels.forEach((p, i) => { p.style.display = i === idx ? 'block' : 'none'; });
      }
    });
    function toggleAll(expand) {
      document.querySelectorAll('.collapsible-block').forEach(function (block) {
        var folded = block.querySelector(':scope > .collapsible-block-folded');
        var unfolded = block.querySelector(':scope > .collapsible-block-unfolded');
        if (folded && unfolded) {
          folded.style.display = expand ? 'none' : 'block';
          unfolded.style.display = expand ? 'block' : 'none';
        }
      });
    }
  </script>
</body>
</html>`;
  }

  _escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  async exportArticle(win, article, format = 'markdown') {
    const isHtml = format === 'html';
    const ext = isHtml ? 'html' : 'md';
    const defaultName = `${this._sanitizeFileName(article.title || article.slug)}.${ext}`;

    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: isHtml ? '导出为单文件 HTML' : '导出为 Markdown',
      defaultPath: defaultName,
      filters: isHtml
        ? [{ name: 'HTML 文档', extensions: ['html', 'htm'] }]
        : [{ name: 'Markdown 文档', extensions: ['md'] }]
    });

    if (canceled || !filePath) {
      return { canceled: true };
    }

    const content = isHtml ? this.toStandaloneHtml(article, { embedImages: true }) : this.toMarkdown(article);
    fs.writeFileSync(filePath, content, 'utf-8');
    return { canceled: false, filePath };
  }
}

module.exports = { ExportService };
