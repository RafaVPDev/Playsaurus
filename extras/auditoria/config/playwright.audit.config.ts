import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'node:path';

const { projetoAuditoriaAtivo } = require('../projeto.cjs');

const projeto = projetoAuditoriaAtivo();
dotenv.config({ path: projeto.arquivoEnv });

function escaparRegex(valor: string) {
  return valor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

const jsonOutput = process.env.PLAYSAURUS_AUDIT_JSON || path.join(projeto.dirResultadosAuditoria, 'resultado.json');
const htmlOutput = process.env.PLAYSAURUS_AUDIT_HTML || projeto.dirRelatorioHtmlAuditoria;
const viewport = { width: 1440, height: 900 };

const perfis = projeto.auditoria.perfis;
const projects = perfis.flatMap((perfil: { id: string; appLocale?: string }) => {
  const auth = `auth:${perfil.id}`;
  const auditoria = `auditoria:${perfil.id}`;
  const metadata = { playsaurusAuditProfile: perfil.id };
  const filtroPerfil = new RegExp(`\\[(?:perfil:${escaparRegex(perfil.id)}|todos)\\]`, 'i');

  return [
    {
      name: auth,
      testMatch: /auth\.audit\.setup\.ts/,
      metadata,
      use: {
        ...devices['Desktop Chrome'],
        viewport,
        locale: perfil.appLocale || projeto.idiomas.padrao,
        ignoreHTTPSErrors: true,
      },
    },
    {
      name: auditoria,
      testMatch: /\.audit\.spec\.ts/,
      testIgnore: /auth\.audit\.setup\.ts/,
      grep: filtroPerfil,
      metadata,
      dependencies: [auth],
      use: {
        ...devices['Desktop Chrome'],
        viewport,
        locale: perfil.appLocale || projeto.idiomas.padrao,
        ignoreHTTPSErrors: true,
        storageState: projeto.arquivoAuthPerfil(perfil.id),
        trace: 'retain-on-failure' as const,
        screenshot: 'only-on-failure' as const,
        video: 'off' as const,
        launchOptions: {
          args: ['--disable-blink-features=Animations'],
        },
      },
    },
  ];
});

export default defineConfig({
  testDir: projeto.dirPlaywright,
  outputDir: projeto.dirResultadosAuditoria,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 60_000,
  reporter: [
    ['list'],
    ['json', { outputFile: jsonOutput }],
    ['html', { outputFolder: htmlOutput, open: 'never' }],
  ],
  use: {
    baseURL,
  },
  projects,
});
