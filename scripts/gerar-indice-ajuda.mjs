/**
 * Gera somente o help-index.json.
 *
 * O build normal já grava este arquivo junto com o standalone usando o mesmo
 * modelo de páginas. Este comando fica como atalho CLI para regenerar o índice
 * sem executar o build completo.
 */
import path from 'node:path';
import { carregarProjeto, aplicarModo, idDoArgumento, encerrarComErro } from './comum.mjs';
import { carregarPaginas, gravarIndiceAjuda } from '../compartilhado/paginas.mjs';

try {
  const id = idDoArgumento();
  const modo = process.env.DOC_MODO === 'publico' ? 'publico' : 'interno';
  const projeto = aplicarModo(carregarProjeto(id), modo);
  const modelo = carregarPaginas(projeto);
  const outFile = process.env.DOC_INDEX_OUT || path.join(
    modo === 'publico' ? projeto.dirBuildCliente : projeto.dirBuild,
    'help-index.json',
  );
  const contagens = gravarIndiceAjuda(projeto, modelo, outFile);

  console.log(`Índice de ajuda: ${outFile}`);
  for (const [locale, dados] of Object.entries(contagens)) {
    console.log(`  ${locale}: ${dados.paginas} páginas · ${dados.faqs} FAQs`);
  }
} catch (e) {
  encerrarComErro(e);
}
