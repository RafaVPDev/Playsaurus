import fs from 'node:fs';
import path from 'node:path';

class GithubLikeSlugger {
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

export function aplicarBranding(texto, projeto) {
  let saida = String(texto ?? '');
  for (const item of projeto.branding?.substituicoes || []) {
    if (!item?.de) continue;
    saida = saida.split(String(item.de)).join(String(item.para ?? ''));
  }
  return saida;
}

export function listarDocumentos(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const alvo = path.join(dir, entry.name);
    if (entry.isDirectory()) listarDocumentos(alvo, out);
    else if (/\.md$/i.test(entry.name)) out.push(alvo);
  }
  return out.sort();
}

function lerFrontmatter(texto) {
  if (!texto.startsWith('---')) return { dados: {}, corpo: texto };
  const fim = texto.indexOf('\n---', 3);
  if (fim === -1) return { dados: {}, corpo: texto };
  const bruto = texto.slice(3, fim);
  const corpo = texto.slice(fim + 4);
  const dados = {};
  let chaveLista = null;
  for (const linha of bruto.split('\n')) {
    if (!linha.trim() || linha.trim().startsWith('#')) continue;
    const item = linha.match(/^\s+-\s+(.*)$/);
    if (item && chaveLista) { dados[chaveLista].push(item[1].trim()); continue; }
    const kv = linha.match(/^([\w-]+):\s*(.*)$/);
    if (!kv) continue;
    const [, k, v] = kv;
    if (v === '') { chaveLista = k; dados[k] = []; }
    else { chaveLista = null; dados[k] = v.trim().replace(/^['"]|['"]$/g, ''); }
  }
  return { dados, corpo };
}

function limparMarkdown(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s*[|>-].*$/gm, (l) => l.replace(/[|>]/g, ' '))
    .replace(/[*_`#]/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function rotaDoRelativo(relativo) {
  const partes = relativo.replace(/\.md$/i, '').split('/').map((s) => s.replace(/^\d+-/, ''));
  if (partes.at(-1) === 'index') partes.pop();
  return partes.join('/');
}

/** Caminho da tradução V2: i18n/<locale>/<mesmo caminho de docs/>. */
export function resolverArquivoTraducao(projeto, locale, relativo) {
  return path.join(projeto.dirI18n, locale, ...relativo.split('/'));
}

function posicaoDoRelativo(relativo) {
  const nome = path.posix.basename(relativo).replace(/\.md$/i, '');
  if (nome === 'index') return 0;
  const prefixo = nome.match(/^(\d+)-/);
  return prefixo ? Number(prefixo[1]) : 9999;
}

export function urlPagina(projeto, locale, rota, ancora = '') {
  let base = String(projeto.baseUrl || '/docs/').trim() || '/docs/';
  if (!base.startsWith('/')) base = '/' + base;
  base = '/' + base.replace(/^\/+|\/+$/g, '') + '/';
  const localePrefix = locale && locale !== projeto.idiomas.padrao ? `${encodeURIComponent(locale)}/` : '';
  const routePart = String(rota || '').split('/').filter(Boolean).map((parte) => {
    try { return encodeURIComponent(decodeURIComponent(parte)); } catch { return encodeURIComponent(parte); }
  }).join('/');
  let url = base + localePrefix + routePart;
  if (ancora) url += `#${encodeURIComponent(ancora)}`;
  return url;
}

function localizarFaq(projeto, arquivosRelativos) {
  const configurado = projeto.indiceAjuda?.faqArquivo;
  if (configurado) return configurado;
  return arquivosRelativos
    .filter((r) => /(^|\/)(?:\d+-)?perguntas-frequentes\.md$/i.test(r))
    .sort((a, b) => (a.startsWith('referencia/') ? -1 : 1) || a.localeCompare(b))[0] || null;
}

function extrairFaqs(corpo, publicoPagina, faqAdmin = []) {
  const somenteAdmin = new Set(faqAdmin || []);
  const slugger = new GithubLikeSlugger();
  const faqs = [];
  let categoria = '';
  const linhas = corpo.split('\n');
  for (let i = 0; i < linhas.length; i += 1) {
    const h2 = linhas[i].match(/^##\s+(.+)$/);
    if (h2) { categoria = h2[1].replace(/\s*\{#[^}]+\}\s*$/, '').trim(); continue; }
    const h3 = linhas[i].match(/^###\s+(.+)$/);
    if (!h3) continue;
    let pergunta = h3[1].trim();
    const explicito = pergunta.match(/\s*\{#([^}]+)\}\s*$/);
    pergunta = pergunta.replace(/\s*\{#[^}]+\}\s*$/, '').trim();
    const id = explicito ? explicito[1] : slugger.slug(pergunta);
    const resposta = [];
    for (let j = i + 1; j < linhas.length && !/^#{2,3}\s+/.test(linhas[j]); j += 1) resposta.push(linhas[j]);
    faqs.push({
      pergunta,
      resposta: limparMarkdown(resposta.join('\n')),
      categoria,
      publico: somenteAdmin.has(categoria) ? 'admin' : publicoPagina,
      ancora: id,
    });
  }
  return faqs;
}

function headingsDoMarkdown(corpo, projeto) {
  return [...corpo.matchAll(/^#{2,3}\s+(.+)$/gm)]
    .map((m) => aplicarBranding(
      m[1]
        .replace(/\s*\{#[^}]+\}\s*$/, '')
        .replace(/[*`]/g, '')
        .replace(/^\d+(\.\d+)*\.?\s*/, '')
        .trim(),
      projeto,
    ))
    .filter(Boolean);
}

/**
 * Lê cada documento uma única vez por locale e devolve o modelo canónico que
 * os geradores consomem. O HTML compilado é acrescentado depois pelo standalone.
 */
export function carregarPaginas(projeto) {
  const secoesPermitidas = new Set(projeto.secoes.map((s) => s.id));
  const relativos = listarDocumentos(projeto.dirDocs)
    .map((arquivo) => path.relative(projeto.dirDocs, arquivo).split(path.sep).join('/'))
    .filter((relativo) => secoesPermitidas.has(relativo.split('/')[0]))
    .sort();
  const faqRelativo = localizarFaq(projeto, relativos);
  const porLocale = {};
  const faltantesPorLocale = {};

  for (const idioma of projeto.idiomas.disponiveis) {
    const locale = idioma.locale;
    const paginas = [];
    let faqs = [];
    const faltantes = [];

    for (const [ordemFonte, relativo] of relativos.entries()) {
      const secaoId = relativo.split('/')[0];
      const padrao = path.join(projeto.dirDocs, ...relativo.split('/'));
      const traduzido = resolverArquivoTraducao(projeto, locale, relativo);

      let fonte = padrao;
      let bruto = fs.readFileSync(padrao, 'utf8');
      if (locale !== projeto.idiomas.padrao) {
        if (fs.existsSync(traduzido)) {
          const candidato = fs.readFileSync(traduzido, 'utf8');
          if (!candidato.includes('PLAYSAURUS_TRANSLATION_PENDING')) {
            fonte = traduzido;
            bruto = candidato;
          } else {
            faltantes.push(relativo);
          }
        } else {
          faltantes.push(relativo);
        }
      }

      const { dados, corpo } = lerFrontmatter(bruto);
      const rota = rotaDoRelativo(relativo);
      const titulo = aplicarBranding(
        (corpo.match(/^#\s+(.+)$/m) || [, path.basename(relativo).replace(/\.md$/i, '')])[1].trim(),
        projeto,
      );
      const texto = aplicarBranding(limparMarkdown(corpo.replace(/^#\s+.+$/m, '')), projeto);
      const posicao = posicaoDoRelativo(relativo);
      const publico = dados.publico || 'todos';
      const pagina = {
        id: relativo,
        rota,
        secaoId,
        titulo,
        publico,
        posicao,
        headings: headingsDoMarkdown(corpo, projeto),
        resumo: texto.slice(0, 220),
        texto,
        markdown: corpo,
        fonte,
        ordemFonte,
      };
      paginas.push(pagina);

      if (faqRelativo && relativo === faqRelativo) {
        faqs = extrairFaqs(corpo, publico, dados.faq_admin || []).map((faq) => ({
          ...faq,
          pergunta: aplicarBranding(faq.pergunta, projeto),
          resposta: aplicarBranding(faq.resposta, projeto),
          categoria: aplicarBranding(faq.categoria, projeto),
          url: urlPagina(projeto, locale, rota, faq.ancora),
        }));
      }
    }

    paginas.sort((a, b) => {
      const sa = projeto.secoes.findIndex((s) => s.id === a.secaoId);
      const sb = projeto.secoes.findIndex((s) => s.id === b.secaoId);
      return sa - sb || a.posicao - b.posicao || a.rota.localeCompare(b.rota);
    });

    const labelsSecao = Object.fromEntries(projeto.secoes.map((secao) => {
      const index = paginas.find((pagina) => pagina.rota === secao.id);
      return [secao.id, aplicarBranding(index?.titulo || secao.rotulo, projeto)];
    }));
    for (const pagina of paginas) pagina.secao = labelsSecao[pagina.secaoId] || pagina.secaoId;

    if (projeto.idiomas.exigirTraducoes === true && faltantes.length) {
      throw new Error(`Faltam ${faltantes.length} traduções para ${locale}:\n- ${faltantes.slice(0, 20).join('\n- ')}${faltantes.length > 20 ? '\n- ...' : ''}`);
    }

    porLocale[locale] = { paginas, faqs, labelsSecao };
    faltantesPorLocale[locale] = faltantes;
  }

  return { porLocale, faltantesPorLocale, faqRelativo };
}


/**
 * Recorta um modelo já lido para as seções visíveis do modo atual sem voltar
 * ao disco. Interno e cliente partem do mesmo Page[] carregado uma única vez.
 */
export function filtrarModelo(modelo, projeto) {
  const permitidas = new Set((projeto.secoes || []).map((secao) => secao.id));
  const faqSecao = String(modelo.faqRelativo || '').split('/')[0];
  const porLocale = {};

  for (const [locale, dados] of Object.entries(modelo.porLocale || {})) {
    const paginas = (dados.paginas || []).filter((pagina) => permitidas.has(pagina.secaoId));
    porLocale[locale] = {
      ...dados,
      paginas,
      faqs: faqSecao && !permitidas.has(faqSecao) ? [] : [...(dados.faqs || [])],
      labelsSecao: Object.fromEntries(
        Object.entries(dados.labelsSecao || {}).filter(([id]) => permitidas.has(id)),
      ),
    };
  }

  return {
    ...modelo,
    porLocale,
    faltantesPorLocale: { ...(modelo.faltantesPorLocale || {}) },
  };
}

export function payloadIndiceAjuda(projeto, modelo) {
  const porLocale = {};
  for (const idioma of projeto.idiomas.disponiveis) {
    const locale = idioma.locale;
    const dados = modelo.porLocale[locale] || { paginas: [], faqs: [] };
    porLocale[locale] = {
      paginas: [...dados.paginas]
        .sort((a, b) => a.ordemFonte - b.ordemFonte)
        .map((pagina) => ({
        id: pagina.id,
        titulo: pagina.titulo,
        secao: pagina.secao,
        secaoId: pagina.secaoId,
        url: urlPagina(projeto, locale, pagina.rota),
        publico: pagina.publico,
        headings: pagina.headings,
        resumo: pagina.texto.slice(0, 220),
        texto: pagina.texto,
      })),
      faqs: dados.faqs,
    };
  }

  const padrao = porLocale[projeto.idiomas.padrao] || { paginas: [], faqs: [] };
  return {
    version: 2,
    projeto: { id: projeto.id, nome: aplicarBranding(projeto.nome, projeto) },
    defaultLocale: projeto.idiomas.padrao,
    locales: projeto.idiomas.disponiveis.map((i) => ({
      locale: i.locale,
      appLocale: i.appLocale || i.locale,
      label: i.rotulo,
      htmlLang: i.htmlLang || i.locale,
    })),
    paginas: padrao.paginas,
    faqs: padrao.faqs,
    porLocale,
    geradoEm: new Date().toISOString(),
  };
}

export function gravarIndiceAjuda(projeto, modelo, outFile) {
  const payload = payloadIndiceAjuda(projeto, modelo);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`);
  return Object.fromEntries(Object.entries(payload.porLocale).map(([locale, dados]) => [locale, {
    paginas: dados.paginas.length,
    faqs: dados.faqs.length,
  }]));
}
