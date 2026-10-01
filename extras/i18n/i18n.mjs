/** Verifica ou inicializa os arquivos traduzíveis de um projeto. */
import fs from 'node:fs';
import path from 'node:path';
import { carregarProjeto, idDoArgumento, encerrarComErro, RAIZ } from '../../scripts/comum.mjs';
import { listarDocumentos, resolverArquivoTraducao } from '../../compartilhado/paginas.mjs';

try {
  const argv = process.argv.slice(2);
  const id = idDoArgumento(argv);
  const init = argv.includes('--init');
  const projeto = carregarProjeto(id);

  const fontes = listarDocumentos(projeto.dirDocs);
  let totalFaltantes = 0;

  for (const idioma of projeto.idiomas.disponiveis) {
    if (idioma.locale === projeto.idiomas.padrao) continue;
    const dir = path.join(projeto.dirI18n, idioma.locale);
    const faltantes = [];

    for (const fonte of fontes) {
      const rel = path.relative(projeto.dirDocs, fonte).split(path.sep).join('/');
      const existente = resolverArquivoTraducao(projeto, idioma.locale, rel);
      const existe = fs.existsSync(existente);
      const pendente = existe && fs.readFileSync(existente, 'utf8').includes('PLAYSAURUS_TRANSLATION_PENDING');

      if (!existe || pendente) {
        faltantes.push(rel);
        if (init) {
          // Novos scaffolds sempre usam a estrutura curta da V2:
          // i18n/<locale>/<mesmo caminho de docs/>.
          const alvo = path.join(dir, ...rel.split('/'));
          fs.mkdirSync(path.dirname(alvo), { recursive: true });
          const conteudo = fs.readFileSync(fonte, 'utf8');
          const marcador = `<!-- PLAYSAURUS_TRANSLATION_PENDING: ${idioma.locale} -->`;
          let scaffold;
          if (conteudo.startsWith('---\n')) {
            const fim = conteudo.indexOf('\n---', 4);
            if (fim >= 0) {
              const depois = fim + 4;
              scaffold = `${conteudo.slice(0, depois)}\n${marcador}${conteudo.slice(depois)}`;
            }
          }
          if (!scaffold) scaffold = `${marcador}\n${conteudo}`;
          fs.writeFileSync(alvo, scaffold);
        }
      }
    }

    totalFaltantes += faltantes.length;
    console.log(`${idioma.rotulo} (${idioma.locale}): ${fontes.length - faltantes.length}/${fontes.length} arquivos traduzidos${faltantes.length ? ` · ${faltantes.length} pendentes` : ' · OK'}`);
    if (faltantes.length && !init) faltantes.slice(0, 20).forEach((f) => console.log(`  - ${f}`));
    if (faltantes.length > 20 && !init) console.log(`  - ... +${faltantes.length - 20}`);
    if (init && faltantes.length) console.log(`  scaffold criado em ${path.relative(RAIZ, dir)} (marcado como PLAYSAURUS_TRANSLATION_PENDING)`);
  }

  if (init) console.log('\nAgora traduza os arquivos criados e remova o marcador PLAYSAURUS_TRANSLATION_PENDING.');
  else if (totalFaltantes) process.exitCode = 2;
} catch (e) { encerrarComErro(e); }
