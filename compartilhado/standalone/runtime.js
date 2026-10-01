(() => {
  const DATA = JSON.parse(document.getElementById('playsaurus-data').textContent);
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
  const strip = (h) => {
    const d = document.createElement('div');
    d.innerHTML = h;
    return (d.textContent || '').replace(/\s+/g, ' ').trim();
  };
  const normalize = (s) => (s || '').toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const HOME_COPY = {
    'pt-BR': {
      tags: { arquitetura: 'Para desenvolvedores', usabilidade: 'Para usuários', referencia: 'Consulta rápida' },
      actions: { usabilidade: 'Ver guias de uso', referencia: 'Consultar referência', arquitetura: 'Ver arquitetura' },
      previous: 'Anterior', next: 'Próximo', home: 'Início',
    },
    'pt-PT': {
      tags: { arquitetura: 'Para programadores', usabilidade: 'Para utilizadores', referencia: 'Consulta rápida' },
      actions: { usabilidade: 'Ver guias de utilização', referencia: 'Consultar referência', arquitetura: 'Ver arquitetura' },
      previous: 'Anterior', next: 'Seguinte', home: 'Início',
    },
    en: {
      tags: { arquitetura: 'For developers', usabilidade: 'For users', referencia: 'Quick reference' },
      actions: { usabilidade: 'View user guides', referencia: 'Browse reference', arquitetura: 'View architecture' },
      previous: 'Previous', next: 'Next', home: 'Home',
    },
    es: {
      tags: { arquitetura: 'Para desarrolladores', usabilidade: 'Para usuarios', referencia: 'Consulta rápida' },
      actions: { usabilidade: 'Ver guías de uso', referencia: 'Consultar referencia', arquitetura: 'Ver arquitectura' },
      previous: 'Anterior', next: 'Siguiente', home: 'Inicio',
    },
  };

  function localCopy(locale) {
    return HOME_COPY[locale] || HOME_COPY[locale.split('-')[0]] || HOME_COPY.en;
  }

  function preferred() {
    const stored = localStorage.getItem('playsaurus-language');
    if (DATA.locales.some((x) => x.locale === stored)) return stored;
    const app = localStorage.getItem('app-language');
    const byApp = DATA.locales.find((x) => x.appLocale === app);
    if (byApp) return byApp.locale;
    const nav = navigator.language;
    const byNav = DATA.locales.find((x) =>
      x.appLocale === nav || x.locale === nav || x.locale.split('-')[0] === nav.split('-')[0]);
    return byNav?.locale || DATA.defaultLocale;
  }

  function basePath() {
    let base = String(DATA.baseUrl || '/docs/').trim() || '/docs/';
    if (!base.startsWith('/')) base = '/' + base;
    return '/' + base.replace(/^\/+|\/+$/g, '') + '/';
  }

  function decodePart(value) {
    try { return decodeURIComponent(value); } catch { return value; }
  }

  function legacyHashState() {
    if (!location.hash.startsWith('#/')) return null;
    const raw = location.hash.replace(/^#\/?/, '');
    const [pathPart, q = ''] = raw.split('?');
    const bits = pathPart.split('/').filter(Boolean);
    const maybe = decodePart(bits[0] || '');
    const hasLocale = DATA.locales.some((x) => x.locale === maybe);
    const locale = hasLocale ? maybe : preferred();
    const route = (hasLocale ? bits.slice(1) : bits).map(decodePart).join('/').replace(/^\/+|\/+$/g, '');
    return { locale, route, section: new URLSearchParams(q).get('section') || '', legacy: true };
  }

  function parse() {
    const legacy = legacyHashState();
    if (legacy) return legacy;

    const base = basePath();
    const baseNoSlash = base.replace(/\/$/, '');
    let pathname = location.pathname;
    let relative = '';
    if (pathname === baseNoSlash || pathname === base) relative = '';
    else if (pathname.startsWith(base)) relative = pathname.slice(base.length);
    else relative = pathname.replace(/^\/+/, '');

    relative = relative.replace(/^index\.html\/?/i, '').replace(/^\/+|\/+$/g, '');
    const bits = relative.split('/').filter(Boolean).map(decodePart);
    const maybe = bits[0] || '';
    const hasLocale = DATA.locales.some((x) => x.locale === maybe);
    const locale = hasLocale ? maybe : DATA.defaultLocale;
    const route = (hasLocale ? bits.slice(1) : bits).join('/').replace(/^\/+|\/+$/g, '');
    const section = location.hash && !location.hash.startsWith('#/')
      ? decodePart(location.hash.slice(1))
      : new URLSearchParams(location.search).get('section') || '';
    return { locale, route, section, legacy: false };
  }

  function url(locale, route = '', section = '') {
    const base = basePath();
    const localePrefix = locale && locale !== DATA.defaultLocale ? `${encodeURIComponent(locale)}/` : '';
    const routePart = route.split('/').filter(Boolean).map((part) => encodeURIComponent(decodePart(part))).join('/');
    let target = base + localePrefix + routePart;
    if (!routePart && localePrefix) target = base + localePrefix;
    if (section) target += `#${encodeURIComponent(section)}`;
    return target;
  }

  function ui(locale) { return DATA.ui[locale] || DATA.ui[locale.split('-')[0]] || DATA.ui.en; }
  function page(locale, route) { return DATA.content[locale]?.pages.find((p) => p.route === route); }
  function sectionMeta(locale, id) { return DATA.content[locale]?.sections.find((s) => s.id === id); }
  function sectionForState(state, p) {
    if (p?.sectionId) return p.sectionId;
    if (DATA.content[state.locale]?.sections.some((s) => s.id === state.route)) return state.route;
    return '';
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('playsaurus-theme', theme);
  }
  setTheme(localStorage.getItem('playsaurus-theme') ||
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  $('#themeBtn').onclick = () => setTheme(
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');

  // A navbar segue a hierarquia configurada do projeto:
  // marca + seções à esquerda; utilidades à direita.
  const topNav = document.createElement('nav');
  topNav.className = 'ps-topnav';
  topNav.id = 'topNav';
  topNav.setAttribute('aria-label', 'Documentation sections');
  $('#homeLink').insertAdjacentElement('afterend', topNav);

  const footer = document.createElement('footer');
  footer.className = 'ps-footer';
  footer.id = 'footer';
  document.body.appendChild(footer);

  function renderTopNav(state, activeSection) {
    const loc = DATA.content[state.locale];
    topNav.innerHTML = loc.sections.map((sec) =>
      `<a class="${activeSection === sec.id ? 'active' : ''}" href="${url(state.locale, sec.id)}">${esc(sec.label)}</a>`
    ).join('');
  }

  function renderSidebar(state, activeSection) {
    const loc = DATA.content[state.locale];
    if (!activeSection) {
      $('#sidebar').innerHTML = '';
      return;
    }
    // As páginas já chegam ordenadas pelo prefixo numérico do arquivo. Incluímos
    // também o index da secção para que a página inicial participe normalmente
    // da navegação lateral, na posição definida pelo respetivo frontmatter.
    const ps = loc.pages.filter((p) => p.sectionId === activeSection);
    $('#sidebar').innerHTML = `<div class="ps-sidebar-section">` +
      ps.map((p) => `<a class="${state.route === p.route ? 'active' : ''}" href="${url(state.locale, p.route)}">${esc(p.title)}</a>`).join('') +
      '</div>';
  }

  function renderToc(state, p) {
    const U = ui(state.locale);
    if (!p || !p.headings.length) { $('#toc').innerHTML = ''; return; }
    $('#toc').innerHTML = `<div class="ps-toc-title">${esc(U.contents)}</div>` +
      p.headings.map((h) => `<a class="l${h.level}" href="${url(state.locale, p.route, h.id)}">${esc(h.title)}</a>`).join('');
  }

  function homeActionLabel(locale, sec) {
    return localCopy(locale).actions[sec.id] || `${ui(locale).access} ${sec.label}`;
  }

  function sectionDescription(sec) {
    let text = String(sec.description || '').replace(/\s+/g, ' ').trim();
    const label = String(sec.label || '').trim();
    if (label && text.toLocaleLowerCase().startsWith(label.toLocaleLowerCase())) {
      text = text.slice(label.length).trim();
    }
    const sentence = text.match(/^(.{1,190}?[.!?])(?:\s|$)/);
    return sentence ? sentence[1] : text.slice(0, 190).trim();
  }

  function renderHome(state) {
    const loc = DATA.content[state.locale];
    const I = DATA.locales.find((x) => x.locale === state.locale) || {};
    const title = I.homeTitulo || DATA.project.homeTitle || DATA.project.name;
    const tag = I.tagline || DATA.project.tagline || '';
    const copy = localCopy(state.locale);
    const actions = loc.sections.slice(0, 2);
    const heroActions = actions.map((sec, index) =>
      `<a class="ps-hero-btn ${index === 0 ? 'primary' : 'ghost'}" href="${url(state.locale, sec.id)}">${esc(homeActionLabel(state.locale, sec))}</a>`
    ).join('');
    const logo = DATA.logo ? `<img class="ps-hero-logo" src="${DATA.logo}" alt="${esc(DATA.project.name)}">` : '';

    document.body.classList.add('ps-is-home');
    $('#main').innerHTML = `<div class="ps-home"><header class="ps-hero"><div class="ps-hero-inner">${logo}<h1>${esc(title)}</h1><p>${esc(tag)}</p><div class="ps-hero-actions">${heroActions}</div></div></header><main class="ps-areas"><div class="ps-cards" style="--ps-home-cols:${Math.min(loc.sections.length, 3)}">${loc.sections.map((s) => `<a class="ps-card" href="${url(state.locale, s.id)}"><span class="ps-card-tag">${esc(copy.tags[s.id] || '')}</span><h2>${esc(s.label)}</h2><p>${esc(sectionDescription(s))}</p><span class="ps-card-link">${esc(ui(state.locale).access)} →</span></a>`).join('')}</div></main></div>`;
    renderToc(state, null);
  }

  function pagination(state, p) {
    const same = DATA.content[state.locale].pages.filter((x) => x.sectionId === p.sectionId);
    const index = same.findIndex((x) => x.route === p.route);
    const prev = index > 0 ? same[index - 1] : null;
    const next = index >= 0 && index < same.length - 1 ? same[index + 1] : null;
    if (!prev && !next) return '';
    const C = localCopy(state.locale);
    return `<nav class="ps-pagination" aria-label="Pagination">${prev ? `<a href="${url(state.locale, prev.route)}"><small>« ${esc(C.previous)}</small><strong>${esc(prev.title)}</strong></a>` : '<span></span>'}${next ? `<a class="next" href="${url(state.locale, next.route)}"><small>${esc(C.next)} »</small><strong>${esc(next.title)}</strong></a>` : ''}</nav>`;
  }

  function renderMermaid() {
    if (!window.mermaid) return;
    const nodes = [...document.querySelectorAll('.ps-article .mermaid:not([data-processed])')];
    if (!nodes.length) return;
    try {
      window.mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default',
      });
      Promise.resolve(window.mermaid.run({ nodes })).catch((error) => console.error('Mermaid:', error));
    } catch (error) {
      console.error('Mermaid:', error);
    }
  }

  function renderArticle(state, p) {
    const sec = sectionMeta(state.locale, p.sectionId);
    const C = localCopy(state.locale);
    document.body.classList.remove('ps-is-home');
    $('#main').innerHTML = `<article class="ps-article"><nav class="ps-breadcrumbs" aria-label="Breadcrumb"><a href="${url(state.locale)}">${esc(C.home)}</a><span>›</span><a href="${url(state.locale, p.sectionId)}">${esc(sec?.label || p.sectionId)}</a>${p.route !== p.sectionId ? `<span>›</span><span aria-current="page">${esc(p.title)}</span>` : ''}</nav>${p.html}${pagination(state, p)}</article>`;
    renderToc(state, p);
    renderMermaid();
    if (state.section) setTimeout(() => document.getElementById(state.section)?.scrollIntoView({ block: 'start' }), 0);
  }

  function configure(state) {
    document.documentElement.lang = DATA.locales.find((x) => x.locale === state.locale)?.htmlLang || state.locale;
    localStorage.setItem('playsaurus-language', state.locale);
    const localeMeta = DATA.locales.find((x) => x.locale === state.locale);
    if (localeMeta?.appLocale) localStorage.setItem('app-language', localeMeta.appLocale);
    $('#localeLabel').textContent = localeMeta?.label || state.locale;
    const U = ui(state.locale);
    $('#search').placeholder = U.search;
    $('#pdfLabel').textContent = U.pdf;
    $('#themeBtn').title = U.theme;
    $('#themeBtn').setAttribute('aria-label', U.theme);
    $('#menuBtn').title = U.menu;
    $('#menuBtn').setAttribute('aria-label', U.menu);
    $('#homeLink').href = url(state.locale);
    const pdfKind = DATA.pdfKind || 'cliente';
    const pdfLocalizado = `pdf/documentacao-${pdfKind}.${state.locale}.pdf`;
    const pdfGenerico = `pdf/documentacao-${pdfKind}.pdf`;
    const pdfName = Array.isArray(DATA.pdfs) && DATA.pdfs.includes(pdfLocalizado)
      ? pdfLocalizado
      : pdfGenerico;
    const pdfBtn = $('#pdfBtn');
    const pdfBase = String(DATA.baseUrl || '/docs/').replace(/\/+$/, '') + '/';
    pdfBtn.href = pdfBase + pdfName;
    pdfBtn.download = pdfName.split('/').pop();
    pdfBtn.hidden = Array.isArray(DATA.pdfs) && !DATA.pdfs.includes(pdfName);
    footer.textContent = `Copyright © ${new Date().getFullYear()} ${DATA.project.name}.`;
    if (typeof syncLocaleMenu === 'function') syncLocaleMenu();
  }

  function render() {
    const state = parse();
    const canonical = url(state.locale, state.route, state.section);
    const current = location.pathname + location.hash;
    if (state.legacy || /\/index\.html$/i.test(location.pathname) || current !== canonical) {
      history.replaceState(null, '', canonical);
    }
    configure(state);
    const p = state.route ? page(state.locale, state.route) : null;
    const activeSection = sectionForState(state, p);
    renderTopNav(state, activeSection);
    renderSidebar(state, activeSection);
    if (state.route && !p) {
      document.body.classList.remove('ps-is-home');
      $('#main').innerHTML = '<div class="ps-empty">404</div>';
      renderToc(state, null);
    } else if (p) renderArticle(state, p);
    else renderHome(state);
    $('#sidebar').classList.remove('open');
  }

  const localePicker = $('#localePicker');
  const localeBtn = $('#localeBtn');
  const localeMenu = $('#localeMenu');
  localeMenu.innerHTML = DATA.locales.map((x) =>
    `<button type="button" role="option" data-locale="${esc(x.locale)}"><span>${esc(x.label)}</span><span class="ps-locale-check" aria-hidden="true">✓</span></button>`
  ).join('');

  function syncLocaleMenu() {
    const s = parse();
    localeMenu.querySelectorAll('[data-locale]').forEach((item) => {
      const active = item.dataset.locale === s.locale;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', active ? 'true' : 'false');
    });
  }

  function closeLocaleMenu() {
    localePicker.classList.remove('open');
    localeBtn.setAttribute('aria-expanded', 'false');
  }

  localeBtn.onclick = () => {
    const opening = !localePicker.classList.contains('open');
    localePicker.classList.toggle('open', opening);
    localeBtn.setAttribute('aria-expanded', opening ? 'true' : 'false');
    if (opening) syncLocaleMenu();
  };

  localeMenu.addEventListener('click', (e) => {
    const item = e.target.closest('[data-locale]');
    if (!item) return;
    const s = parse();
    const target = item.dataset.locale;
    closeLocaleMenu();
    history.pushState(null, '', url(target, s.route && page(target, s.route) ? s.route : ''));
    render();
  });

  $('#menuBtn').onclick = () => $('#sidebar').classList.toggle('open');
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#localePicker')) closeLocaleMenu();
    if (innerWidth <= 996 && !$('#sidebar').contains(e.target) && e.target !== $('#menuBtn')) {
      $('#sidebar').classList.remove('open');
    }
  });

  const search = $('#search');
  const results = $('#results');
  function doSearch() {
    const s = parse();
    const q = normalize(search.value.trim());
    if (!q) { results.classList.remove('open'); results.innerHTML = ''; return; }
    const U = ui(s.locale);
    const pages = DATA.content[s.locale].pages.map((p) => {
      const headingText = p.headings.map((h) => h.title).join(' ');
      const hay = normalize(p.title + ' ' + p.summary + ' ' + headingText + ' ' + strip(p.html));
      let score = 0;
      if (normalize(p.title).includes(q)) score += 20;
      if (normalize(headingText).includes(q)) score += 8;
      if (hay.includes(q)) score += 2;
      return { p, score };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 12);
    results.innerHTML = pages.length
      ? pages.map(({ p }) => `<a class="ps-result" href="${url(s.locale, p.route)}"><strong>${esc(p.title)}</strong><small>${esc(sectionMeta(s.locale, p.sectionId)?.label || p.sectionId)} · ${esc(p.summary.slice(0, 130))}</small></a>`).join('')
      : `<div class="ps-empty">${esc(U.noResults)}</div>`;
    results.classList.add('open');
  }
  search.addEventListener('input', doSearch);
  search.addEventListener('focus', doSearch);
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement.tagName)) {
      e.preventDefault(); search.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.ps-search-wrap')) results.classList.remove('open');
  });
  document.addEventListener('click', (e) => {
    const anchor = e.target.closest('a[href]');
    if (!anchor || e.defaultPrevented || anchor.hasAttribute('download') || anchor.target === '_blank') return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    let target;
    try { target = new URL(anchor.href, location.href); } catch { return; }
    const base = basePath();
    const baseNoSlash = base.replace(/\/$/, '');
    if (target.origin !== location.origin || !(target.pathname === baseNoSlash || target.pathname.startsWith(base))) return;
    if (/\/pdf\//.test(target.pathname) || /\.(?:pdf|xml|json)$/i.test(target.pathname)) return;
    e.preventDefault();
    history.pushState(null, '', target.pathname + target.search + target.hash);
    results.classList.remove('open');
    render();
  });
  window.addEventListener('popstate', render);
  window.addEventListener('hashchange', render);
  render();
})();
