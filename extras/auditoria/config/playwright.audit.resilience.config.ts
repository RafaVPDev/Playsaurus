import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';

const { projetoAuditoriaAtivo } = require('../projeto.cjs');

const projeto = projetoAuditoriaAtivo();
dotenv.config({ path: projeto.arquivoEnv });

const envBaseUrl = projeto.auditoria?.envBaseUrl || projeto.screenshots?.envBaseUrl;
const baseUrlBruto =
  (envBaseUrl && process.env[envBaseUrl]) ||
  projeto.auditoria?.baseUrlPadrao ||
  projeto.url ||
  projeto.screenshots?.baseUrlPadrao ||
  'http://localhost:8080';
const baseURL = (() => {
  try {
    return new URL(baseUrlBruto).origin;
  } catch {
    return baseUrlBruto;
  }
})();

const dirEtapa = projeto.dirAuditoriaEtapa('robustez');
const jsonOutput =
  process.env.PLAYSAURUS_RESILIENCE_JSON ||
  path.join(dirEtapa, 'test-results', 'resultado.json');
const htmlOutput =
  process.env.PLAYSAURUS_RESILIENCE_HTML ||
  path.join(dirEtapa, 'report');
const viewport = { width: 1440, height: 900 };

const idsNecessarios = new Set(['colaborador']);
const perfis = projeto.auditoria.perfis.filter((perfil: { id: string }) => idsNecessarios.has(perfil.id));
const authProjects = perfis.map((perfil: { id: string; appLocale?: string }) => ({
  name: `auth:${perfil.id}`,
  testMatch: /auth\.audit\.setup\.ts/,
  metadata: { playsaurusAuditProfile: perfil.id },
  use: {
    ...devices['Desktop Chrome'],
    viewport,
    locale: perfil.appLocale || projeto.idiomas.padrao,
    ignoreHTTPSErrors: true,
  },
}));

export default defineConfig({
  testDir: projeto.dirPlaywright,
  outputDir: path.join(dirEtapa, 'test-results'),
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 180_000,
  reporter: [
    ['list'],
    ['json', { outputFile: jsonOutput }],
    ['html', { outputFolder: htmlOutput, open: 'never' }],
  ],
  use: {
    baseURL,
  },
  projects: [
    ...authProjects,
    {
      name: 'robustez',
      testMatch: /\.resilience\.spec\.ts/,
      dependencies: authProjects.map((project: { name: string }) => project.name),
      use: {
        ...devices['Desktop Chrome'],
        viewport,
        locale: projeto.idiomas.padrao,
        ignoreHTTPSErrors: true,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        video: 'off',
        launchOptions: {
          args: ['--disable-blink-features=Animations'],
        },
      },
    },
  ],
});
