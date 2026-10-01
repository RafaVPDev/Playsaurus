/**
 * Gera o portal standalone diretamente dos documentos Markdown.
 *
 * Não existe build HTML intermediário: o Playsaurus lê o Page[] uma vez,
 * renderiza Markdown, incorpora imagens e grava o artefato final.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { carregarProjeto, aplicarModo, idDoArgumento, encerrarComErro, RAIZ } from './comum.mjs';
import {
  aplicarBranding,
  carregarPaginas,
  filtrarModelo,
  gravarIndiceAjuda,
  urlPagina,
} from '../compartilhado/paginas.mjs';
import { renderizarMarkdown } from '../compartilhado/markdown.mjs';

const MIMES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif', '.ico': 'image/x-icon',
};

function dataUri(arquivo) {
  const mime = MIMES[path.extname(arquivo).toLowerCase()] || 'application/octet-stream';
  return `data:${mime};base64,${fs.readFileSync(arquivo).toString('base64')}`;
}

function embutirLogo(projeto) {
  if (!projeto.logo) return null;
  const relativo = projeto.logo.replace(/^\/+/, '');
  const arq = path.join(projeto.dirStatic, relativo);
  return fs.existsSync(arq) ? dataUri(arq) : projeto.logo;
}

function copiarPdfs(projeto, destino, modo) {
  const origem = path.join(projeto.dirStatic, 'pdf');
  if (!fs.existsSync(origem)) return [];

  const tipo = modo === 'publico' ? 'cliente' : 'equipe';
  const nomesEsperados = projeto.idiomas.disponiveis.length === 1
    ? [`documentacao-${tipo}.pdf`]
    : projeto.idiomas.disponiveis.map((idioma) => `documentacao-${tipo}.${idioma.locale}.pdf`);
  const existentes = nomesEsperados.filter((nome) => fs.existsSync(path.join(origem, nome)));
  if (!existentes.length) return [];

  const out = path.join(destino, 'pdf');
  fs.mkdirSync(out, { recursive: true });
  const copiados = [];
  for (const nome of existentes) {
    fs.copyFileSync(path.join(origem, nome), path.join(out, nome));
    copiados.push(`pdf/${nome}`);
  }
  return copiados;
}

const UI = {
  'pt-BR': { search: 'Buscar na documentação', pdf: 'Baixar PDF', theme: 'Alternar tema', contents: 'Nesta página', back: 'Voltar ao início', noResults: 'Nenhum resultado encontrado.', allDocs: 'Toda a documentação', menu: 'Menu', close: 'Fechar', access: 'Acessar' },
  'pt-PT': { search: 'Pesquisar na documentação', pdf: 'Transferir PDF', theme: 'Alternar tema', contents: 'Nesta página', back: 'Voltar ao início', noResults: 'Nenhum resultado encontrado.', allDocs: 'Toda a documentação', menu: 'Menu', close: 'Fechar', access: 'Aceder' },
  en: { search: 'Search documentation', pdf: 'Download PDF', theme: 'Toggle theme', contents: 'On this page', back: 'Back to home', noResults: 'No results found.', allDocs: 'All documentation', menu: 'Menu', close: 'Close', access: 'Open' },
  es: { search: 'Buscar en la documentación', pdf: 'Descargar PDF', theme: 'Cambiar tema', contents: 'En esta página', back: 'Volver al inicio', noResults: 'No se encontraron resultados.', allDocs: 'Toda la documentación', menu: 'Menú', close: 'Cerrar', access: 'Abrir' },
};

function uiPara(locale) {
  if (UI[locale]) return UI[locale];
  const curto = locale.split('-')[0];
  return UI[curto] || UI.en;
}

function escaparHtml(texto) {
  return String(texto ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escaparXml(texto) {
  return String(texto ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function urlAbsolutaDocumento(projeto, locale, rota = '') {
  const publica = String(projeto.urlPublica || '').trim();
  if (!publica) return null;
  try { return new URL(urlPagina(projeto, locale, rota), publica).href; }
  catch { return null; }
}

function urlSitemapComIndexHtml(projeto, locale, rota = '') {
  const absoluta = urlAbsolutaDocumento(projeto, locale, rota);
  if (!absoluta) return null;
  try {
    const url = new URL(absoluta);
    const pasta = url.pathname.replace(/\/+$/, '');
    url.pathname = `${pasta || ''}/index.html`;
    url.search = '';
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function gerarSitemap(projeto, dados, destino) {
  const rotas = new Set(['']);
  for (const locale of Object.keys(dados.content || {})) {
    for (const pagina of dados.content[locale]?.pages || []) rotas.add(pagina.route || '');
  }

  const entries = [];
  for (const rota of rotas) {
    for (const idioma of projeto.idiomas.disponiveis) {
      const locale = idioma.locale;
      if (rota && !dados.content[locale]?.pages.some((p) => p.route === rota)) continue;
      const loc = urlSitemapComIndexHtml(projeto, locale, rota);
      if (!loc) continue;
      entries.push(
        `  <url>\n` +
        `    <loc>${escaparXml(loc)}</loc>\n` +
        `    <changefreq>weekly</changefreq>\n` +
        `    <priority>0.5</priority>\n` +
        `  </url>`,
      );
    }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
    `xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" ` +
    `xmlns:xhtml="http://www.w3.org/1999/xhtml" ` +
    `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" ` +
    `xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n` +
    `${entries.join('\n')}\n` +
    `</urlset>\n`;

  fs.writeFileSync(path.join(destino, 'sitemap.xml'), xml);
  return entries.length;
}

function mermaidBundle(dados) {
  if (!dados.hasMermaid) return '';
  const arquivo = path.join(RAIZ, 'node_modules', 'mermaid', 'dist', 'mermaid.min.js');
  if (!fs.existsSync(arquivo)) {
    throw new Error('Mermaid não está instalado. Rode `npm install` antes de gerar a documentação.');
  }
  return fs.readFileSync(arquivo, 'utf8').replace(/<\/script/gi, '<\\/script');
}

function gerarHtml(projeto, dados, temaCss) {
  const json = JSON.stringify(dados)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  const runtimeCss = fs.readFileSync(path.join(RAIZ, 'compartilhado', 'standalone', 'runtime.css'), 'utf8');
  const runtimeJs = fs.readFileSync(path.join(RAIZ, 'compartilhado', 'standalone', 'runtime.js'), 'utf8');
  const mermaidJs = mermaidBundle(dados);
  const logoHtml = dados.logo ? `<img class="ps-logo" src="${dados.logo}" alt="">` : '';
  const faviconHtml = dados.logo ? `<link rel="icon" type="image/png" href="${escaparHtml(dados.logo)}">` : '';
  return `<!doctype html>
<html lang="${escaparHtml(projeto.idiomas.padrao)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="color-scheme" content="light dark">
${faviconHtml}
<title>${escaparHtml(projeto.nome)}</title>
<style>${temaCss}\n${runtimeCss}</style>
</head>
<body>
<header class="ps-header">
  <button class="ps-action ps-mobile-menu" id="menuBtn" aria-label="Menu">☰</button>
  <a class="ps-brand" id="homeLink" href="${escaparHtml(projeto.baseUrl)}">${logoHtml}<span class="ps-title">${escaparHtml(projeto.nome)}</span></a>
  <div class="ps-spacer"></div>
  <div class="ps-search-wrap"><input class="ps-search" id="search" autocomplete="off"><div class="ps-results" id="results"></div></div>
  <div class="ps-locale" id="localePicker">
    <button class="ps-locale-btn" id="localeBtn" type="button" aria-haspopup="listbox" aria-expanded="false"><span id="localeLabel"></span><span class="ps-locale-chevron" aria-hidden="true"></span></button>
    <div class="ps-locale-menu" id="localeMenu" role="listbox" aria-label="Language"></div>
  </div>
  <a class="ps-action pdf-label" id="pdfBtn" download><span id="pdfLabel"></span></a>
  <button class="ps-action" id="themeBtn" aria-label="Theme">◐</button>
</header>
<div class="ps-layout">
  <aside class="ps-sidebar" id="sidebar"></aside>
  <main class="ps-main" id="main"></main>
  <aside class="ps-toc" id="toc"></aside>
</div>
<script id="playsaurus-data" type="application/json">${json}</script>
${mermaidJs ? `<script>${mermaidJs}</script>` : ''}
<script>${runtimeJs}</script>
</body></html>`;
}

export function gerarStandalone({
  id,
  modo = process.env.DOC_MODO === 'publico' ? 'publico' : 'interno',
  destino,
  projetoBase = null,
  modeloBase = null,
}) {
  const base = projetoBase || carregarProjeto(id);
  const projeto = aplicarModo(base, modo);
  const modeloCompleto = modeloBase || carregarPaginas(base);
  const modelo = filtrarModelo(modeloCompleto, projeto);
  const temaCss = fs.existsSync(projeto.arquivoTema)
    ? aplicarBranding(fs.readFileSync(projeto.arquivoTema, 'utf8'), projeto)
    : '';

  fs.rmSync(destino, { recursive: true, force: true });
  fs.mkdirSync(destino, { recursive: true });

  const content = {};
  let hasMermaid = false;
  for (const idioma of projeto.idiomas.disponiveis) {
    const locale = idioma.locale;
    const todas = new Set((modeloCompleto.porLocale[locale]?.paginas || []).map((pagina) => pagina.rota));
    const visiveis = new Set((modelo.porLocale[locale]?.paginas || []).map((pagina) => pagina.rota));
    const paginas = (modelo.porLocale[locale]?.paginas || []).map((pagina) => {
      const renderizada = renderizarMarkdown({
        projeto,
        locale,
        pagina,
        rotasTodas: todas,
        rotasVisiveis: visiveis,
      });
      hasMermaid ||= renderizada.hasMermaid;
      return {
        ...pagina,
        resumoRuntime: pagina.texto.slice(0, 260),
        toc: renderizada.toc,
        html: renderizada.html,
      };
    });
    modelo.porLocale[locale].paginas = paginas;

    const sections = projeto.secoes.map((secao) => {
      const index = paginas.find((pagina) => pagina.rota === secao.id);
      const descricao = index?.resumoRuntime || index?.resumo || secao.descricao || '';
      return {
        id: secao.id,
        label: aplicarBranding(index?.titulo || secao.rotulo, projeto),
        description: aplicarBranding(descricao, projeto),
      };
    });
    const pages = paginas.map((pagina) => ({
      id: pagina.id,
      route: pagina.rota,
      sectionId: pagina.secaoId,
      title: pagina.titulo,
      audience: pagina.publico,
      position: pagina.posicao,
      summary: pagina.resumoRuntime || pagina.resumo,
      headings: pagina.toc.map((heading) => ({ level: heading.nivel, id: heading.id, title: heading.titulo })),
      html: pagina.html,
    }));
    content[locale] = { sections, pages };
  }

  const faltantesPorLocale = modelo.faltantesPorLocale;
  const pdfs = copiarPdfs(projeto, destino, modo);
  const dados = {
    version: 4,
    build: new Date().toISOString(),
    mode: modo,
    pdfKind: modo === 'publico' ? 'cliente' : 'equipe',
    pdfs,
    hasMermaid,
    baseUrl: projeto.baseUrl,
    defaultLocale: projeto.idiomas.padrao,
    locales: projeto.idiomas.disponiveis.map((idioma) => ({
      locale: idioma.locale,
      appLocale: idioma.appLocale || idioma.locale,
      label: idioma.rotulo,
      htmlLang: idioma.htmlLang || idioma.locale,
      tagline: aplicarBranding(idioma.tagline || null, projeto),
      homeTitulo: aplicarBranding(idioma.homeTitulo || null, projeto),
    })),
    ui: Object.fromEntries(projeto.idiomas.disponiveis.map((idioma) => [idioma.locale, uiPara(idioma.locale)])),
    project: {
      name: aplicarBranding(projeto.nome, projeto),
      tagline: aplicarBranding(projeto.tagline || '', projeto),
      homeTitle: aplicarBranding(projeto.home?.titulo || projeto.nome, projeto),
    },
    logo: embutirLogo(projeto),
    content,
  };

  fs.writeFileSync(path.join(destino, 'index.html'), gerarHtml(projeto, dados, temaCss));
  const indice = gravarIndiceAjuda(projeto, modelo, path.join(destino, 'help-index.json'));
  const sitemapUrls = modo === 'publico' ? gerarSitemap(projeto, dados, destino) : 0;

  fs.mkdirSync(projeto.dirTrabalho, { recursive: true });
  fs.writeFileSync(
    path.join(projeto.dirTrabalho, `translation-report.${modo}.json`),
    JSON.stringify({ defaultLocale: projeto.idiomas.padrao, missing: faltantesPorLocale }, null, 2),
  );

  return {
    paginas: Object.fromEntries(Object.entries(content).map(([locale, dadosLocale]) => [locale, dadosLocale.pages.length])),
    faltantesPorLocale,
    pdfs,
    sitemapUrls,
    indice,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    const id = idDoArgumento();
    const projeto = carregarProjeto(id);
    const modo = process.env.DOC_MODO === 'publico' ? 'publico' : 'interno';
    const destino = modo === 'publico' ? projeto.dirBuildCliente : projeto.dirBuild;
    const r = gerarStandalone({ id, modo, destino });
    console.log(`Standalone pronto em ${path.relative(RAIZ, destino)}/index.html`);
    for (const [locale, qtd] of Object.entries(r.paginas)) {
      const faltam = r.faltantesPorLocale[locale]?.length || 0;
      console.log(`  ${locale}: ${qtd} páginas${faltam ? ` · ${faltam} usando fallback do idioma padrão` : ''}`);
    }
    if (r.sitemapUrls) console.log(`  sitemap.xml: ${r.sitemapUrls} URLs públicas`);
  } catch (e) { encerrarComErro(e); }
}
