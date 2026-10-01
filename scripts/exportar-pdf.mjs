/**
 * Exporta PDFs A4 por modo e por idioma a partir do artefato standalone final.
 *
 * Com um único idioma, gera `documentacao-cliente.pdf`/`documentacao-equipe.pdf`.
 * Com vários idiomas, usa o locale no nome para evitar ambiguidades.
 */
import { spawn } from 'node:child_process';
import net from 'node:net';
import fs from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';
import { RAIZ, carregarProjeto, executar, idDoArgumento, encerrarComErro } from './comum.mjs';
import { urlPagina } from '../compartilhado/paginas.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const HOST = '127.0.0.1';
const MODOS = [{ modo: 'publico', rotulo: 'cliente' }, { modo: 'interno', rotulo: 'equipe' }];

const CAPA_UI = {
  'pt-BR': {
    tags: { arquitetura: 'PARA DESENVOLVEDORES', usabilidade: 'PARA USUÁRIOS', referencia: 'CONSULTA RÁPIDA' },
  },
  'pt-PT': {
    tags: { arquitetura: 'PARA PROGRAMADORES', usabilidade: 'PARA UTILIZADORES', referencia: 'CONSULTA RÁPIDA' },
  },
  en: {
    tags: { arquitetura: 'FOR DEVELOPERS', usabilidade: 'FOR USERS', referencia: 'QUICK REFERENCE' },
  },
  es: {
    tags: { arquitetura: 'PARA DESARROLLADORES', usabilidade: 'PARA USUARIOS', referencia: 'CONSULTA RÁPIDA' },
  },
};

function htmlEsc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

function capaUi(locale) {
  return CAPA_UI[locale] || CAPA_UI[locale.split('-')[0]] || CAPA_UI.en;
}

function portaLivre() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.on('error', reject);
    s.listen(0, HOST, () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

function esperarPorta(port, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const inicio = Date.now();
    const tentar = () => {
      const s = net.connect(port, HOST);
      s.once('connect', () => { s.destroy(); resolve(); });
      s.once('error', () => {
        s.destroy();
        if (Date.now() - inicio > timeout) reject(new Error('preview standalone não respondeu a tempo'));
        else setTimeout(tentar, 250);
      });
    };
    tentar();
  });
}

