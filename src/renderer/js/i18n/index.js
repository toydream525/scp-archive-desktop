import zhCN from './zh-CN.js';
import enUS from './en-US.js';

/**
 * Extensible client i18n manager.
 *
 * Adding a new language (e.g., Japanese):
 *   1. Create `src/renderer/js/i18n/ja-JP.js` mirroring the key structure of `en-US.js`.
 *   2. Import and call:
 *        registerLocale('ja-JP', { label: '日本語', shortLabel: 'JA', langAttr: 'ja' }, jaJP);
 *   3. Optionally add a Japanese branch in `src/shared/branches.js` (`scp-jp.wikidot.com`).
 */

const locales = new Map();
const listeners = new Set();
let currentLocale = 'zh-CN';

export function registerLocale(code, meta, messages) {
  locales.set(code, {
    code,
    label: meta.label || code,
    shortLabel: meta.shortLabel || code.slice(0, 2).toUpperCase(),
    langAttr: meta.langAttr || code,
    messages
  });
}

// Register built-in languages
registerLocale('zh-CN', { label: '简体中文', shortLabel: '中', langAttr: 'zh-CN' }, zhCN);
registerLocale('en-US', { label: 'English', shortLabel: 'EN', langAttr: 'en' }, enUS);

function lookup(messages, key) {
  if (!messages) return undefined;
  const parts = key.split('.');
  let node = messages;
  for (const part of parts) {
    if (node && typeof node === 'object' && part in node) {
      node = node[part];
    } else {
      return undefined;
    }
  }
  return typeof node === 'string' ? node : undefined;
}

export function getLocale() {
  return currentLocale;
}

export function getLocaleMeta(code = currentLocale) {
  return locales.get(code) || locales.get('zh-CN');
}

export function getAvailableLocales() {
  return Array.from(locales.values()).map(({ code, label, shortLabel, langAttr }) => ({
    code,
    label,
    shortLabel,
    langAttr
  }));
}

export function setLocale(code) {
  const next = locales.has(code) ? code : 'zh-CN';
  currentLocale = next;
  const meta = locales.get(next);
  document.documentElement.setAttribute('lang', meta.langAttr || next);
  applyI18nToDom(document);
  for (const fn of listeners) {
    try {
      fn(next, meta);
    } catch {
      // ignore listener errors
    }
  }
  return next;
}

export function onLocaleChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function t(key, vars = {}) {
  const active = locales.get(currentLocale)?.messages;
  const fallbackEn = locales.get('en-US')?.messages;
  const fallbackZh = locales.get('zh-CN')?.messages;

  let text = lookup(active, key);
  if (text === undefined) text = lookup(fallbackEn, key);
  if (text === undefined) text = lookup(fallbackZh, key);
  if (text === undefined) return key;

  return text.replace(/\{(\w+)\}/g, (_m, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`));
}

export function pickLocalized(map, fallback = '') {
  if (!map || typeof map !== 'object') return fallback;
  return map[currentLocale] || map['en-US'] || map['zh-CN'] || Object.values(map)[0] || fallback;
}

export function applyI18nToDom(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder')));
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.setAttribute('title', t(el.getAttribute('data-i18n-title')));
  });
}
