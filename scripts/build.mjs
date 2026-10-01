/**
 * Gera os artefatos standalone interno e cliente diretamente dos documentos.
 *
 * Fluxo:
 *   1. lê Markdown/i18n uma única vez;
 *   2. renderiza o pacote interno;
 *   3. renderiza o pacote cliente filtrando seções privadas.
 *
 * Uso: npm run build -- meu-projeto
 */
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, carregarProjeto, idDoArgumento, encerrarComErro } from './comum.mjs';
import { carregarPaginas, listarDocumentos, resolverArquivoTraducao } from '../compartilhado/paginas.mjs';
import { gerarStandalone } from './gerar-standalone.mjs';

function traducaoCompleta(projeto, locale) {
  const fontes = listarDocumentos(projeto.dirDocs);
  if (!fontes.length) return false;

  for (const fonte of fontes) {
    const relativo = path.relative(projeto.dirDocs, fonte).split(path.sep).join('/');
    const traduzido = resolverArquivoTraducao(projeto, locale, relativo);
    if (!fs.existsSync(traduzido)) return false;
    if (fs.readFileSync(traduzido, 'utf8').includes('PLAYSAURUS_TRANSLATION_PENDING')) return false;
  }
  return true;
}

function idiomasDoBuild(projeto) {
  const configurados = projeto.idiomas.disponiveis.map((idioma) => idioma.locale);
  if (projeto.idiomas.exigirTraducoes === true) {
    const pendentes = configurados.filter(
      (locale) => locale !== projeto.idiomas.padrao && !traducaoCompleta(projeto, locale),
    );
    if (pendentes.length) {
      throw new Error(
        `Traduções obrigatórias pendentes: ${pendentes.join(', ')}. ` +
          `Rode npm run i18n:check -- ${projeto.id} para ver os arquivos faltantes.`,
      );
    }
    return configurados;
  }

  return projeto.idiomas.disponiveis
    .filter((idioma) => idioma.locale === projeto.idiomas.padrao || traducaoCompleta(projeto, idioma.locale))
    .map((idioma) => idioma.locale);
}

function validarStandalone(dir) {
  const index = path.join(dir, 'index.html');
  if (!fs.existsSync(index)) {
    throw new Error(`Build não gerou ${path.relative(RAIZ, index)}.`);
  }
  const html = fs.readFileSync(index, 'utf8');
  if (!html.includes('id="playsaurus-data"') || !html.includes('class="ps-header"')) {
    throw new Error(`O arquivo ${path.relative(RAIZ, index)} não é um build standalone válido do Playsaurus.`);
  }
  const helpIndex = path.join(dir, 'help-index.json');
  if (!fs.existsSync(helpIndex)) {
    throw new Error(`Build não gerou ${path.relative(RAIZ, helpIndex)}.`);
  }
}

try {
  const id = idDoArgumento();
  const configurado = carregarProjeto(id);
  console.log(`Gerando a documentação do ${configurado.nome} (${id}) — interno + cliente...`);

  const idiomasAtivos = idiomasDoBuild(configurado);
  const idiomasIgnorados = configurado.idiomas.disponiveis
    .map((idioma) => idioma.locale)
    .filter((locale) => !idiomasAtivos.includes(locale));
  if (idiomasIgnorados.length) {
    console.log(`Idiomas com tradução pendente, fora deste build: ${idiomasIgnorados.join(', ')}.`);
  }

  const anteriorIdiomas = process.env.DOC_IDIOMAS_ATIVOS;
  process.env.DOC_IDIOMAS_ATIVOS = idiomasAtivos.join(',');
  try {
    const projeto = carregarProjeto(id);
    console.log('Etapa 1/3 · Lendo Markdown e montando o modelo de páginas...');
    const modelo = carregarPaginas(projeto);

    console.log('Etapa 2/3 · Gerando standalone interno...');
    gerarStandalone({
      id,
      modo: 'interno',
      destino: projeto.dirBuild,
      projetoBase: projeto,
      modeloBase: modelo,
    });

    console.log('Etapa 3/3 · Gerando standalone cliente...');
    gerarStandalone({
      id,
      modo: 'publico',
      destino: projeto.dirBuildCliente,
      projetoBase: projeto,
      modeloBase: modelo,
    });

    validarStandalone(projeto.dirBuild);
    validarStandalone(projeto.dirBuildCliente);
    console.log(`\nBuild interno: ${path.relative(RAIZ, projeto.dirBuild)}`);
    console.log(`Build cliente: ${path.relative(RAIZ, projeto.dirBuildCliente)}`);
  } finally {
    if (anteriorIdiomas == null) delete process.env.DOC_IDIOMAS_ATIVOS;
    else process.env.DOC_IDIOMAS_ATIVOS = anteriorIdiomas;
  }
} catch (e) {
  encerrarComErro(e);
}
