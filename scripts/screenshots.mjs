/**
 * Captura screenshots por idioma.
 *
 * Por padrão percorre todos os idiomas de projeto.json. Para limitar:
 *   npm run screenshots -- meu-projeto --locale=en
 *   npm run screenshots -- meu-projeto --locale pt-BR
 */
import { existsSync, mkdirSync } from 'node:fs';
import { BIN, carregarProjeto, executar, idDoArgumento, encerrarComErro } from './comum.mjs';

function localeSolicitado(argv) {
  const eq = argv.find((a) => a.startsWith('--locale='));
  if (eq) return eq.split('=')[1];
  const i = argv.indexOf('--locale');
  return i >= 0 ? argv[i + 1] : null;
}

try {
  const argv = process.argv.slice(2);
  const id = idDoArgumento(argv);
  const projeto = carregarProjeto(id);
  if (!existsSync(projeto.arquivoEnv)) {
    throw new Error(`Falta projetos/${id}/.env com as credenciais da conta de demonstração.\nCopie projetos/${id}/.env.example e preencha.`);
  }
  mkdirSync(projeto.dirScreenshots, { recursive: true });

  const pedido = localeSolicitado(argv);
  const idiomas = pedido
    ? projeto.idiomas.disponiveis.filter((i) => i.locale === pedido || i.appLocale === pedido)
    : projeto.idiomas.disponiveis;
  if (!idiomas.length) throw new Error(`Locale "${pedido}" não está configurado em projeto.json.`);

  const extras = argv.filter((a, i) => a.startsWith('-') && a !== '--locale' && !a.startsWith('--locale=') && argv[i - 1] !== '--locale');
  for (const idioma of idiomas) {
    const sub = idioma.locale === projeto.idiomas.padrao ? '' : `/${idioma.locale}`;
    console.log(`\nCapturando ${projeto.nome} · ${idioma.rotulo} (${idioma.locale}) → ${projeto.screenshots?.destino || 'img/usabilidade/geradas'}${sub}`);
    await executar(process.execPath, [BIN.playwright, 'test', '--config', 'config/playwright/playwright.config.ts', ...extras], {
      env: {
        DOC_PROJETO: id,
        DOC_SCREENSHOT_LOCALE: idioma.locale,
        DOC_SCREENSHOT_APP_LOCALE: idioma.appLocale || idioma.locale,
      },
    });
  }
} catch (e) { encerrarComErro(e); }
