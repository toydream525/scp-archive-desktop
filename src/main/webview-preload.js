const { ipcRenderer } = require('electron');

let styleEl = null;
let scrollTimer = null;

function ensureStyleEl() {
  if (styleEl && styleEl.isConnected) return styleEl;
  styleEl = document.getElementById('scp-client-enhancements');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'scp-client-enhancements';
    (document.head || document.documentElement).appendChild(styleEl);
  }
  return styleEl;
}

function buildEnhancementCss(opts = {}) {
  const rules = [];
  const fontSize = Number(opts.fontSize) || 16;
  const lineHeight = Number(opts.lineHeight) || 1.75;
  const contentWidth = Number(opts.contentWidth) || 0;

  rules.push(`
    #page-content,
    #page-content p,
    #page-content li,
    #page-content blockquote,
    #page-content td,
    #page-content th {
      font-size: ${fontSize}px !important;
      line-height: ${lineHeight} !important;
    }
    #page-content h1 { font-size: ${Math.round(fontSize * 1.45)}px !important; }
    #page-content h2 { font-size: ${Math.round(fontSize * 1.25)}px !important; }
    #page-content h3 { font-size: ${Math.round(fontSize * 1.12)}px !important; }
  `);

  if (opts.originalSimplifyChrome) {
    rules.push(`
      #header, #side-bar, #footer, #license-area, #page-options-container, .page-options-bottom, #navi-bar, #navi-bar-shadow, #extrac-div-1, #extrac-div-2, #extrac-div-3 {
        display: none !important;
      }
      #content-wrap {
        margin: 0 auto !important;
        padding: 16px 24px 64px !important;
        max-width: ${contentWidth > 0 ? `${contentWidth + 48}px` : '1200px'} !important;
        min-height: 100vh !important;
      }
      #main-content {
        margin: 0 auto !important;
        padding: 0 !important;
        max-width: ${contentWidth > 0 ? `${contentWidth}px` : '100%'} !important;
      }
    `);
  } else if (contentWidth > 0) {
    rules.push(`
      #main-content {
        max-width: ${contentWidth}px !important;
      }
    `);
  }

  if (opts.theme === 'dark') {
    rules.push(`
      html {
        filter: invert(0.89) hue-rotate(180deg) !important;
        background: #14171d !important;
      }
      img, video, canvas, iframe, svg {
        filter: invert(1) hue-rotate(180deg) !important;
      }
    `);
  } else if (opts.theme === 'sepia') {
    rules.push(`
      html {
        filter: sepia(0.24) brightness(0.96) contrast(0.96) !important;
      }
    `);
  }

  return rules.join('\n');
}

function applyEnhancements(opts) {
  const el = ensureStyleEl();
  el.textContent = buildEnhancementCss(opts);
}

function toggleAllCollapsibles(expand) {
  const blocks = document.querySelectorAll('.collapsible-block');
  let count = 0;
  blocks.forEach((block) => {
    const folded = block.querySelector(':scope > .collapsible-block-folded');
    const unfolded = block.querySelector(':scope > .collapsible-block-unfolded');
    if (folded && unfolded) {
      folded.style.display = expand ? 'none' : 'block';
      unfolded.style.display = expand ? 'block' : 'none';
      count++;
    }
  });
  return count;
}

function collectPageMeta() {
  const titleEl = document.querySelector('#page-title');
  const title = titleEl ? titleEl.textContent.trim() : document.title.replace(/\s*-\s*SCP.*$/i, '').trim();
  const rateEl = document.querySelector('.page-rate-widget-box .number, .rate-points .number');
  let rating = null;
  if (rateEl) {
    const m = rateEl.textContent.match(/[+-]?\d+/);
    if (m) rating = parseInt(m[0], 10);
  }
  const tags = Array.from(document.querySelectorAll('.page-tags a'))
    .map((a) => a.textContent.trim())
    .filter((t) => t && !t.startsWith('_'));

  ipcRenderer.sendToHost('scp-page-meta', {
    url: window.location.href,
    title,
    rating,
    tags
  });
}

ipcRenderer.on('scp-apply-enhancements', (_ev, opts) => {
  applyEnhancements(opts);
});

ipcRenderer.on('scp-toggle-collapsibles', (_ev, expand) => {
  const count = toggleAllCollapsibles(Boolean(expand));
  ipcRenderer.sendToHost('scp-collapsibles-toggled', { expand: Boolean(expand), count });
});

ipcRenderer.on('scp-restore-scroll', (_ev, data) => {
  if (!data) return;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const targetY = typeof data.ratio === 'number' && data.ratio > 0 ? Math.round(maxScroll * data.ratio) : (data.scrollTop || 0);
  if (targetY > 40) {
    window.scrollTo({ top: targetY, behavior: 'smooth' });
  }
});

window.addEventListener('DOMContentLoaded', () => {
  collectPageMeta();
});

window.addEventListener('load', () => {
  collectPageMeta();
});

window.addEventListener(
  'scroll',
  () => {
    if (scrollTimer) clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const ratio = Math.max(0, Math.min(1, scrollTop / maxScroll));
      ipcRenderer.sendToHost('scp-scroll', { ratio, scrollTop });
    }, 500);
  },
  { passive: true }
);

// Intercept Ctrl+Click / Middle-Click to open in a new tab in the client
document.addEventListener(
  'click',
  (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.href;
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;
    if (e.ctrlKey || e.metaKey || e.button === 1) {
      e.preventDefault();
      e.stopPropagation();
      ipcRenderer.sendToHost('scp-open-new-tab', { href });
    }
  },
  true
);

document.addEventListener(
  'auxclick',
  (e) => {
    if (e.button !== 1) return;
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.href;
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;
    e.preventDefault();
    e.stopPropagation();
    ipcRenderer.sendToHost('scp-open-new-tab', { href });
  },
  true
);