async function servir(id, modo) {
  const port = await portaLivre();
  const proc = spawn(process.execPath, [path.join(aqui, 'serve.mjs'), id], {
    cwd: RAIZ,
    env: { ...process.env, DOC_PROJETO: id, DOC_MODO: modo, PORT: String(port), FORCE_COLOR: '0' },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let erro = '';
  proc.stderr.on('data', (chunk) => { erro += chunk; });
  try {
    await esperarPorta(port);
  } catch (e) {
    if (!proc.killed) proc.kill();
    throw new Error(`${e.message}${erro.trim() ? `\n${erro.trim()}` : ''}`);
  }
  return { proc, port };
}

function carregarDadosStandalone(dir) {
  const arquivo = path.join(dir, 'index.html');
  if (!fs.existsSync(arquivo)) throw new Error(`Standalone não encontrado: ${path.relative(RAIZ, arquivo)}`);
  const html = fs.readFileSync(arquivo, 'utf8');
  const match = html.match(/<script\b[^>]*\bid=["']playsaurus-data["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) throw new Error(`Standalone inválido: playsaurus-data ausente em ${path.relative(RAIZ, arquivo)}.`);
  try { return JSON.parse(match[1]); }
  catch (e) { throw new Error(`Standalone inválido: playsaurus-data não pôde ser lido (${e.message}).`); }
}

function urlStandalone(origem, projeto, locale, rota = '') {
  return new URL(urlPagina(projeto, locale, rota), origem).href;
}

async function imprimirCapa(page, projeto, dados, locale, secoes) {
  const idioma = dados.locales?.find((x) => x.locale === locale)
    || projeto.idiomas.disponiveis.find((x) => x.locale === locale)
    || {};
  const titulo = idioma.homeTitulo || dados.project?.homeTitle || dados.project?.name || projeto.nome;
  const tagline = idioma.tagline || dados.project?.tagline || projeto.tagline || '';
  const ui = capaUi(locale);
  const temaCss = fs.existsSync(projeto.arquivoTema)
    ? fs.readFileSync(projeto.arquivoTema, 'utf8')
    : '';
  const cards = secoes.map((secao) => `
    <section class="card">
      ${ui.tags[secao.id] ? `<div class="tag">${htmlEsc(ui.tags[secao.id])}</div>` : ''}
      <h2>${htmlEsc(secao.label)}</h2>
      <p>${htmlEsc(secao.description || '')}</p>
    </section>`).join('');
  await page.setContent(`<!doctype html><html lang="${htmlEsc(idioma.htmlLang || locale)}"><head><meta charset="utf-8"><style>
    ${temaCss}
    *{box-sizing:border-box}
    html,body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:var(--doc-text,#172033);background:var(--doc-background,#fff)}
    .hero{padding:42px 48px;background:var(--doc-hero-gradient,linear-gradient(135deg,#1f2937,#334155));color:#fff;text-align:center}
    .hero h1{margin:0 0 12px;font-size:34px;line-height:1.15}
    .hero p{margin:0;font-size:18px;color:rgba(255,255,255,.82)}
    .cards{padding:0 0 10px}
    .card{margin:0 0 18px;padding:28px;border:1px solid var(--doc-border,#e5e7eb);border-radius:12px;break-inside:avoid;background:var(--doc-surface,#fff)}
    .tag{margin-bottom:12px;color:var(--doc-primary,#2563eb);font-size:12px;font-weight:700;letter-spacing:.05em}
    .card h2{margin:0 0 10px;font-size:24px;color:var(--doc-text,#172033)}
    .card p{margin:0;color:var(--doc-text-muted,#64748b);font-size:16px;line-height:1.5}
  </style></head><body><header class="hero"><h1>${htmlEsc(titulo)}</h1><p>${htmlEsc(tagline)}</p></header><main class="cards">${cards}</main></body></html>`, { waitUntil: 'load' });
  return page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' } });
}

async function imprimir(page, url) {
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForSelector('.ps-article', { timeout: 10000 });
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await page.emulateMedia({ media: 'print', colorScheme: 'light' });
  await page.evaluate(() => document.fonts?.ready || Promise.resolve());
  if (await page.$('.mermaid')) await page.waitForSelector('.mermaid svg', { timeout: 5000 }).catch(() => {});
  return page.pdf({ format: 'A4', printBackground: true, margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' } });
}

async function gerarPdfLocale(browser, origem, projeto, dados, locale, rotulo, variosIdiomas) {
  const conteudo = dados.content?.[locale];
  if (!conteudo) return;

  const page = await browser.newPage();
  const urls = [
    urlStandalone(origem, projeto, locale),
    ...conteudo.pages.map((pagina) => urlStandalone(origem, projeto, locale, pagina.route)),
  ];
  console.log(`[${rotulo}/${locale}] ${urls.length} páginas. Imprimindo...`);
  const merged = await PDFDocument.create();

  const capa = await imprimirCapa(page, projeto, dados, locale, conteudo.sections || []);
  const capaDoc = await PDFDocument.load(capa);
  const capaPaginas = await merged.copyPages(capaDoc, capaDoc.getPageIndices());
  capaPaginas.forEach((p) => merged.addPage(p));

  for (const [i, pagina] of conteudo.pages.entries()) {
    const url = urls[i + 1];
    process.stdout.write(`  [${i + 2}/${urls.length}] ${urlPagina(projeto, locale, pagina.route)}\n`);
    const buffer = await imprimir(page, url);
    const doc = await PDFDocument.load(buffer);
    const copiadas = await merged.copyPages(doc, doc.getPageIndices());
    copiadas.forEach((p) => merged.addPage(p));
  }

  await page.close();
  const nome = variosIdiomas
    ? `documentacao-${rotulo}.${locale}.pdf`
    : `documentacao-${rotulo}.pdf`;
  const destino = path.join(projeto.dirStatic, 'pdf', nome);
  await mkdir(path.dirname(destino), { recursive: true });
  await writeFile(destino, await merged.save());
  console.log(`[${rotulo}/${locale}] ${path.relative(RAIZ, destino)}`);
}

try {
  const id = idDoArgumento();
  const projeto = carregarProjeto(id);
  console.log(`Exportando a documentação do ${projeto.nome} (${id}) em PDF...`);
  console.log('Gerando build único para cliente + equipe...');
  await executar(process.execPath, [path.join(aqui, 'build.mjs'), id]);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const { modo, rotulo } of MODOS) {
      console.log(`\n[${rotulo}] Exportando a partir do standalone existente...`);
      const dir = modo === 'publico' ? projeto.dirBuildCliente : projeto.dirBuild;
      const dados = carregarDadosStandalone(dir);
      const locales = (dados.locales || [])
        .map((idioma) => idioma.locale)
        .filter((locale) => dados.content?.[locale]);
      if (!locales.length) throw new Error(`Standalone ${rotulo} não contém idiomas para exportar.`);

      const dirPdf = path.join(projeto.dirStatic, 'pdf');
      if (fs.existsSync(dirPdf)) {
        const padrao = new RegExp(`^documentacao-${rotulo}(?:\\.[^.]+)?\\.pdf$`);
        for (const nome of fs.readdirSync(dirPdf)) {
          if (padrao.test(nome)) fs.rmSync(path.join(dirPdf, nome), { force: true });
        }
      }

      const { proc, port } = await servir(id, modo);
      try {
        const origem = `http://${HOST}:${port}`;
        const variosIdiomas = locales.length > 1;
        for (const locale of locales) {
          await gerarPdfLocale(browser, origem, projeto, dados, locale, rotulo, variosIdiomas);
        }
      } finally {
        if (!proc.killed) proc.kill();
      }

      // O build já contém exatamente as páginas/idiomas que foram impressos.
      // Reempacotamos apenas para incorporar os PDFs recém-gerados ao mesmo artefato.
      await executar(process.execPath, [path.join(aqui, 'gerar-standalone.mjs'), id], {
        env: { DOC_MODO: modo, DOC_IDIOMAS_ATIVOS: locales.join(',') },
      });
      console.log(`[${rotulo}] PDFs incorporados ao standalone.`);
    }
  } finally {
    await browser.close();
  }

  console.log('\nPDFs prontos. Os previews já podem baixá-los sem rodar outro build.');
} catch (e) { encerrarComErro(e); }
