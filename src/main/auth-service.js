const { BrowserWindow, net, session } = require('electron');
const cheerio = require('cheerio');

const WEB_PARTITION = 'persist:scp-wiki';
const WIKIDOT_LOGIN_URL = 'https://www.wikidot.com/default--flow/login__LoginPopupScreen';

class AuthService {
  constructor(store) {
    this.store = store;
    this.loginWindow = null;
    this.state = {
      loggedIn: false,
      username: null,
      userSlug: null,
      avatarUrl: null,
      profileUrl: null,
      checkedAt: 0
    };
  }

  getSharedSession() {
    return session.fromPartition(WEB_PARTITION);
  }

  getState() {
    return { ...this.state };
  }

  async _hasWikidotSessionCookie() {
    try {
      const ses = this.getSharedSession();
      const cookies = await ses.cookies.get({ domain: 'wikidot.com' });
      return cookies.some(
        (c) =>
          (c.name === 'WIKIDOT_SESSION_ID' ||
            c.name === 'wikidot_udsession_1' ||
            c.name.toLowerCase().includes('session')) &&
          Boolean(c.value)
      );
    } catch {
      return false;
    }
  }

  _parseLoginStatusFromHtml(html) {
    const $ = cheerio.load(html);
    const status = $('#login-status').first();
    if (!status.length) {
      return null;
    }

    // Explicitly signed-out signals inside #login-status
    const statusHtml = status.html() || '';
    const hasSignInBtn =
      status.find('.login-status-sign-in, .login-status-create-account, a[href*="login__LoginPopupScreen"]').length > 0 ||
      statusHtml.includes('WIKIDOT.page.listeners.loginClick');
    if (hasSignInBtn) {
      return { loggedIn: false };
    }

    // Require explicit signed-in signals strictly INSIDE #login-status (never scan article body!)
    const hasSignedInControls =
      status.find('#my-account, #account-topbutton').length > 0 ||
      statusHtml.includes('WIKIDOT.page.listeners.logoutClick');
    const userLink = status.find('.printuser a[href*="user:info/"]').last();

    if (hasSignedInControls && userLink.length) {
      const username = userLink.text().trim();
      const href = userLink.attr('href') || '';
      const slugMatch = href.match(/user:info\/([^/?#]+)/i);
      const avatarImg = status.find('.printuser img').first().attr('src') || null;
      return {
        loggedIn: true,
        username: username || (slugMatch ? slugMatch[1] : 'Wikidot User'),
        userSlug: slugMatch ? slugMatch[1] : username,
        avatarUrl: avatarImg ? (avatarImg.startsWith('//') ? `https:${avatarImg}` : avatarImg) : null,
        profileUrl: href || (slugMatch ? `https://www.wikidot.com/user:info/${slugMatch[1]}` : null)
      };
    }

    return { loggedIn: false };
  }

  async checkAuthStatus({ force = false } = {}) {
    if (!force && this.state.checkedAt && Date.now() - this.state.checkedAt < 15000) {
      return this.getState();
    }

    const ses = this.getSharedSession();
    const hasCookie = await this._hasWikidotSessionCookie();
    if (!hasCookie) {
      this.state = {
        loggedIn: false,
        username: null,
        userSlug: null,
        avatarUrl: null,
        profileUrl: null,
        checkedAt: Date.now()
      };
      return this.getState();
    }

    const probeUrls = [
      `${this.store.getBaseUrl(this.store.getSettings().site)}/`,
      'https://scp-wiki.wikidot.com/'
    ];

    for (const url of probeUrls) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        try {
          const res = await net.fetch(url, {
            session: ses,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
            },
            signal: controller.signal
          });
          if (!res.ok) continue;
          const html = await res.text();
          const parsed = this._parseLoginStatusFromHtml(html);
          if (parsed) {
            if (parsed.loggedIn) {
              this.state = { ...parsed, checkedAt: Date.now() };
            } else {
              this.state = {
                loggedIn: false,
                username: null,
                userSlug: null,
                avatarUrl: null,
                profileUrl: null,
                checkedAt: Date.now()
              };
            }
            return this.getState();
          }
        } finally {
          clearTimeout(timer);
        }
      } catch {
        // try next probe URL
      }
    }

    this.state = {
      loggedIn: false,
      username: null,
      userSlug: null,
      avatarUrl: null,
      profileUrl: null,
      checkedAt: Date.now()
    };
    return this.getState();
  }

