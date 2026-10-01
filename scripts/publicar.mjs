/**
 * Publica o artefato final dentro do app do produto.
 *
 * No modo standalone, o produto recebe somente:
 *   public/docs/index.html
 *   public/docs/help-index.json
 *   public/docs/pdf/*.pdf (quando existirem)
 *
 * O fonte da documentação, Playwright e i18n permanecem exclusivamente no
 * repositório do Playsaurus.
 */
import { cp, rm, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RAIZ, carregarProjeto, destinoPublicacao, executar, idDoArgumento, encerrarComErro } from './comum.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));

try {
  const id = idDoArgumento();
  const projeto = carregarProjeto(id);
  const { repositorio, destino, origem, detalhe } = destinoPublicacao(projeto);
  console.log(`Produto:      ${projeto.nome} (${id})`);
  console.log(`Repositório:  ${repositorio}  [${origem}: ${detalhe}]`);
  console.log(`Destino:      ${destino}\n`);

  const pai = path.dirname(destino);
  if (!existsSync(pai)) {
    throw new Error(`A pasta ${pai} não existe.\nConfira o caminho do repositório em \`npm run painel\`.`);
  }

  // O build atualiza interno + cliente a partir do mesmo modelo de páginas.
  await executar(process.execPath, [path.join(aqui, 'build.mjs'), id]);

  if (!existsSync(projeto.dirBuildCliente)) {
    throw new Error(`Build público não encontrado em ${path.relative(RAIZ, projeto.dirBuildCliente)}.`);
  }

  console.log(`\nSubstituindo ${path.relative(repositorio, destino)}...`);
  await rm(destino, { recursive: true, force: true });
  await mkdir(destino, { recursive: true });
  await cp(projeto.dirBuildCliente, destino, { recursive: true });

  const itens = await readdir(destino, { withFileTypes: true });
  const resumo = itens.map((i) => `${i.isDirectory() ? 'dir ' : 'file'} ${i.name}`).join(', ');
  console.log(`Artefato publicado: ${resumo}`);
  console.log(`\nDocumentação publicada em ${path.relative(RAIZ, destino)}`);
  console.log(`Falta o último passo, manual: publicar o ${projeto.nome} pela plataforma de hospedagem.`);
} catch (e) {
  encerrarComErro(e);
}
