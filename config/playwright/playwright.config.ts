import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

const { projetoAtivo } = require('../../compartilhado/projeto.cjs');

const projeto = projetoAtivo();
dotenv.config({ path: projeto.arquivoEnv });

const envBaseUrl = projeto.screenshots?.envBaseUrl;
const baseUrlBruto =
  (envBaseUrl && process.env[envBaseUrl]) || projeto.screenshots?.baseUrlPadrao || 'http://localhost:8080';
const baseURL = (() => {
  try {
    return new URL(baseUrlBruto).origin;
  } catch {
    return baseUrlBruto;
  }
})();

export default defineConfig({
  testDir: projeto.dirPlaywright,
  outputDir: projeto.dirPlaywrightResultados,
  testIgnore: [/jornada\.spec\.ts/, /_debug\.spec\.ts/],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    viewport: { width: 1680, height: 900 },
    ignoreHTTPSErrors: true,
    locale: process.env.DOC_SCREENSHOT_APP_LOCALE || projeto.idiomas.padrao,
  },
  projects: [
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'chromium',
      testMatch: /screenshots\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1680, height: 900 },
        storageState: projeto.arquivoAuth,
        launchOptions: {
          args: ['--disable-blink-features=Animations'],
        },
      },
      dependencies: ['setup'],
    },
  ],
});
