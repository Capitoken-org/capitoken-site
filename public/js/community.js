/* Capitoken Community Panel
   - Loads Telegram pinned post embed (optional)
   - Loads Official Updates from a GitHub Gist RAW URL (preferred) with local fallback
   - Safe-by-default: if embeds are blocked, buttons still work.
*/
(function () {
  function qs(sel) { return document.querySelector(sel); }

  function getBaseUrl() {
    const sec = qs('#community');
    const base = sec && sec.dataset && sec.dataset.base ? sec.dataset.base : '/';
    // Ensure trailing slash
    return base.endsWith('/') ? base : (base + '/');
  }

  function getCfg() {
    return (window && window.CAPI_CONFIG) ? window.CAPI_CONFIG : {};
  }

  function safeSetHref(id, url) {
    const el = qs(id);
    if (el && url) el.setAttribute('href', url);
  }

  function safeSetText(id, text) {
    const el = qs(id);
    if (el && text) el.textContent = text;
  }

  function injectTelegramEmbed(channel, postId) {
    const container = qs('#tg-embed');
    if (!container) return;

    // Clean container
    container.innerHTML = '';

    if (!channel || !postId) {
      container.innerHTML = '<div class="small note">Pinned update preview is not configured yet.</div>';
      return;
    }

    // Telegram widget requires a blockquote + their script
    const bq = document.createElement('blockquote');
    bq.className = 'telegram-post';
    bq.setAttribute('data-telegram-post', `${channel}/${postId}`);
    bq.setAttribute('data-width', '100%');
    bq.setAttribute('data-userpic', 'true');
    bq.setAttribute('data-color', '19e6d3'); // matches turquoise accent; Telegram ignores if unsupported
    container.appendChild(bq);

    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.onerror = function () {
      container.innerHTML =
        '<div class="small note">Telegram embed blocked. Use the buttons above to open Telegram.</div>';
    };
    container.appendChild(s);
  }

  function renderUpdates(items) {
    const list = qs('#updates-list');
    if (!list) return;

    if (!Array.isArray(items) || items.length === 0) {
      list.innerHTML = '<div class="small note">No updates yet.</div>';
      return;
    }

    const html = items.slice(0, 6).map((it) => {
      const title = (it.title || 'Update').toString();
      const date = (it.date || '').toString();
      const tag = (it.tag || '').toString();
      const body = (it.body || '').toString();
      const url = (it.url || '').toString();

      const safeUrl = url && /^https?:\/\//i.test(url) ? url : '';
      const tagHtml = tag ? `<span class="update-tag">${escapeHtml(tag)}</span>` : '';
      const dateHtml = date ? `<span class="update-date">${escapeHtml(date)}</span>` : '';
      const btnHtml = safeUrl ? `<a class="update-btn" href="${safeUrl}" target="_blank" rel="noreferrer noopener">Open</a>` : '';

      return `
        <div class="update-card">
          <div class="update-head">
            <div class="update-title">${escapeHtml(title)}</div>
            <div class="update-meta">${dateHtml}${tagHtml}</div>
          </div>
          <div class="update-body">${escapeHtml(body)}</div>
          <div class="update-foot">${btnHtml}</div>
        </div>
      `.trim();
    }).join('\n');

    list.innerHTML = html;
  }

  function escapeHtml(str) {
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  async function fetchJson(url) {
    const u = url.includes('?') ? `${url}&_=${Date.now()}` : `${url}?_=${Date.now()}`;
    const res = await fetch(u, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  async function loadUpdates() {
    const cfg = getCfg();
    const base = getBaseUrl();
    const gistUrl = (cfg.ANNOUNCEMENTS_GIST_URL || '').toString().trim();
    const fallbackUrl = base + 'data/announcements.json';

    try {
      if (!gistUrl) throw new Error('Missing ANNOUNCEMENTS_GIST_URL');
      const data = await fetchJson(gistUrl);
      renderUpdates(data);
      return;
    } catch (e1) {
      try {
        const data2 = await fetchJson(fallbackUrl);
        renderUpdates(data2);
        return;
      } catch (e2) {
        const list = qs('#updates-list');
        if (list) {
          list.innerHTML = '<div class="small note">Updates are temporarily unavailable.</div>';
        }
      }
    }
  }

  function wireButtons() {
    const cfg = getCfg();
    const socials = cfg.SOCIALS || cfg.socials || {};
    // Telegram link: prefer socials.telegram, else build from TELEGRAM_CHANNEL
    const tgChannel = (cfg.TELEGRAM_CHANNEL || '').toString().trim();
    const tgUrl = (socials.telegram || (tgChannel ? `https://t.me/${tgChannel}` : '')).toString();
    if (tgUrl) {
      safeSetHref('#tg-join-btn', tgUrl);
      safeSetHref('#tg-open-btn', tgUrl);
      safeSetText('#tg-join-btn', `Join @${tgChannel || tgUrl.split('/').pop()}`);
    }

    const verifyUrl = (socials.verify || socials.website || '').toString() || 'https://www.capitoken.org/verify/';
    safeSetHref('#updates-official-links-btn', verifyUrl);

    const discordUrl = (socials.discord || '').toString();
    safeSetHref('#updates-discord-btn', discordUrl || 'https://discord.gg/');
  }

  function init() {
    wireButtons();

    const cfg = getCfg();
    const tgChannel = (cfg.TELEGRAM_CHANNEL || '').toString().trim();
    const postId = (cfg.TELEGRAM_PINNED_POST_ID || '').toString().trim();
    injectTelegramEmbed(tgChannel, postId);

    loadUpdates();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();