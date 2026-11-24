import { t, setLocale, getAvailableLocales, getLocaleMeta } from './i18n/index.js';

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class DialogsController {
  constructor(app) {
    this.app = app;
    this.openPopoverEl = null;
    this.authState = { loggedIn: false, username: null, profileUrl: null };
    this._bindGlobalDismiss();
    this._bindRandomMenu();
    this._bindExportMenu();
    this._bindAccountMenu();
    this._bindAppearanceMenu();
    this._bindBookmarkPopover();
    this._bindSettingsModal();
  }

  positionAndToggle(popoverId, anchorBtn) {
    const el = document.getElementById(popoverId);
    if (!el) return false;
    const wasOpen = !el.classList.contains('hidden');
    this.closeAllPopovers();
    if (wasOpen) return false;

    const rect = anchorBtn.getBoundingClientRect();
    el.classList.remove('hidden');
    const popRect = el.getBoundingClientRect();
    let left = rect.right - popRect.width;
    if (left < 10) left = Math.max(10, rect.left);
    if (left + popRect.width > window.innerWidth - 10) {
      left = window.innerWidth - popRect.width - 10;
    }
    el.style.top = `${Math.round(rect.bottom + 6)}px`;
    el.style.left = `${Math.round(left)}px`;
    this.openPopoverEl = el;
    return true;
  }

  closeAllPopovers() {
    document.querySelectorAll('.popover').forEach((p) => p.classList.add('hidden'));
    this.openPopoverEl = null;
  }

  _bindGlobalDismiss() {
    document.addEventListener('mousedown', (e) => {
      if (!this.openPopoverEl) return;
      if (this.openPopoverEl.contains(e.target)) return;
      if (e.target.closest('#toolbar')) return;
      this.closeAllPopovers();
    });
    window.addEventListener('resize', () => this.closeAllPopovers());
  }

  _bindRandomMenu() {
    document.getElementById('btn-random-menu').addEventListener('click', (e) => {
      e.stopPropagation();
      this.positionAndToggle('popover-random', e.currentTarget);
    });
    document.querySelectorAll('#popover-random [data-random]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.closeAllPopovers();
        this.app.openRandom(btn.dataset.random);
      });
    });
  }

  _bindExportMenu() {
    document.getElementById('btn-export-menu').addEventListener('click', (e) => {
      e.stopPropagation();
      this.positionAndToggle('popover-export', e.currentTarget);
    });
    document.querySelectorAll('#popover-export [data-export]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        this.closeAllPopovers();
        const tab = this.app.getActiveTab();
        if (!tab || tab.type !== 'article') return;
        const action = btn.dataset.export;
        const url = `${this.app.getBranchBaseUrl(tab.site)}/${tab.slug}`;
        if (action === 'open-browser') {
          window.scpApi.openExternal(url);
        } else if (action === 'copy-url') {
          await navigator.clipboard.writeText(url);
          this.app.showToast(t('toast.urlCopied'), 'ok');
        } else {
          try {
            const res = await window.scpApi.exportArticle(tab.site, tab.slug, action);
            if (!res.canceled && res.filePath) {
              this.app.showToast(t('toast.exportSuccess', { path: res.filePath }), 'ok');
            }
          } catch (err) {
            this.app.showToast(t('toast.exportFailed', { msg: err.message || err }), 'err');
          }
        }
      });
    });
  }

  _bindAccountMenu() {
    const btn = document.getElementById('btn-account-menu');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.updateAccountUI(this.authState);
      this.positionAndToggle('popover-account', btn);
    });

    document.getElementById('btn-do-login').addEventListener('click', async () => {
      this.closeAllPopovers();
      this.app.showToast(t('toast.loginOpened'));
      await window.scpApi.openLogin();
    });

    const doRefresh = async () => {
      const st = await window.scpApi.getAuthStatus({ force: true });
      this.updateAccountUI(st);
      if (st.loggedIn) {
        this.app.showToast(t('toast.loggedIn', { username: st.username }), 'ok');
      } else {
        this.app.showToast(t('toast.notLoggedIn'));
      }
    };
    document.getElementById('btn-refresh-auth').addEventListener('click', doRefresh);
    document.getElementById('btn-refresh-auth-in').addEventListener('click', doRefresh);

    document.getElementById('btn-open-profile').addEventListener('click', () => {
      if (this.authState.profileUrl) {
        window.scpApi.openExternal(this.authState.profileUrl);
      }
      this.closeAllPopovers();
    });

    document.getElementById('btn-do-logout').addEventListener('click', async () => {
      const st = await window.scpApi.logout();
      this.updateAccountUI(st);
      this.closeAllPopovers();
      this.app.showToast(t('toast.loggedOut'));
    });

    window.scpApi.onAuthChanged((st) => {
      const prevLogged = this.authState.loggedIn;
      this.updateAccountUI(st);
      if (st.loggedIn && !prevLogged) {
        this.app.showToast(t('toast.loggedIn', { username: st.username }), 'ok');
      }
    });
  }

  updateAccountUI(state) {
    this.authState = state || { loggedIn: false };
    const btn = document.getElementById('btn-account-menu');
    const lbl = document.getElementById('account-btn-label');
    const statusText = document.getElementById('account-status-text');
    const outBox = document.getElementById('account-actions-signed-out');
    const inBox = document.getElementById('account-actions-signed-in');

    if (this.authState.loggedIn && this.authState.username) {
      btn.classList.add('signed-in');
      lbl.textContent = this.authState.username;
      statusText.textContent = t('accountMenu.signedInAs', { username: this.authState.username });
      outBox.classList.add('hidden');
      inBox.classList.remove('hidden');
    } else {
      btn.classList.remove('signed-in');
      lbl.textContent = t('toolbar.accountLogin');
      statusText.textContent = t('accountMenu.signedOut');
      outBox.classList.remove('hidden');
      inBox.classList.add('hidden');
    }
  }

  _bindAppearanceMenu() {
    document.getElementById('btn-appearance-menu').addEventListener('click', (e) => {
      e.stopPropagation();
      this.syncAppearanceControls();
      this.positionAndToggle('popover-appearance', e.currentTarget);
    });

    document.querySelectorAll('.theme-pill').forEach((btn) => {
      btn.addEventListener('click', () => this.app.patchSettings({ theme: btn.dataset.theme }));
    });

    const fontRange = document.getElementById('range-font-size');
    fontRange.addEventListener('input', () => {
      const v = Number(fontRange.value);
      document.getElementById('val-font-size').textContent = `${v}px`;
      this.app.patchSettings({ fontSize: v });
    });
    document.getElementById('btn-font-dec').addEventListener('click', () => this.app.bumpFontSize(-1));
    document.getElementById('btn-font-inc').addEventListener('click', () => this.app.bumpFontSize(1));

    const lhRange = document.getElementById('range-line-height');
    lhRange.addEventListener('input', () => {
      const v = Number(lhRange.value);
      document.getElementById('val-line-height').textContent = v.toFixed(2);
      this.app.patchSettings({ lineHeight: v });
    });

    document.querySelectorAll('.width-pill').forEach((btn) => {
      btn.addEventListener('click', () => this.app.patchSettings({ contentWidth: Number(btn.dataset.width) }));
    });

    document.getElementById('chk-show-toc').addEventListener('change', (e) => {
      this.app.patchSettings({ showToc: e.target.checked });
    });
    document.getElementById('chk-simplify-original').addEventListener('change', (e) => {
      this.app.patchSettings({ originalSimplifyChrome: e.target.checked });
    });
  }

  syncAppearanceControls() {
    const s = this.app.getSettings();
    document.querySelectorAll('.theme-pill').forEach((b) =>
      b.classList.toggle('active', b.dataset.theme === s.theme)
    );
    document.getElementById('range-font-size').value = String(s.fontSize || 16);
    document.getElementById('val-font-size').textContent = `${s.fontSize || 16}px`;
    document.getElementById('range-line-height').value = String(s.lineHeight || 1.75);
    document.getElementById('val-line-height').textContent = Number(s.lineHeight || 1.75).toFixed(2);
    document.querySelectorAll('.width-pill').forEach((b) =>
      b.classList.toggle('active', Number(b.dataset.width) === Number(s.contentWidth))
    );
    document.getElementById('chk-show-toc').checked = Boolean(s.showToc);
    document.getElementById('chk-simplify-original').checked = Boolean(s.originalSimplifyChrome);
  }

  _bindBookmarkPopover() {
    document.getElementById('btn-bm-save').addEventListener('click', async () => {
      const tab = this.app.getActiveTab();
      if (!tab || tab.type !== 'article') return;
      const folder = document.getElementById('bm-folder-input').value.trim() || t('sidebar.defaultFolder');
      const note = document.getElementById('bm-note-input').value.trim();
      await window.scpApi.upsertBookmark({
        site: tab.site,
        slug: tab.slug,
        title: tab.title || tab.slug,
        rating: tab.article?.rating ?? null,
        tags: tab.article?.tags || [],
        folder,
        note
      });
      this.closeAllPopovers();
      this.app.showToast(t('toast.bookmarkUpdated'), 'ok');
      await this.app.refreshSidebarData();
      this.app.syncToolbarState();
    });

    document.getElementById('btn-bm-remove').addEventListener('click', async () => {
      const tab = this.app.getActiveTab();
      if (!tab || tab.type !== 'article') return;
      await window.scpApi.removeBookmark(tab.site, tab.slug);
      this.closeAllPopovers();
      this.app.showToast(t('toast.bookmarkRemoved'));
      await this.app.refreshSidebarData();
      this.app.syncToolbarState();
    });
  }

  openBookmarkPopover(anchorBtn, existing, allBookmarks) {
    const folders = Array.from(new Set((allBookmarks || []).map((b) => b.folder || t('sidebar.defaultFolder'))));
    document.getElementById('bm-folder-datalist').innerHTML = folders
      .map((f) => `<option value="${esc(f)}"></option>`)
      .join('');
    document.getElementById('bm-folder-input').value = existing?.folder || t('sidebar.defaultFolder');
    document.getElementById('bm-note-input').value = existing?.note || '';
    this.positionAndToggle('popover-bookmark', anchorBtn);
  }

  _bindSettingsModal() {
    const modal = document.getElementById('modal-settings');
    const close = () => modal.classList.add('hidden');

    document.getElementById('btn-open-settings').addEventListener('click', () => {
      this.closeAllPopovers();
      this._populateSettingsForm();
      modal.classList.remove('hidden');
    });
    document.getElementById('btn-close-settings').addEventListener('click', close);
    document.getElementById('btn-cancel-settings').addEventListener('click', close);
    modal.addEventListener('mousedown', (e) => {
      if (e.target === modal) close();
    });

    document.getElementById('set-proxy-mode').addEventListener('change', (e) => {
      document.getElementById('custom-proxy-fields').classList.toggle('hidden', e.target.value !== 'custom');
    });

    document.getElementById('btn-reset-mirrors').addEventListener('click', () => {
      document.getElementById('set-cn-url').value = 'https://scp-wiki-cn.wikidot.com';
      document.getElementById('set-en-url').value = 'https://scp-wiki.wikidot.com';
      document.getElementById('set-crom-url').value = 'https://api.crom.avn.sh/graphql';
      this.app.showToast(t('toast.mirrorsReset'));
    });

    document.getElementById('btn-test-network').addEventListener('click', async () => {
      const box = document.getElementById('network-test-results');
      box.innerHTML = `<div class="conn-row">${esc(t('settings.testingConn'))}</div>`;
      // Temporarily save proxy & mirror values before testing
      await this._saveSettingsForm(false);
      const res = await window.scpApi.testConnectivity();
      box.innerHTML = res
        .map((r) => {
          const badge = r.ok
            ? `<span class="conn-ok">HTTP ${r.status} · ${r.latencyMs}ms</span>`
            : `<span class="conn-err">${esc(r.error || `HTTP ${r.status}`)}</span>`;
          return `<div class="conn-row"><span><strong>${esc(r.code)}</strong> ${esc(r.name)}</span>${badge}</div>`;
        })
        .join('');
    });

    document.getElementById('btn-save-settings').addEventListener('click', async () => {
      await this._saveSettingsForm(true);
      close();
    });

    document.getElementById('btn-open-project-site')?.addEventListener('click', () => {
      window.scpApi.openExternal('https://yuriaqua.com/scp-archive/');
    });
    document.getElementById('btn-open-github-repo')?.addEventListener('click', () => {
      window.scpApi.openExternal('https://github.com/toydream525/scp-archive-desktop');
    });
    document.getElementById('btn-open-scp-guide')?.addEventListener('click', () => {
      const url = this.app.getSettings().uiLocale === 'en-US'
        ? 'https://scp-wiki.wikidot.com/licensing-guide'
        : 'https://scp-wiki-cn.wikidot.com/licensing-guide';
      window.scpApi.openExternal(url);
    });
    document.getElementById('btn-open-cc-license')?.addEventListener('click', () => {
      window.scpApi.openExternal('https://creativecommons.org/licenses/by-sa/3.0/');
    });
  }

  _populateSettingsForm() {
    const s = this.app.getSettings();
    const locSel = document.getElementById('set-ui-locale');
    locSel.innerHTML = getAvailableLocales()
      .map((l) => `<option value="${esc(l.code)}">${esc(l.label)} (${esc(l.code)})</option>`)
      .join('');
    locSel.value = s.uiLocale || 'zh-CN';

    document.getElementById('set-proxy-mode').value = s.proxyMode || 'system';
    document.getElementById('set-proxy-rules').value = s.proxyRules || '';
    document.getElementById('set-proxy-bypass').value = s.proxyBypassRules || '<local>';
    document.getElementById('custom-proxy-fields').classList.toggle('hidden', s.proxyMode !== 'custom');

    document.getElementById('set-cn-url').value = s.customBaseUrls?.cn || s.cnBaseUrl || 'https://scp-wiki-cn.wikidot.com';
    document.getElementById('set-en-url').value = s.customBaseUrls?.en || s.enBaseUrl || 'https://scp-wiki.wikidot.com';
    document.getElementById('set-crom-url').value = s.cromApiUrl || 'https://api.crom.avn.sh/graphql';

    document.getElementById('set-auto-cache').checked = Boolean(s.autoCacheOnRead);
    document.getElementById('set-cache-images').checked = Boolean(s.cacheImages);
    document.getElementById('set-restore-progress').checked = Boolean(s.autoRestoreProgress);
    document.getElementById('set-reading-mode').value = s.readingMode || 'clean';
    document.getElementById('network-test-results').innerHTML = '';
  }

  async _saveSettingsForm(showNotification) {
    const prevLocale = this.app.getSettings().uiLocale;
    const nextLocale = document.getElementById('set-ui-locale').value;
    const cnUrl = document.getElementById('set-cn-url').value.trim() || 'https://scp-wiki-cn.wikidot.com';
    const enUrl = document.getElementById('set-en-url').value.trim() || 'https://scp-wiki.wikidot.com';

    await this.app.patchSettings({
      uiLocale: nextLocale,
      proxyMode: document.getElementById('set-proxy-mode').value,
      proxyRules: document.getElementById('set-proxy-rules').value.trim(),
      proxyBypassRules: document.getElementById('set-proxy-bypass').value.trim() || '<local>',
      cnBaseUrl: cnUrl,
      enBaseUrl: enUrl,
      customBaseUrls: { cn: cnUrl, en: enUrl },
      cromApiUrl: document.getElementById('set-crom-url').value.trim() || 'https://api.crom.avn.sh/graphql',
      autoCacheOnRead: document.getElementById('set-auto-cache').checked,
      cacheImages: document.getElementById('set-cache-images').checked,
      autoRestoreProgress: document.getElementById('set-restore-progress').checked,
      readingMode: document.getElementById('set-reading-mode').value
    });

    if (nextLocale !== prevLocale) {
      setLocale(nextLocale);
      this.app.onLocaleChanged();
      if (showNotification) {
        this.app.showToast(t('toast.localeSwitched', { name: getLocaleMeta(nextLocale).label }), 'ok');
      }
    } else if (showNotification) {
      this.app.showToast(t('toast.settingsSaved'), 'ok');
    }
  }
}
