/**
 * Mightora Shared UI Components
 *
 * Provides three Web Components for the standard Mightora header,
 * author section, and footer — designed to be shared across multiple
 * sites via jsDelivr CDN.
 *
 * CDN URL (after publishing to mightora/shared-ui):
 *   https://cdn.jsdelivr.net/gh/mightora/shared-ui@main/components.js
 *
 * Dependencies:
 *   - shared.css   — companion stylesheet (must load before this script)
 *   - js-yaml      — required by <mightora-footer> to parse the YAML data feed
 *                    https://cdn.jsdelivr.net/npm/js-yaml@4.1.0/dist/js-yaml.min.js
 *
 * ── Components ──────────────────────────────────────────────────────────────
 *
 * <mightora-header
 *   site-name="My Site"
 *   site-name-html="My <span>Site</span>"        (optional styled version)
 *   site-url="/"
 *   logo-light="https://..."
 *   logo-dark="https://..."                       (optional)
 *   theme-key="my-site-theme"                     (localStorage key, default: mightora-theme)
 *   nav-links='[
 *     {"label":"Home","url":"/"},
 *     {"label":"About","url":"/about"},
 *     {"label":"External ↗","url":"https://example.com","ext":true},
 *     {"label":"Tab","url":"#section","data-activate-tab":"tab-id"}
 *   ]'>
 * </mightora-header>
 *
 * <mightora-author
 *   config-url="data/config.json">               (default: data/config.json)
 * </mightora-author>
 *
 * <mightora-footer
 *   yaml-url="https://...">                       (optional CDN fallback; local footer.yaml preferred)
 *   <!-- Site-specific footer bottom goes here as child HTML -->
 *   <div class="container">
 *     <div class="footer-bottom">
 *       <div class="footer-copy">
 *         &copy; <span class="footer-year"></span> My Company.
 *       </div>
 *     </div>
 *   </div>
 * </mightora-footer>
 */

/* ── Utility ────────────────────────────────────────────────── */

function _esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Theme Management ───────────────────────────────────────── */

const MightoraTheme = (() => {
  function _key(el) {
    return (el && el.getAttribute('theme-key')) || 'mightora-theme';
  }

  function init(el) {
    const saved = localStorage.getItem(_key(el)) || 'light';
    document.documentElement.setAttribute('data-theme', saved);
  }

  function toggle(el) {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(_key(el), next);
  }

  return { init, toggle };
})();

/* ── <mightora-header> ──────────────────────────────────────── */

class MightoraHeader extends HTMLElement {
  connectedCallback() {
    this.classList.add('site-header');
    this.setAttribute('role', 'banner');

    const siteUrl      = this.getAttribute('site-url')       || '/';
    const siteName     = this.getAttribute('site-name')      || 'Mightora';
    const siteNameHtml = this.getAttribute('site-name-html') || _esc(siteName);
    const logoLight    = this.getAttribute('logo-light')     || '';
    const logoDark     = this.getAttribute('logo-dark')      || '';

    let navLinks = [];
    try { navLinks = JSON.parse(this.getAttribute('nav-links') || '[]'); } catch (_) {}

    const navHtml = navLinks.map(l => {
      const activateTab = l['data-activate-tab'] ? ` data-activate-tab="${_esc(l['data-activate-tab'])}"` : '';
      const ext         = l.ext ? ' target="_blank" rel="noopener"' : '';
      const cls         = l.ext ? ' class="ext-link"' : '';
      return `<a href="${_esc(l.url)}"${ext}${cls}${activateTab}>${_esc(l.label)}</a>`;
    }).join('\n          ');

    this.innerHTML = `
      <div class="container header-inner">
        <a href="${_esc(siteUrl)}" class="site-logo" aria-label="${_esc(siteName)} — Mightora.io">
          ${logoLight ? `<img src="${_esc(logoLight)}" alt="Mightora.io" class="site-logo-brand-img logo-light" onerror="this.style.display='none'">` : ''}
          ${logoDark  ? `<img src="${_esc(logoDark)}"  alt="Mightora.io" class="site-logo-brand-img logo-dark"  onerror="this.style.display='none'">` : ''}
          <span class="site-logo-divider" aria-hidden="true"></span>
          <span class="site-logo-text">${siteNameHtml}</span>
        </a>
        <nav class="header-nav" id="header-nav" aria-label="Main navigation">
          ${navHtml}
        </nav>
        <div class="flex-gap">
          <button class="theme-toggle" id="theme-toggle" aria-label="Toggle dark mode">
            <svg class="icon-sun" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
            <svg class="icon-moon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          </button>
          <button class="mobile-menu-btn" id="mobile-menu-btn" aria-label="Open navigation menu">
            <i class="fas fa-bars" aria-hidden="true"></i>
          </button>
        </div>
      </div>`;

    // Initialise theme immediately so there is no flash of wrong theme
    MightoraTheme.init(this);

    // Theme toggle
    this.querySelector('#theme-toggle')?.addEventListener('click', () => MightoraTheme.toggle(this));

    // Mobile navigation
    const menuBtn = this.querySelector('#mobile-menu-btn');
    const nav     = this.querySelector('.header-nav');
    if (menuBtn && nav) {
      menuBtn.addEventListener('click', () => nav.classList.toggle('open'));
    }
  }
}

