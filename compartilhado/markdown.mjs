import fs from 'node:fs';
import path from 'node:path';
import MarkdownIt from 'markdown-it';
import { aplicarBranding, urlPagina } from './paginas.mjs';

const MIMES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.ico': 'image/x-icon',
};

class Slugger {
  constructor() { this.seen = new Map(); }
  slug(value) {
    const base = String(value ?? '')
      .trim()
      .toLocaleLowerCase()
      .replace(/<[^>]*>/g, '')
      .replace(/[\u2000-\u206F\u2E00-\u2E7F\\'!"#$%&()*+,./:;<=>?@[\]^`{|}~]/g, '')
      .replace(/\s+/g, '-');
    const count = this.seen.get(base) || 0;
    this.seen.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  }
}

function dataUri(arquivo) {
  const mime = MIMES[path.extname(arquivo).toLowerCase()] || 'application/octet-stream';
  return `data:${mime};base64,${fs.readFileSync(arquivo).toString('base64')}`;
}

function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function caminhoPosix(value) {
  return String(value || '').split(path.sep).join('/');
}

function resolverImagem(src, projeto, locale, pagina) {
  if (!src || /^(?:data:|https?:|blob:)/i.test(src)) return src;

  let limpo = String(src).split(/[?#]/)[0];
  try { limpo = decodeURIComponent(limpo); } catch {}

  const tentativas = [];
  const destinoShots = (projeto.screenshots?.destino || 'img/usabilidade/geradas').replace(/^\/+|\/+$/g, '');
  const semBarra = limpo.replace(/^\/+/, '');

  if (locale !== projeto.idiomas.padrao && semBarra.startsWith(`${destinoShots}/`)) {
    tentativas.push(path.join(
      projeto.dirStatic,
      destinoShots,
      locale,
      semBarra.slice(destinoShots.length + 1),
    ));
  }

  if (limpo.startsWith('/')) {
    tentativas.push(path.join(projeto.dirStatic, semBarra));
  } else {
    tentativas.push(path.resolve(path.dirname(pagina.fonte), limpo));
    tentativas.push(path.join(projeto.dirStatic, semBarra));
  }

  const arquivo = tentativas.find((alvo) => fs.existsSync(alvo) && fs.statSync(alvo).isFile());
  if (!arquivo) {
    throw new Error(`Imagem não encontrada em ${pagina.id}: ${src}`);
  }
  return dataUri(arquivo);
}

function rotaLimpa(value) {
  let rota = String(value || '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/index\.html$/i, '')
    .replace(/\.(?:md|mdx)$/i, '');
  if (!rota) return '';
  const partes = rota.split('/').filter(Boolean).map((parte) => parte.replace(/^\d+-/, ''));
  if (partes.at(-1) === 'index') partes.pop();
  return partes.join('/');
}

function linkInterno(href, projeto, locale, pagina) {
  if (!href || /^(?:(?:https?:)?\/\/|mailto:|tel:|javascript:|data:)/i.test(href)) return null;

  let alvo = String(href);
  let ancora = '';
  const hash = alvo.indexOf('#');
  if (hash >= 0) {
    ancora = alvo.slice(hash + 1);
    alvo = alvo.slice(0, hash);
  }
  const query = alvo.indexOf('?');
  if (query >= 0) alvo = alvo.slice(0, query);
  if (!alvo && ancora) return { locale, rota: pagina.rota, ancora };

  const base = '/' + String(projeto.baseUrl || '/docs/').replace(/^\/+|\/+$/g, '') + '/';
  const baseSemBarra = base.replace(/\/$/, '');

  if (alvo.startsWith('/')) {
    if (!(alvo === baseSemBarra || alvo.startsWith(base))) return null;
    let relativo = alvo === baseSemBarra ? '' : alvo.slice(base.length);
    const partes = relativo.split('/').filter(Boolean);
    let localeAlvo = locale;
    const locales = new Set(projeto.idiomas.disponiveis.map((item) => item.locale));
    if (partes.length && locales.has(partes[0])) localeAlvo = partes.shift();
    return { locale: localeAlvo, rota: rotaLimpa(partes.join('/')), ancora };
  }

  const relativoFonte = caminhoPosix(path.posix.normalize(path.posix.join(path.posix.dirname(pagina.id), alvo)));
  return { locale, rota: rotaLimpa(relativoFonte), ancora };
}

function prepararAdmonitions(markdown) {
  const itens = [];
  const texto = String(markdown).replace(
    /^:::(note|tip|info|warning|danger|caution)(?:\[([^\]]+)\]|[ \t]+([^\n]+))?[ \t]*\n([\s\S]*?)\n:::[ \t]*$/gm,
    (_match, tipo, tituloColchetes, tituloLivre, corpo) => {
      const token = `PLAYSAURUSADMONITION${itens.length}TOKEN`;
      itens.push({ tipo, titulo: (tituloColchetes || tituloLivre || '').trim(), corpo });
      return `\n${token}\n`;
    },
  );
  return { texto, itens };
}

function textoInline(tokens = []) {
  return tokens
    .filter((token) => !token.hidden && !/_open$|_close$/.test(token.type))
    .map((token) => token.content || '')
    .join('')
    .trim();
}

function retirarAncoraExplicita(inline) {
  const match = String(inline.content || '').match(/\s*\{#([^}]+)\}\s*$/);
  if (!match) return null;
  inline.content = inline.content.replace(/\s*\{#[^}]+\}\s*$/, '');
  const children = inline.children || [];
  for (let i = children.length - 1; i >= 0; i -= 1) {
    if (children[i].type !== 'text') continue;
    children[i].content = children[i].content.replace(/\s*\{#[^}]+\}\s*$/, '');
    break;
  }
  return match[1];
}

export function renderizarMarkdown({ projeto, locale, pagina, rotasTodas, rotasVisiveis }) {
  const md = new MarkdownIt({ html: false, linkify: false, typographer: false });
  const toc = [];
  const slugger = new Slugger();

  md.core.ruler.push('playsaurus-heading-ids', (state) => {
    for (let i = 0; i < state.tokens.length - 1; i += 1) {
      const open = state.tokens[i];
      const inline = state.tokens[i + 1];
      if (open.type !== 'heading_open' || inline?.type !== 'inline') continue;
      const explicita = retirarAncoraExplicita(inline);
      const titulo = aplicarBranding(textoInline(inline.children), projeto);
      const id = explicita || slugger.slug(titulo);
      open.attrSet('id', id);
      const nivel = Number(open.tag.slice(1));
      if ((nivel === 2 || nivel === 3) && titulo) toc.push({ nivel, id, titulo });
    }
  });

  const fencePadrao = md.renderer.rules.fence?.bind(md.renderer);
  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const linguagem = String(token.info || '').trim().split(/\s+/)[0].toLowerCase();
    if (linguagem === 'mermaid') {
      return `<pre class="mermaid">${escaparHtml(token.content)}</pre>\n`;
    }
    if (fencePadrao) return fencePadrao(tokens, idx, options, env, self);
    return `<pre><code>${escaparHtml(token.content)}</code></pre>\n`;
  };

  const imagemPadrao = md.renderer.rules.image?.bind(md.renderer);
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const src = token.attrGet('src');
    if (src) token.attrSet('src', resolverImagem(src, projeto, locale, pagina));
    return imagemPadrao ? imagemPadrao(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
  };

  const linkPadrao = md.renderer.rules.link_open?.bind(md.renderer);
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const href = token.attrGet('href');
    if (!href) return linkPadrao ? linkPadrao(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);

    if (/^(?:https?:)?\/\//i.test(href)) {
      token.attrSet('target', '_blank');
      token.attrSet('rel', 'noopener noreferrer');
    } else {
      const interno = linkInterno(href, projeto, locale, pagina);
      if (interno) {
        const existe = interno.rota === '' || rotasTodas.has(interno.rota);
        if (!existe) throw new Error(`Link quebrado em ${pagina.id}: ${href}`);

        const visivel = interno.rota === '' || rotasVisiveis.has(interno.rota);
        if (!visivel) {
          token.attrSet('aria-disabled', 'true');
          token.attrs = (token.attrs || []).filter(([nome]) => !['href', 'target', 'rel'].includes(nome));
        } else {
          token.attrSet('href', urlPagina(projeto, interno.locale, interno.rota, interno.ancora));
        }
      }
    }
    return linkPadrao ? linkPadrao(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options);
  };

  const admonitions = prepararAdmonitions(pagina.markdown);
  let html = md.render(admonitions.texto);
  for (const [indice, item] of admonitions.itens.entries()) {
    const classe = ['warning', 'caution', 'danger'].includes(item.tipo)
      ? `alert--${item.tipo === 'caution' ? 'warning' : item.tipo}`
      : `alert--${item.tipo}`;
    const titulo = item.titulo
      ? `<div class="ps-admonition-title"><strong>${escaparHtml(item.titulo)}</strong></div>`
      : '';
    const corpo = md.render(item.corpo).trim();
    const bloco = `<div class="alert ${classe} ps-admonition" role="note">${titulo}${corpo}</div>`;
    html = html.replace(new RegExp(`<p>PLAYSAURUSADMONITION${indice}TOKEN<\\/p>\\s*`, 'g'), bloco);
  }

  return {
    html: aplicarBranding(html, projeto),
    toc,
    hasMermaid: /<pre class="mermaid">/i.test(html),
  };
}
