import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

const { projetoAtivo } = require('../../compartilhado/projeto.cjs');

/**
 * Config de GRAVAÇÃO DE VÍDEO das jornadas — separada da de screenshots para não
 * misturar as duas (vídeo é mais lento e só interessa aos specs de jornada).
 *
 * Diferenças em relação à config de screenshots:
 * - grava vídeo (use.video) no tamanho do viewport;
 * - roda mais devagar (slowMo) para o vídeo ficar assistível;
 * - só executa os arquivos *.jornada.spec.ts, ignorando os screenshots.
 *
 * Rodar todos: npm run videos -- <projeto>
 * Rodar um: npm run videos -- <projeto> <pasta/roteiro.jornada.spec.ts>
 */
const projeto = projetoAtivo();

dotenv.config({ path: projeto.arquivoEnv });

const envBaseUrl = projeto.screenshots?.envBaseUrl;
const baseUrlBruto =
  (envBaseUrl && process.env[envBaseUrl]) || projeto.screenshots?.baseUrlPadrao || 'http://localhost:8080';
// Só o origin: uma baseURL com caminho (ex.: ".../login" colado por engano)
// quebraria o goto('/login'). Mantém esquema+host+porta.
const baseURL = (() => {
  try {
    return new URL(baseUrlBruto).origin;
  } catch {
    return baseUrlBruto;
  }
})();
// Mesmo tamanho dos screenshots (1440×900): telas menores cortavam a tabela de
// projetos e escondiam o botão "Novo Projeto".
const VIEWPORT = { width: 1440, height: 900 };
const idiomaPadrao = projeto.idiomas.disponiveis.find((i: { locale: string; appLocale?: string }) => i.locale === projeto.idiomas.padrao);
if (!process.env.DOC_SCREENSHOT_APP_LOCALE) process.env.DOC_SCREENSHOT_APP_LOCALE = idiomaPadrao?.appLocale || projeto.idiomas.padrao;

export default defineConfig({
  testDir: projeto.dirPlaywright,
  outputDir: process.env.PLAYSAURUS_VIDEO_RESULTADOS || projeto.dirVideosResultados,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    locale: idiomaPadrao?.appLocale || projeto.idiomas.padrao,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      testMatch: /jornada\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: VIEWPORT,
        storageState: projeto.arquivoAuth,
        // O runner copia o resultado final para static/videos/ depois que o
        // contexto fecha e o Playwright termina de gravar o arquivo.
        video: { mode: 'on', size: VIEWPORT },
        launchOptions: {
          // Sem slowMo: ele multiplicava cada tecla digitada e cada ação, e uma
          // jornada de ~15s virava ~2min. O ritmo e a visibilidade do cursor
          // vêm das pausas (`beat`) e do efeito de digitação no próprio spec.
          slowMo: 0,
          args: ['--disable-blink-features=Animations'],
        },
      },
      dependencies: ['setup'],
    },
  ],
});