/* ── <mightora-author> ──────────────────────────────────────── */

class MightoraAuthor extends HTMLElement {
  async connectedCallback() {
    this.classList.add('author-section');
    const configUrl = this.getAttribute('config-url') || 'data/config.json';
    try {
      const res = await fetch(configUrl);
      const cfg = await res.json();
      if (cfg && cfg.author) this._render(cfg.author);
    } catch (_) { /* silently ignore — page stays with whatever static HTML was inside */ }
  }

  _render(author) {
    const avatarUrl  = author.image || 'https://cdn.jsdelivr.net/gh/mightora/shared-ui@main/ian-tweedie-sq2.png';
    const blogLogo   = 'https://cdn.jsdelivr.net/gh/mightora/shared-ui@main/main-logo.png';
    const brandLabel = (author.branding && author.branding.label) || 'TechTweedie';

    this.innerHTML = `
      <div class="author-section-overlay">
        <div class="author-section-inner">
          <div class="author-photos">
            <img src="${_esc(avatarUrl)}" alt="${_esc(author.name || '')}" class="author-avatar" onerror="this.style.display='none'">
            <img src="${_esc(blogLogo)}" alt="${_esc(brandLabel)}" class="author-blog-logo" onerror="this.style.display='none'">
          </div>
          <div class="author-text">
            <h2 class="author-heading">Built by ${_esc(brandLabel)}</h2>
            <p class="author-bio">${_esc(author.bio || '')}</p>
            <div class="author-links">
              ${(author.links || []).map(l => `
                <a href="${_esc(l.url)}" target="_blank" rel="noopener" class="author-link">
                  ${l.icon ? `<i class="${_esc(l.icon)}"></i> ` : ''}${_esc(l.label)}
                </a>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
  }
}

/* ── <mightora-footer> ──────────────────────────────────────── */

class MightoraFooter extends HTMLElement {
  async connectedCallback() {
    this.classList.add('site-footer');
    this.setAttribute('role', 'contentinfo');

    // Every Mightora static build can bundle a validated footer.yaml.
    // Prefer the local snapshot; retain the supplied URL (or central CDN)
    // as a fallback for sites that have not adopted the build action yet.
    // local-yaml-url is useful for apps deployed beneath a route/base path.
    const localUrl = this.getAttribute('local-yaml-url') || 'footer.yaml';
    const fallbackUrl = this.getAttribute('yaml-url')
      || 'https://cdn.jsdelivr.net/gh/mightora/shared-ui@main/footer.yaml';

    // Preserve any site-specific child HTML (e.g. footer-bottom).
    const existingContent = this.innerHTML;

    for (const url of new Set([localUrl, fallbackUrl])) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Footer fetch failed: ${res.status}`);
        const text = await res.text();
        const data = (typeof jsyaml !== 'undefined') ? jsyaml.load(text) : JSON.parse(text);
        if (!data || !Array.isArray(data.sections) || !data.sections.length) {
          throw new Error('Invalid footer YAML');
        }
        this._render(data, existingContent);
        return;
      } catch (_) {
        // Local resource missing or invalid: try the next source.
      }
    }

    // No footer feed available — preserve site-specific bottom content.
    this._setYear();
  }

  _render(data, existingContent) {
    // Build columns from sections grouped by column number
    const cols = {};
    (data.sections || []).forEach(s => {
      if (!cols[s.column]) cols[s.column] = [];
      cols[s.column].push(s);
    });

    const mainHtml = `
      <div class="container">
        <div class="footer-main">
          ${Object.values(cols).map(sections => `
            <div class="footer-col">
              <div class="footer-col-sections">
                ${sections.sort((a, b) => a.position - b.position).map(s => `
                  <div>
                    <div class="footer-section-title">${_esc(s.title)}</div>
                    <ul class="footer-links">
                      ${s.links.map(l => `<li><a href="${_esc(l.url)}">${_esc(l.name)}</a></li>`).join('')}
                    </ul>
                  </div>`).join('')}
              </div>
            </div>`).join('')}
        </div>
      </div>`;

    const brandsHtml = (data.brands && data.brands.length) ? `
      <div class="container">
        <div class="footer-brands">
          ${data.brands.map(b => `
            <a href="${_esc(b.url)}" target="_blank" rel="noopener" class="footer-brand">
              <img src="${_esc(b.logo)}" alt="${_esc(b.name)}" onerror="this.style.display='none'">
              <span class="footer-brand-desc">${_esc(b.description)}</span>
            </a>`).join('')}
        </div>
      </div>` : '';

    this.innerHTML = mainHtml + brandsHtml + existingContent;
    this._setYear();
  }

  _setYear() {
    const year = new Date().getFullYear();
    this.querySelectorAll('.footer-year').forEach(el => { el.textContent = year; });
  }
}

/* ── Register ───────────────────────────────────────────────── */

customElements.define('mightora-header', MightoraHeader);
customElements.define('mightora-author', MightoraAuthor);
customElements.define('mightora-footer', MightoraFooter);
