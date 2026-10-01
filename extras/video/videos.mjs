/**
 * Grava os vídeos de jornada de um produto.
 *
 * Uso:
 *   npm run videos -- meu-projeto
 *   npm run videos -- meu-projeto tutoriais-rapidos/central-ajuda.jornada.spec.ts
 *
 * Sem um roteiro, percorre recursivamente todos os specs *.jornada.spec.ts.
 * Com um roteiro, executa somente ele. A estrutura sob playwright/ é preservada
 * em static/videos/:
 *
 * playwright/tutoriais-rapidos/central-ajuda.jornada.spec.ts
 *   -> static/videos/tutoriais-rapidos/central-ajuda.webm
 *
 * O vídeo é copiado de projetos/<id>/.playsaurus/videos/ DEPOIS do teste passar — não dentro do
 * teste: `page.video().saveAs()` durante o teste trava até a página fechar.
 *
 * Requer o app rodando na URL base do projeto e projetos/<id>/.env preenchido
 * com as credenciais da conta de demonstração (a mesma dos screenshots).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { BIN, RAIZ, carregarProjeto, executar, idDoArgumento, encerrarComErro } from '../../scripts/comum.mjs';

const SUFIXO_JORNADA = '.jornada.spec.ts';

/** Procura arquivos recursivamente, em ordem estável. */
function arquivosRecursivos(dir, aceitar) {
  const achados = [];
  const varrer = (d) => {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name),
    )) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) varrer(p);
      else if (aceitar(entry.name)) achados.push(p);
    }
  };
  varrer(dir);
  return achados;
}

function caminhoDentro(base, relativo) {
  const resolvido = path.resolve(base, relativo);
  const distancia = path.relative(base, resolvido);
  if (!distancia || distancia.startsWith('..') || path.isAbsolute(distancia)) {
    throw new Error(`Caminho de roteiro inválido: ${relativo}`);
  }
  return resolvido;
}

/** Resolve um roteiro informado em relação à pasta playwright/ do produto. */
function resolverRoteiro(dirPlaywright, informado) {
  let relativo = informado.replaceAll('\\', '/').replace(/^\.?\//, '');
  if (relativo.startsWith('playwright/')) relativo = relativo.slice('playwright/'.length);
  if (!relativo.endsWith(SUFIXO_JORNADA)) relativo += SUFIXO_JORNADA;

  const arquivo = caminhoDentro(dirPlaywright, relativo);
  if (!existsSync(arquivo)) {
    throw new Error(
      `Roteiro não encontrado: ${path.join('playwright', relativo)}\n` +
        `Informe o caminho relativo à pasta playwright/.`,
    );
  }
  return arquivo;
}

function destinoDoRoteiro(projeto, roteiro) {
  const relativo = path.relative(projeto.dirPlaywright, roteiro);
  const semSufixo = relativo.slice(0, -SUFIXO_JORNADA.length);
  return path.join(projeto.dirStatic, 'videos', `${semSufixo}.webm`);
}

try {
  const argv = process.argv.slice(2);
  const id = idDoArgumento(argv);
  const projeto = carregarProjeto(id);
  const indiceId = argv.indexOf(id);
  const depoisDoId = indiceId >= 0 ? argv.slice(indiceId + 1) : argv;
  const roteiroInformado =
    depoisDoId[0] && !depoisDoId[0].startsWith('-') ? depoisDoId.shift() : null;
  const extras = depoisDoId;

  if (!existsSync(projeto.arquivoEnv)) {
    throw new Error(
      `Falta projetos/${id}/.env com as credenciais da conta de demonstração.\n` +
        `Copie projetos/${id}/.env.example e preencha.`,
    );
  }

  const config = path.join(RAIZ, 'extras', 'video', 'playwright.config.ts');
  const dirResultados = projeto.dirVideosResultados;
  const roteiros = roteiroInformado
    ? [resolverRoteiro(projeto.dirPlaywright, roteiroInformado)]
    : arquivosRecursivos(projeto.dirPlaywright, (nome) => nome.endsWith(SUFIXO_JORNADA));

  if (!roteiros.length) {
    throw new Error(`Nenhum roteiro *${SUFIXO_JORNADA} encontrado em projetos/${id}/playwright/.`);
  }

  console.log(`Gravando vídeos de jornada do ${projeto.nome} (${id})...`);
  console.log(
    roteiroInformado
      ? `Roteiro: ${path.relative(projeto.dirPlaywright, roteiros[0])}`
      : `${roteiros.length} roteiro(s) encontrado(s).`,
  );
  console.log('O navegador vai abrir e percorrer o fluxo. Não mexa até terminar.\n');

  for (const [indice, roteiro] of roteiros.entries()) {
    const relativo = path.relative(projeto.dirPlaywright, roteiro);
    const resultadosDaExecucao = path.join(dirResultados, String(indice + 1));
    rmSync(resultadosDaExecucao, { recursive: true, force: true });

    console.log(`[${indice + 1}/${roteiros.length}] ${relativo}`);
    await executar(
      process.execPath,
      [
        BIN.playwright,
        'test',
        '--config',
        config,
        path.relative(RAIZ, roteiro).split(path.sep).join('/'),
        ...extras,
      ],
      {
        env: {
          DOC_PROJETO: id,
          PLAYSAURUS_VIDEO_RESULTADOS: resultadosDaExecucao,
        },
      },
    );

    const gerados = arquivosRecursivos(resultadosDaExecucao, (nome) => nome.endsWith('.webm'));
    if (gerados.length !== 1) {
      throw new Error(
        gerados.length === 0
          ? `O roteiro passou, mas nenhum vídeo foi encontrado: ${relativo}`
          : `O roteiro gerou ${gerados.length} vídeos. Mantenha um único test(...) por arquivo: ${relativo}`,
      );
    }

    const destino = destinoDoRoteiro(projeto, roteiro);
    mkdirSync(path.dirname(destino), { recursive: true });
    copyFileSync(gerados[0], destino);
    console.log(`Vídeo salvo em ${path.relative(RAIZ, destino)}\n`);
  }
} catch (e) {
  encerrarComErro(e);
}