  async openLoginWindow(parentWindow, onAuthChanged) {
    if (this.loginWindow && !this.loginWindow.isDestroyed()) {
      this.loginWindow.focus();
      return { opened: true };
    }

    const win = new BrowserWindow({
      width: 500,
      height: 640,
      parent: parentWindow || undefined,
      modal: false,
      resizable: true,
      minimizable: false,
      title: 'Wikidot 账号登录（主站与中文分部通用）',
      autoHideMenuBar: true,
      webPreferences: {
        partition: WEB_PARTITION,
        contextIsolation: true,
        nodeIntegration: false
      }
    });
    this.loginWindow = win;

    let finished = false;
    const verifyAndFinish = async (closeIfLoggedIn = true) => {
      if (finished) return;
      const status = await this.checkAuthStatus({ force: true });
      if (status.loggedIn) {
        finished = true;
        if (typeof onAuthChanged === 'function') onAuthChanged(status);
        if (closeIfLoggedIn && !win.isDestroyed()) {
          win.close();
        }
      }
    };

    const checkUrlProgress = async (url) => {
      if (!url) return;
      // Wikidot redirects away from LoginPopupScreen or hits callback/account after sign-in
      if (
        url.includes('wikidot.com') &&
        !url.includes('login__LoginPopupScreen') &&
        !url.includes('oauth') &&
        !url.includes('captcha')
      ) {
        await verifyAndFinish(true);
      }
    };

    win.webContents.on('did-navigate', (_ev, url) => {
      checkUrlProgress(url);
    });

    win.webContents.on('did-finish-load', async () => {
      if (win.isDestroyed()) return;
      const url = win.webContents.getURL();
      if (url.includes('login__LoginPopupScreen')) {
        // Check if page has no password input and explicitly says already/successfully logged in
        try {
          const info = await win.webContents.executeJavaScript(
            '({ hasPw: !!document.querySelector("input[type=password]"), text: document.body ? document.body.innerText : "" })'
          );
          if (!info.hasPw && /already logged in|successfully logged in|you are logged in|你已经登录/i.test(info.text)) {
            await verifyAndFinish(true);
          }
        } catch {
          // ignore
        }
      } else {
        await checkUrlProgress(url);
      }
    });

    win.on('closed', async () => {
      this.loginWindow = null;
      if (!finished) {
        const status = await this.checkAuthStatus({ force: true });
        if (typeof onAuthChanged === 'function') onAuthChanged(status);
      }
    });

    await win.loadURL(WIKIDOT_LOGIN_URL);
    return { opened: true };
  }

  async logout(onAuthChanged) {
    const ses = this.getSharedSession();
    try {
      const cookies = await ses.cookies.get({});
      await Promise.all(
        cookies
          .filter((c) => c.domain && c.domain.includes('wikidot.com'))
          .map((c) => {
            const cleanDomain = c.domain.replace(/^\./, '');
            const proto = c.secure ? 'https' : 'http';
            const url = `${proto}://${cleanDomain}${c.path || '/'}`;
            return ses.cookies.remove(url, c.name).catch(() => {});
          })
      );
      await ses.cookies.flushStore();
    } catch {
      // ignore cookie cleanup errors
    }

    this.state = {
      loggedIn: false,
      username: null,
      userSlug: null,
      avatarUrl: null,
      profileUrl: null,
      checkedAt: Date.now()
    };
    if (typeof onAuthChanged === 'function') onAuthChanged(this.getState());
    return this.getState();
  }
}

module.exports = { AuthService, WEB_PARTITION, WIKIDOT_LOGIN_URL };
